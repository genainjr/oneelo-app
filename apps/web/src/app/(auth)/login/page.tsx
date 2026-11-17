import type { Metadata } from 'next';
import { getPublicTenantInfoServer } from '@/components/public-site/join/tenant-public';
import { isReservedSlug, normalizeSlug } from '@/lib/reserved-slugs';
import { LoginClient } from './login-client';

interface LoginPageProps {
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

export async function generateMetadata({ searchParams }: LoginPageProps): Promise<Metadata> {
  const params = await searchParams;
  const churchSlug = resolveRequestedSlug(params.igreja ?? params.church);
  if (!churchSlug) {
    return {};
  }

  const church = await getPublicTenantInfoServer(churchSlug);
  if (!church) {
    return {};
  }

  const iconUrl = church.pwaIconUrl || church.logoUrl || '/apple-touch-icon.png';
  const appleIconUrl = church.pwaIconUrl
    ? church.pwaIconUrl.replace(/icon-512\.png$/, 'icon-180.png')
    : iconUrl;

  return {
    title: {
      absolute: `Área de Membros · ${church.nome}`,
    },
    description: `Acesse o portal de membros de ${church.nome}.`,
    manifest: `/api/pwa/${encodeURIComponent(church.slug)}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: church.nome,
      statusBarStyle: 'default',
    },
    icons: {
      shortcut: iconUrl,
      icon: [{ url: iconUrl, type: 'image/png' }],
      apple: [{ url: appleIconUrl, sizes: '180x180', type: 'image/png' }],
    },
  };
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const churchSlug = resolveRequestedSlug(params.igreja ?? params.church);
  const initialChurch = churchSlug
    ? await getPublicTenantInfoServer(churchSlug)
    : null;

  return <LoginClient initialChurch={initialChurch} churchSlug={churchSlug} />;
}
