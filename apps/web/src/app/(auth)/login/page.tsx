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

  return {
    title: {
      absolute: `Área de Membros · ${church.nome}`,
    },
    description: `Acesse o portal de membros de ${church.nome}.`,
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
