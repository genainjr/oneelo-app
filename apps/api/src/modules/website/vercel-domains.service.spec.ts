import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { DnsStatus } from '@prisma/client';
import {
  getCompanionRedirectDomain,
  isApexDomain,
  normalizeAndValidateCustomDomain,
  VercelDomainsService,
} from './vercel-domains.service';

class TestableVercelDomainsService extends VercelDomainsService {
  mockCnames: string[] = [];
  mockAs: string[] = [];
  mockTxts: string[] = [];

  protected override resolveCnameRecords(): Promise<string[]> {
    return Promise.resolve(this.mockCnames);
  }

  protected override resolveARecords(): Promise<string[]> {
    return Promise.resolve(this.mockAs);
  }

  protected override resolveTxtRecords(): Promise<string[]> {
    return Promise.resolve(this.mockTxts);
  }
}

describe('VercelDomainsService', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      VERCEL_API_TOKEN: 'vercel-token-test',
      VERCEL_PROJECT_ID: 'prj_test_123',
      VERCEL_TEAM_ID: 'team_test_456',
      CUSTOM_DOMAIN_CNAME_TARGET: 'cname.vercel-dns.com',
      CUSTOM_DOMAIN_APEX_IP: '76.76.21.21',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('normalizeAndValidateCustomDomain & isApexDomain', () => {
    it('normaliza maiúsculas e barra/ponto final mantendo subdomínio válido', () => {
      expect(
        normalizeAndValidateCustomDomain('  WWW.IgrejaEsperanca.ORG.BR. '),
      ).toBe('www.igrejaesperanca.org.br');
      expect(isApexDomain('igrejaesperanca.org.br')).toBe(true);
      expect(isApexDomain('www.igrejaesperanca.org.br')).toBe(false);
    });

    it('rejeita protocolo, caminhos, porta, localhost, IP e domínios do sistema', () => {
      for (const invalid of [
        'https://igreja.org',
        'igreja.org/cadastro',
        'igreja.org:3000',
        'localhost',
        '127.0.0.1',
        'minha.oneelo.com.br',
        'app.vercel.app',
      ]) {
        expect(() => normalizeAndValidateCustomDomain(invalid)).toThrow(
          BadRequestException,
        );
      }
    });
  });

  it('falha explicitamente ao registrar domínio sem VERCEL_API_TOKEN configurado', async () => {
    delete process.env.VERCEL_API_TOKEN;
    const service = new TestableVercelDomainsService();

    await expect(service.registerDomain('www.igreja.org')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('registra domínio na Vercel via POST v10 e retorna desafios de verificação', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          name: 'www.igreja.org',
          verified: false,
          verification: [
            { type: 'TXT', domain: '_vercel.igreja.org', value: 'vc-verify=abc' },
          ],
        }),
    });
    global.fetch = fetchMock;

    const service = new TestableVercelDomainsService();
    const res = await service.registerDomain('www.igreja.org');

    expect(res.verified).toBe(false);
    expect(res.verificationChallenges).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.vercel.com/v10/projects/prj_test_123/domains?teamId=team_test_456',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('marca DnsStatus.ACTIVE quando Vercel verifica propriedade e CNAME corresponde', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ verified: true, verification: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ misconfigured: false }),
      });
    global.fetch = fetchMock;

    const service = new TestableVercelDomainsService();
    service.mockCnames = ['cname.vercel-dns.com'];

    const outcome = await service.verifyDomain('www.igreja.org');

    expect(outcome.dnsStatus).toBe(DnsStatus.ACTIVE);
    expect(outcome.verified).toBe(true);
    expect(outcome.recordType).toBe('CNAME');
  });

  it('marca DnsStatus.ERROR quando Vercel indica misconfigured e DNS não aponta para o One Elo', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ verified: false, verification: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ misconfigured: true }),
      });
    global.fetch = fetchMock;

    const service = new TestableVercelDomainsService();
    service.mockCnames = ['outro-provedor.com'];

    const outcome = await service.verifyDomain('www.igreja.org');

    expect(outcome.dnsStatus).toBe(DnsStatus.ERROR);
    expect(outcome.verified).toBe(false);
  });

  describe('getCompanionRedirectDomain & syncCompanionRedirect', () => {
    it('resolve domínio irmão apenas entre www e apex, preservando subdomínios específicos', () => {
      expect(getCompanionRedirectDomain('www.ccrv.org.br')).toBe('ccrv.org.br');
      expect(getCompanionRedirectDomain('ccrv.org.br')).toBe('www.ccrv.org.br');
      expect(getCompanionRedirectDomain('www.igreja.org')).toBe('igreja.org');
      expect(getCompanionRedirectDomain('igreja.org')).toBe('www.igreja.org');
      expect(getCompanionRedirectDomain('site.ccrv.org.br')).toBeNull();
    });

    it('registra domínio irmão com redirect 308 e dispara verificação best-effort', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ name: 'ccrv.org.br', verified: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ verified: true }),
        });
      global.fetch = fetchMock;

      const service = new TestableVercelDomainsService();
      await service.syncCompanionRedirect('www.ccrv.org.br');

      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'https://api.vercel.com/v10/projects/prj_test_123/domains?teamId=team_test_456',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'ccrv.org.br',
            redirect: 'www.ccrv.org.br',
            redirectStatusCode: 308,
          }),
        }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'https://api.vercel.com/v9/projects/prj_test_123/domains/ccrv.org.br/verify?teamId=team_test_456',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('atualiza redirect via PATCH quando o domínio irmão já existe (HTTP 409)', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          json: () => Promise.resolve({ error: { code: 'conflict' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ name: 'www.ccrv.org.br' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ verified: true }),
        });
      global.fetch = fetchMock;

      const service = new TestableVercelDomainsService();
      await service.syncCompanionRedirect('ccrv.org.br');

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'https://api.vercel.com/v9/projects/prj_test_123/domains/www.ccrv.org.br?teamId=team_test_456',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            redirect: 'ccrv.org.br',
            redirectStatusCode: 308,
          }),
        }),
      );
    });
  });
});
