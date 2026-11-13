import * as dns from 'node:dns/promises';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DnsStatus } from '@prisma/client';

export interface VercelVerificationChallenge {
  type: string;
  domain: string;
  value: string;
  reason?: string;
}

export interface DnsTargetsInfo {
  cnameTarget: string;
  apexIp: string;
  vercelConfigured: boolean;
}

export interface DomainVerificationOutcome {
  dnsStatus: DnsStatus;
  verified: boolean;
  dnsMatched: boolean;
  vercelVerified: boolean;
  isApex: boolean;
  recordType: 'CNAME' | 'A_TXT' | 'NONE';
  observedRecords: string[];
  verificationChallenges: VercelVerificationChallenge[];
  details: string;
}

interface VercelProjectDomainPayload {
  name?: string;
  verified?: boolean;
  verification?: Array<{
    type?: string;
    domain?: string;
    value?: string;
    reason?: string;
  }>;
  error?: {
    code?: string;
    message?: string;
  };
}

interface VercelDomainConfigPayload {
  misconfigured?: boolean;
  configuredBy?: string | null;
}

const DEFAULT_SYSTEM_HOSTS = [
  'oneelo.com',
  'oneelo.com.br',
  'www.oneelo.com.br',
  'app.oneelo.com.br',
  'oneelo.vercel.app',
  'localhost',
];

const FQDN_REGEX =
  /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const IPV4_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export function isApexDomain(domain: string): boolean {
  const labels = domain.split('.').filter(Boolean);
  if (labels.length <= 2) {
    return true;
  }
  // Common multi-part ccTLDs such as .com.br, .org.br, .net.br
  if (labels.length === 3 && labels[1].length <= 3 && labels[2].length === 2) {
    return true;
  }
  return false;
}

export function normalizeAndValidateCustomDomain(
  rawDomain: string,
  extraSystemHostsRaw = process.env.WEBSITE_SYSTEM_HOSTS ?? '',
): string {
  if (typeof rawDomain !== 'string') {
    throw new BadRequestException('Informe um domínio válido.');
  }

  let candidate = rawDomain.trim().toLowerCase();
  if (!candidate) {
    throw new BadRequestException('Informe um domínio personalizado válido.');
  }

  if (/^[a-z]+:\/\//i.test(candidate)) {
    throw new BadRequestException(
      'Informe apenas o domínio (ex: igrejaesperanca.org.br), sem http:// ou https://.',
    );
  }

  if (candidate.includes('/') || candidate.includes('?') || candidate.includes('#')) {
    throw new BadRequestException(
      'O domínio não pode conter caminhos, parâmetros ou barras.',
    );
  }

  if (candidate.includes(':')) {
    throw new BadRequestException('O domínio não pode conter porta.');
  }

  candidate = candidate.replace(/\.+$/, '');

  if (
    IPV4_REGEX.test(candidate) ||
    candidate === 'localhost' ||
    candidate.endsWith('.localhost') ||
    candidate.endsWith('.local') ||
    candidate.endsWith('.internal')
  ) {
    throw new BadRequestException(
      'Endereços IP e domínios locais não são permitidos como domínio próprio.',
    );
  }

  if (!FQDN_REGEX.test(candidate)) {
    throw new BadRequestException(
      'Formato de domínio inválido. Utilize um domínio completo como site.suaigreja.org.br.',
    );
  }

  const configuredHosts = extraSystemHostsRaw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const systemHosts = new Set([...DEFAULT_SYSTEM_HOSTS, ...configuredHosts]);

  if (
    systemHosts.has(candidate) ||
    candidate.endsWith('.vercel.app') ||
    candidate.endsWith('.oneelo.com.br') ||
    candidate.endsWith('.oneelo.com')
  ) {
    throw new BadRequestException(
      'Domínios reservados do One Elo ou subdomínios *.vercel.app não podem ser vinculados como domínio próprio.',
    );
  }

  return candidate;
}

@Injectable()
export class VercelDomainsService {
  private readonly logger = new Logger(VercelDomainsService.name);

  getDnsTargets(): DnsTargetsInfo {
    return {
      cnameTarget:
        process.env.CUSTOM_DOMAIN_CNAME_TARGET?.trim() || 'cname.vercel-dns.com',
      apexIp: process.env.CUSTOM_DOMAIN_APEX_IP?.trim() || '76.76.21.21',
      vercelConfigured: this.isVercelConfigured(),
    };
  }

  isVercelConfigured(): boolean {
    return Boolean(
      process.env.VERCEL_API_TOKEN?.trim() && process.env.VERCEL_PROJECT_ID?.trim(),
    );
  }

