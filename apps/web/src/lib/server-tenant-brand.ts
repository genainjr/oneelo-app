import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { getPublicTenantInfoServer } from '@/components/public-site/join/tenant-public';
import { isReservedSlug, normalizeSlug } from './reserved-slugs';
import {
  TENANT_BRAND_COOKIE,
  parseTenantBrandCookie,
  type TenantBrandSnapshot,
} from './tenant-brand-cookie';

function normalizeRequestedSlug(raw?: string | null): string | null {
  if (!raw) return null;
  const cleanSlug = normalizeSlug(raw);
  if (!cleanSlug || isReservedSlug(cleanSlug)) return null;
  return cleanSlug;
}

/**
 * Resolves the tenant visual brand snapshot for SSR layouts without blocking on
 * authenticated session fetches. Uses the lightweight `oneelo_tenant_brand` cookie
 * first (0ms) and only falls back to public tenant info when a `?igreja=` slug is
 * explicitly requested without a matching cookie (e.g., first launch of an installed PWA).
 */
export const resolveServerTenantBrand = cache(
  async (explicitSlug?: string | null): Promise<TenantBrandSnapshot | null> => {
    const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
    const cookieBrand = parseTenantBrandCookie(cookieStore.get(TENANT_BRAND_COOKIE)?.value);
    const requestedSlug = normalizeRequestedSlug(
      explicitSlug ?? headerStore.get('x-oneelo-church-slug'),
    );

    if (cookieBrand && (!requestedSlug || cookieBrand.slug === requestedSlug)) {
      return cookieBrand;
    }

    if (requestedSlug) {
      const publicInfo = await getPublicTenantInfoServer(requestedSlug);
      if (publicInfo) {
        return {
          slug: publicInfo.slug,
          nome: publicInfo.nome,
          logoUrl: publicInfo.logoUrl ?? null,
          pwaIconUrl: publicInfo.pwaIconUrl ?? null,
          themePalette: publicInfo.themePalette ?? null,
          primaryColor: publicInfo.primaryColor ?? null,
        };
      }
    }

    return cookieBrand;
  },
);
