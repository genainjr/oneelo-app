import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { PublicJoinClient } from '@/components/public-site/join/public-join-client';
import { getPublicTenantInfoServer } from '@/components/public-site/join/tenant-public';
import { isReservedSlug, normalizeSlug } from '@/lib/reserved-slugs';

async function resolveOriginInfo() {
  const headersList = await headers();
  const host =
    headersList.get('x-forwarded-host') ||
    headersList.get('host') ||
    'oneelo.vercel.app';
  const proto =
    headersList.get('x-forwarded-proto') ||
    (host.includes('localhost') ? 'http' : 'https');
  const isCustomDomain = Boolean(headersList.get('x-oneelo-custom-domain'));
  return { origin: `${proto}://${host}`, isCustomDomain };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cleanSlug = normalizeSlug(slug);
  if (isReservedSlug(cleanSlug)) {
    return {};
  }

  const [{ origin, isCustomDomain }, tenant] = await Promise.all([
    resolveOriginInfo(),
    getPublicTenantInfoServer(cleanSlug),
  ]);

  const encodedSlug = encodeURIComponent(cleanSlug);
  const pageUrl = isCustomDomain
    ? `${origin}/cadastro`
    : `${origin}/${encodedSlug}/cadastro`;
  const ogImageUrl = isCustomDomain
    ? `${origin}/og`
    : `${origin}/${encodedSlug}/og`;

  const churchName = tenant?.nome || 'Nossa Igreja';
  const title = tenant?.nome
    ? `${tenant.nome} — Boas-vindas`
    : 'Boas-vindas — Ficha da Igreja';
  const description = tenant?.nome
    ? `Preencha sua ficha de visitante ou solicitação de membro na ${tenant.nome}.`
    : 'Preencha sua ficha de visitante ou solicitação de membro.';
  const iconUrl = tenant?.pwaIconUrl || tenant?.logoUrl || ogImageUrl;

  return {
    metadataBase: new URL(origin),
    applicationName: churchName,
    appleWebApp: {
      capable: true,
      title: churchName,
      statusBarStyle: 'default',
    },
    title: {
      absolute: title,
    },
    description,
    icons: {
      shortcut: iconUrl,
      icon: [{ url: iconUrl, type: 'image/png' }],
      apple: [{ url: iconUrl, type: 'image/png' }],
    },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      url: pageUrl,
      siteName: churchName,
      title,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 512,
          height: 512,
          type: 'image/png',
          alt: churchName,
        },
      ],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function PublicJoinPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cleanSlug = normalizeSlug(slug);
  if (isReservedSlug(cleanSlug)) {
    notFound();
  }

  const [headerStore, tenant] = await Promise.all([
    headers(),
    getPublicTenantInfoServer(cleanSlug),
  ]);
  const isCustomDomain = Boolean(headerStore.get('x-oneelo-custom-domain'));
  const homeHref = isCustomDomain ? '/' : `/${cleanSlug}`;

  return <PublicJoinClient slug={cleanSlug} initialTenant={tenant} homeHref={homeHref} />;
}