  private getVercelRequestContext() {
    const token = process.env.VERCEL_API_TOKEN?.trim();
    const projectId = process.env.VERCEL_PROJECT_ID?.trim();
    const teamId = process.env.VERCEL_TEAM_ID?.trim();

    if (!token || !projectId) {
      throw new ServiceUnavailableException(
        'Integração com Vercel Domains API não está configurada no servidor.',
      );
    }

    const teamQuery = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
    return { token, projectId, teamQuery };
  }

  async registerDomain(domain: string): Promise<{
    verified: boolean;
    verificationChallenges: VercelVerificationChallenge[];
  }> {
    const { token, projectId, teamQuery } = this.getVercelRequestContext();

    const response = await this.vercelFetch(
      `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/domains${teamQuery}`,
      {
        method: 'POST',
        token,
        body: JSON.stringify({ name: domain }),
      },
    );

    const payload = await this.safeReadJson<VercelProjectDomainPayload>(response);

    if (response.status === 409) {
      const existing = await this.fetchProjectDomain(domain);
      return {
        verified: Boolean(existing?.verified),
        verificationChallenges: this.normalizeVerificationChallenges(
          existing?.verification,
        ),
      };
    }

    if (!response.ok) {
      const message =
        payload?.error?.message ||
        `Falha ao registrar domínio na Vercel (HTTP ${response.status}).`;
      if (response.status >= 400 && response.status < 500) {
        throw new BadRequestException(message);
      }
      throw new BadGatewayException(message);
    }

    return {
      verified: Boolean(payload?.verified),
      verificationChallenges: this.normalizeVerificationChallenges(
        payload?.verification,
      ),
    };
  }

  async removeDomain(domain: string): Promise<void> {
    if (!this.isVercelConfigured()) {
      this.logger.warn(
        `Remoção de "${domain}" da Vercel ignorada: VERCEL_API_TOKEN/VERCEL_PROJECT_ID não configurados.`,
      );
      return;
    }

    const { token, projectId, teamQuery } = this.getVercelRequestContext();
    const response = await this.vercelFetch(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}${teamQuery}`,
      {
        method: 'DELETE',
        token,
      },
    );

    if (response.status === 404 || response.ok) {
      return;
    }

    const payload = await this.safeReadJson<VercelProjectDomainPayload>(response);
    throw new BadGatewayException(
      payload?.error?.message ||
        `Erro ao remover domínio da Vercel (HTTP ${response.status}).`,
    );
  }

  async verifyDomain(domain: string): Promise<DomainVerificationOutcome> {
    const { token, projectId, teamQuery } = this.getVercelRequestContext();
    const targets = this.getDnsTargets();
    const apex = isApexDomain(domain);

    const dnsCheck = await this.inspectDns(domain, targets, apex);

    const verifyResponse = await this.vercelFetch(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}/verify${teamQuery}`,
      {
        method: 'POST',
        token,
      },
    );

    let domainPayload: VercelProjectDomainPayload | null = null;
    if (verifyResponse.status === 404) {
      const registered = await this.registerDomain(domain);
      return {
        dnsStatus: registered.verified && dnsCheck.matched ? DnsStatus.ACTIVE : DnsStatus.PENDING,
        verified: registered.verified && dnsCheck.matched,
        dnsMatched: dnsCheck.matched,
        vercelVerified: registered.verified,
        isApex: apex,
        recordType: dnsCheck.recordType,
        observedRecords: dnsCheck.observedRecords,
        verificationChallenges: registered.verificationChallenges,
        details: dnsCheck.matched
          ? 'Domínio registrado na Vercel; aguardando conclusão da verificação de propriedade/SSL.'
          : 'Domínio registrado. Configure o apontamento DNS indicado e tente verificar novamente.',
      };
    }

    domainPayload = await this.safeReadJson<VercelProjectDomainPayload>(verifyResponse);
    if (!verifyResponse.ok && verifyResponse.status >= 500) {
      throw new BadGatewayException(
        domainPayload?.error?.message ||
          `Erro ao verificar domínio na Vercel (HTTP ${verifyResponse.status}).`,
      );
    }

    const configResponse = await this.vercelFetch(
      `https://api.vercel.com/v6/domains/${encodeURIComponent(domain)}/config${teamQuery}`,
      {
        method: 'GET',
        token,
      },
    );
    const configPayload = await this.safeReadJson<VercelDomainConfigPayload>(configResponse);

    const vercelVerified = Boolean(domainPayload?.verified);
    const notMisconfigured = configPayload?.misconfigured === false;
    const verificationChallenges = this.normalizeVerificationChallenges(
      domainPayload?.verification,
    );

    const ready = vercelVerified && (notMisconfigured || dnsCheck.matched);

