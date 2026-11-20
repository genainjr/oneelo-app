export const TENANT_BRAND_COOKIE = 'oneelo_tenant_brand';
export const TENANT_BRAND_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface TenantBrandSnapshot {
  slug: string;
  nome: string;
  logoUrl?: string | null;
  pwaIconUrl?: string | null;
  themePalette?: string | null;
  primaryColor?: string | null;
}

export function normalizeTenantBrandSnapshot(
  tenant?: Partial<TenantBrandSnapshot> | null,
): TenantBrandSnapshot | null {
  if (!tenant || typeof tenant.slug !== 'string' || typeof tenant.nome !== 'string') {
    return null;
  }

  const slug = tenant.slug.trim();
  const nome = tenant.nome.trim();
  if (!slug || !nome) {
    return null;
  }

  return {
    slug,
    nome,
    logoUrl: typeof tenant.logoUrl === 'string' && tenant.logoUrl.trim() ? tenant.logoUrl : null,
    pwaIconUrl:
      typeof tenant.pwaIconUrl === 'string' && tenant.pwaIconUrl.trim()
        ? tenant.pwaIconUrl
        : null,
    themePalette:
      typeof tenant.themePalette === 'string' && tenant.themePalette.trim()
        ? tenant.themePalette.trim()
        : null,
    primaryColor:
      typeof tenant.primaryColor === 'string' && tenant.primaryColor.trim()
        ? tenant.primaryColor.trim()
        : null,
  };
}

export function serializeTenantBrandCookie(
  tenant?: Partial<TenantBrandSnapshot> | null,
): string | null {
  const snapshot = normalizeTenantBrandSnapshot(tenant);
  if (!snapshot) return null;
  return JSON.stringify(snapshot);
}

export function parseTenantBrandCookie(raw?: string | null): TenantBrandSnapshot | null {
  if (!raw || typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidates = [trimmed];
  if (trimmed.includes('%')) {
    try {
      const decoded = decodeURIComponent(trimmed);
      if (decoded !== trimmed) {
        candidates.unshift(decoded);
      }
    } catch {
      // Ignore invalid URI sequences
    }
  }

  for (const candidate of candidates) {
    if (!candidate.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(candidate) as Partial<TenantBrandSnapshot>;
      const normalized = normalizeTenantBrandSnapshot(parsed);
      if (normalized) return normalized;
    } catch {
      // Try next candidate
    }
  }

  return null;
}

export function buildTenantBrandCookieString(
  tenant?: Partial<TenantBrandSnapshot> | null,
  isHttps = false,
): string | null {
  const serialized = serializeTenantBrandCookie(tenant);
  if (!serialized) return null;

  const parts = [
    `${TENANT_BRAND_COOKIE}=${encodeURIComponent(serialized)}`,
    'Path=/',
    `Max-Age=${TENANT_BRAND_COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function buildClearTenantBrandCookieString(isHttps = false): string {
  const parts = [
    `${TENANT_BRAND_COOKIE}=`,
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  return parts.join('; ');
}
