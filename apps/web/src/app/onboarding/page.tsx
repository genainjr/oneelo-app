import type { Metadata, Viewport } from 'next';
import { isReservedSlug, normalizeSlug } from '@/lib/reserved-slugs';
import { resolveServerTenantBrand } from '@/lib/server-tenant-brand';
import { OnboardingClient } from './onboarding-client';

interface OnboardingPageProps {
  searchParams: Promise<{
    igreja?: string | string[];
    church?: string | string[];
  }>;
}

function resolveRequestedSlug(raw?: string | string[]): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const cleanSlug = normalizeSlug(value);
  if (!cleanSlug || isReservedSlug(cleanSlug)) return null;
  return cleanSlug;
}

export async function generateViewport(): Promise<Viewport> {
  const tenantBrand = await resolveServerTenantBrand();
  return {
    themeColor: tenantBrand ? '#09090b' : '#0f2f73',
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const tenantBrand = await resolveServerTenantBrand();
  if (!tenantBrand) {
    return {
      title: 'Primeiro acesso',
    };
  }

  const iconUrl = tenantBrand.pwaIconUrl || tenantBrand.logoUrl || '/apple-touch-icon.png';
  const appleIconUrl = tenantBrand.pwaIconUrl
    ? tenantBrand.pwaIconUrl.replace(/icon-512\.png$/, 'icon-180.png')
    : iconUrl;

  return {
    applicationName: tenantBrand.nome,
    title: `Primeiro acesso · ${tenantBrand.nome}`,
    manifest: `/api/pwa/${encodeURIComponent(tenantBrand.slug)}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: tenantBrand.nome,
      statusBarStyle: 'default',
    },
    icons: {
      shortcut: iconUrl,
      icon: [{ url: iconUrl, type: 'image/png' }],
      apple: [{ url: appleIconUrl, sizes: '180x180', type: 'image/png' }],
    },
  };
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams;
  const requestedSlug = resolveRequestedSlug(params.igreja ?? params.church);
  const initialTenantBrand = await resolveServerTenantBrand(requestedSlug);

  return <OnboardingClient initialTenantBrand={initialTenantBrand} />;
}
