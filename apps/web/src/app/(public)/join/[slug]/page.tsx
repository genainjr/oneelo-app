import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { PublicJoinClient } from './join-client';
import { getPublicTenantInfoServer } from './tenant-public';

async function resolveOrigin() {
  const headersList = await headers();
  const host =
    headersList.get('x-forwarded-host') ||
    headersList.get('host') ||
    'oneelo.vercel.app';
  const proto =
    headersList.get('x-forwarded-proto') ||
    (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [origin, tenant] = await Promise.all([
    resolveOrigin(),
    getPublicTenantInfoServer(slug),
  ]);

  const encodedSlug = encodeURIComponent(slug);
  const pageUrl = `${origin}/join/${encodedSlug}`;
  const ogImageUrl = `${origin}/join/${encodedSlug}/og`;

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
  const tenant = await getPublicTenantInfoServer(slug);

  return <PublicJoinClient slug={slug} initialTenant={tenant} />;
}
