import type { AuthUser } from '@/types';

export const TENANT_MANIFEST_REVISION = '4';
const TENANT_PWA_CACHE_KEY = 'oneelo:tenant-pwa-meta';

export type TenantPwaBranding = NonNullable<AuthUser['tenant']>;

export function hasCustomTenantPwa(tenant?: TenantPwaBranding | null): boolean {
  return Boolean(
    tenant?.slug &&
      tenant.pwaShortName &&
      tenant.pwaIconUrl &&
      tenant.pwaIconKey &&
      tenant.pwaUpdatedAt,
  );
}

export function saveCachedTenantPwa(tenant?: TenantPwaBranding | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!tenant) {
      localStorage.removeItem(TENANT_PWA_CACHE_KEY);
      return;
    }
    localStorage.setItem(
      TENANT_PWA_CACHE_KEY,
      JSON.stringify({
        nome: tenant.nome,
        slug: tenant.slug,
        pwaShortName: tenant.pwaShortName ?? null,
        pwaIconUrl: tenant.pwaIconUrl ?? null,
        pwaIconKey: tenant.pwaIconKey ?? null,
        pwaUpdatedAt: tenant.pwaUpdatedAt ?? null,
      }),
    );
  } catch {
    // ignore storage errors
  }
}

export function readCachedTenantPwa(): TenantPwaBranding | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TENANT_PWA_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TenantPwaBranding;
  } catch {
    return null;
  }
}

export function clearCachedTenantPwa(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TENANT_PWA_CACHE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function syncThemeColorMeta(themeColor: string): void {
  if (typeof document === 'undefined') return;

  let themeColorMeta = document.head.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (!themeColorMeta) {
    themeColorMeta = document.createElement('meta');
    themeColorMeta.name = 'theme-color';
    document.head.appendChild(themeColorMeta);
  }
  if (themeColorMeta.content !== themeColor) {
    themeColorMeta.content = themeColor;
  }
}

export function syncTenantPwaHead(tenant?: TenantPwaBranding | null): void {
  if (typeof document === 'undefined') return;

  const customPwa = hasCustomTenantPwa(tenant);
  const version = customPwa
    ? encodeURIComponent(`${tenant!.pwaUpdatedAt!}:${TENANT_MANIFEST_REVISION}`)
    : null;
  const manifestHref = customPwa
    ? `/api/pwa/${encodeURIComponent(tenant!.slug)}/manifest.webmanifest?v=${version}`
    : '/manifest.webmanifest';
  const appleIconHref = customPwa
    ? tenant!.pwaIconUrl!.replace(/icon-512\.png$/, 'icon-180.png')
    : '/apple-touch-icon.png';
  const appTitle = customPwa ? tenant!.pwaShortName! : 'One Elo';

  let manifestLink = document.head.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!manifestLink) {
    manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    document.head.appendChild(manifestLink);
  }
  if (manifestLink.getAttribute('href') !== manifestHref) {
    manifestLink.setAttribute('href', manifestHref);
  }

  let appleIconLink = document.head.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (!appleIconLink) {
    appleIconLink = document.createElement('link');
    appleIconLink.rel = 'apple-touch-icon';
    appleIconLink.sizes = '180x180';
    appleIconLink.type = 'image/png';
    document.head.appendChild(appleIconLink);
  }
  if (appleIconLink.getAttribute('href') !== appleIconHref) {
    appleIconLink.setAttribute('href', appleIconHref);
  }

  let appleTitleMeta = document.head.querySelector<HTMLMetaElement>(
    'meta[name="apple-mobile-web-app-title"]',
  );
  if (!appleTitleMeta) {
    appleTitleMeta = document.createElement('meta');
    appleTitleMeta.name = 'apple-mobile-web-app-title';
    document.head.appendChild(appleTitleMeta);
  }
  if (appleTitleMeta.content !== appTitle) {
    appleTitleMeta.content = appTitle;
  }

  let appNameMeta = document.head.querySelector<HTMLMetaElement>(
    'meta[name="application-name"]',
  );
  if (!appNameMeta) {
    appNameMeta = document.createElement('meta');
    appNameMeta.name = 'application-name';
    document.head.appendChild(appNameMeta);
  }
  if (appNameMeta.content !== appTitle) {
    appNameMeta.content = appTitle;
  }

  syncThemeColorMeta(tenant ? '#09090b' : '#0f2f73');

  if (customPwa && tenant?.nome && !document.title.includes(tenant.nome)) {
    document.title = `${tenant.nome} | One Elo`;
  }
}