    if (ready) {
      return {
        dnsStatus: DnsStatus.ACTIVE,
        verified: true,
        dnsMatched: dnsCheck.matched || notMisconfigured,
        vercelVerified: true,
        isApex: apex,
        recordType: dnsCheck.recordType,
        observedRecords: dnsCheck.observedRecords,
        verificationChallenges,
        details: 'Domínio verificado e ativo com SSL provisionado.',
      };
    }

    if (configPayload?.misconfigured === true && !dnsCheck.matched) {
      return {
        dnsStatus: DnsStatus.ERROR,
        verified: false,
        dnsMatched: false,
        vercelVerified,
        isApex: apex,
        recordType: dnsCheck.recordType,
        observedRecords: dnsCheck.observedRecords,
        verificationChallenges,
        details:
          'Apontamento DNS incorreto ou ainda não propagado para os servidores do One Elo.',
      };
    }

    return {
      dnsStatus: DnsStatus.PENDING,
      verified: false,
      dnsMatched: dnsCheck.matched,
      vercelVerified,
      isApex: apex,
      recordType: dnsCheck.recordType,
      observedRecords: dnsCheck.observedRecords,
      verificationChallenges,
      details:
        verificationChallenges.length > 0
          ? 'Aguardando verificação TXT/DNS na Vercel. Confira os registros recomendados abaixo.'
          : 'Apontamento em propagação. Aguarde alguns minutos e clique em Verificar Apontamento novamente.',
    };
  }

  protected async resolveCnameRecords(domain: string): Promise<string[]> {
    try {
      return await dns.resolveCname(domain);
    } catch {
      return [];
    }
  }

  protected async resolveARecords(domain: string): Promise<string[]> {
    try {
      return await dns.resolve4(domain);
    } catch {
      return [];
    }
  }

  protected async resolveTxtRecords(domain: string): Promise<string[]> {
    try {
      const records = await dns.resolveTxt(domain);
      return records.map((chunks) => chunks.join(''));
    } catch {
      return [];
    }
  }

  private async inspectDns(
    domain: string,
    targets: DnsTargetsInfo,
    apex: boolean,
  ): Promise<{
    matched: boolean;
    recordType: 'CNAME' | 'A_TXT' | 'NONE';
    observedRecords: string[];
  }> {
    const normalizedTarget = targets.cnameTarget.toLowerCase().replace(/\.+$/, '');

    if (!apex) {
      const cnameRecords = await this.resolveCnameRecords(domain);
      const normalizedObserved = cnameRecords.map((item) =>
        item.toLowerCase().replace(/\.+$/, ''),
      );
      if (normalizedObserved.length > 0) {
        const matched = normalizedObserved.some(
          (record) =>
            record === normalizedTarget || record.endsWith('.vercel-dns.com'),
        );
        return {
          matched,
          recordType: 'CNAME',
          observedRecords: normalizedObserved,
        };
      }
    }

    const [aRecords, txtRecords] = await Promise.all([
      this.resolveARecords(domain),
      this.resolveTxtRecords(domain),
    ]);

    if (aRecords.length > 0) {
      const matched = aRecords.includes(targets.apexIp);
      return {
        matched,
        recordType: 'A_TXT',
        observedRecords: [...aRecords, ...txtRecords],
      };
    }

    return {
      matched: false,
      recordType: 'NONE',
      observedRecords: txtRecords,
    };
  }

  private async fetchProjectDomain(
    domain: string,
  ): Promise<VercelProjectDomainPayload | null> {
    const { token, projectId, teamQuery } = this.getVercelRequestContext();
    const response = await this.vercelFetch(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}${teamQuery}`,
      {
        method: 'GET',
        token,
      },
    );
    if (!response.ok) return null;
    return this.safeReadJson<VercelProjectDomainPayload>(response);
  }

  private normalizeVerificationChallenges(
    raw?: VercelProjectDomainPayload['verification'],
  ): VercelVerificationChallenge[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item) => item?.type && item?.domain && item?.value)
      .map((item) => ({
        type: String(item.type),
        domain: String(item.domain),
        value: String(item.value),
        reason: item.reason ? String(item.reason) : undefined,
      }));
  }

  private async vercelFetch(
    url: string,
    init: { method: string; token: string; body?: string },
  ): Promise<Response> {
    try {
      return await fetch(url, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${init.token}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init.body,
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro de rede ao acessar Vercel Domains API.';
      throw new ServiceUnavailableException(
        `Não foi possível comunicar com a Vercel Domains API: ${message}`,
      );
    }
  }

  private async safeReadJson<T>(response: Response): Promise<T | null> {
    try {
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }
}
