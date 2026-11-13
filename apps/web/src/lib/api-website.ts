import { cache } from 'react';
import { isReservedSlug, normalizeSlug } from './reserved-slugs';

export type ModalidadeCulto = 'PRESENCIAL' | 'ONLINE' | 'HIBRIDO';
export type DnsStatus = 'PENDING' | 'ACTIVE' | 'ERROR';

export interface DnsTargetsInfo {
  cnameTarget: string;
  apexIp: string;
  vercelConfigured: boolean;
}

export interface DomainVerificationChallenge {
  type: string;
  domain: string;
  value: string;
  reason?: string;
}

export interface CustomDomainStatusResponse {
  customDomain: string | null;
  dnsStatus: DnsStatus;
  verified?: boolean;
  dnsMatched?: boolean;
  vercelVerified?: boolean;
  isApex?: boolean;
  recordType?: 'CNAME' | 'A_TXT' | 'NONE';
  observedRecords?: string[];
  verificationChallenges?: DomainVerificationChallenge[];
  details?: string;
  dnsTargets?: DnsTargetsInfo;
  dnsCheckedAt?: string | null;
  customDomainVerifiedAt?: string | null;
  removed?: boolean;
}

export interface PublicSiteTenant {
  nome: string;
  slug: string;
  logoUrl?: string | null;
  pwaIconUrl?: string | null;
  email?: string | null;
  telefone?: string | null;
}

export interface PublicSiteConfig {
  tituloHero: string | null;
  subtituloHero: string | null;
  bannerUrl: string | null;
  versiculoTema: string | null;
  versiculoReferencia: string | null;
  sobreNos: string | null;
  historia: string | null;
  visaoValores: string | null;
  pastoresNomes: string | null;
  pastoresBio: string | null;
  pastoresFotoUrl: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  googleMapsUrl: string | null;
  horarioSecretaria: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  facebookUrl: string | null;
  spotifyUrl: string | null;
  whatsappAtendimento: string | null;
}

export interface PublicChurchSchedule {
  id: string;
  diaSemana: number;
  horario: string;
  titulo: string;
  descricao: string | null;
  modalidade: ModalidadeCulto;
  ordem: number;
  ativo: boolean;
}

export interface PublicTenantNews {
  id: string;
  titulo: string;
  slug: string;
  resumo: string | null;
  conteudo: string;
  imagemUrl: string | null;
  dataPublicacao: string;
  destaque: boolean;
  ativo: boolean;
}

export interface PublicSiteData {
  tenant: PublicSiteTenant;
  config: PublicSiteConfig | null;
  schedules: PublicChurchSchedule[];
  news: PublicTenantNews[];
}

export interface PublicNewsDetailResponse {
  tenant: Pick<PublicSiteTenant, 'nome' | 'slug' | 'logoUrl' | 'pwaIconUrl'>;
  news: PublicTenantNews;
}

export interface AdminWebsiteConfig extends PublicSiteConfig {
  id: string;
  tenantId: string;
  customDomain: string | null;
  dnsStatus: DnsStatus;
  dnsCheckedAt?: string | null;
  customDomainVerifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminWebsiteConfigResponse {
  tenant: PublicSiteTenant & { id: string; plano?: 'GRATUITO' | 'BASICO' | 'PROFISSIONAL' };
  canUseCustomDomain?: boolean;
  dnsTargets?: DnsTargetsInfo;
  config: AdminWebsiteConfig | null;
}

function getServerApiBase(): string {
  return (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4001'
  );
}

export const getPublicSiteData = cache(
  async (slug: string): Promise<PublicSiteData | null> => {
    const cleanSlug = normalizeSlug(slug || '');
    if (!cleanSlug || isReservedSlug(cleanSlug)) {
      return null;
    }

    try {
      const res = await fetch(
        `${getServerApiBase()}/api/public/site/${encodeURIComponent(cleanSlug)}`,
        {
          next: { revalidate: 60, tags: ['site', `site-${cleanSlug}`] },
          signal: AbortSignal.timeout(8000),
        },
      );

      if (!res.ok) {
        return null;
      }

      return (await res.json()) as PublicSiteData;
    } catch {
      return null;
    }
  },
);

export const getPublicNewsItem = cache(
  async (
    slug: string,
    noticiaSlug: string,
  ): Promise<PublicNewsDetailResponse | null> => {
    const cleanSlug = normalizeSlug(slug || '');
    const cleanNewsSlug = normalizeSlug(noticiaSlug || '');

    if (!cleanSlug || !cleanNewsSlug || isReservedSlug(cleanSlug)) {
      return null;
    }

    try {
      const res = await fetch(
        `${getServerApiBase()}/api/public/site/${encodeURIComponent(cleanSlug)}/noticias/${encodeURIComponent(cleanNewsSlug)}`,
        {
          next: { revalidate: 60, tags: ['site', `site-${cleanSlug}`] },
          signal: AbortSignal.timeout(8000),
        },
      );

      if (!res.ok) {
        return null;
      }

      return (await res.json()) as PublicNewsDetailResponse;
    } catch {
      return null;
    }
  },
);
