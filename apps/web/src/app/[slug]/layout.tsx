import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getPublicSiteData } from '@/lib/api-website';
import { isReservedSlug, normalizeSlug } from '@/lib/reserved-slugs';
import { isSafePublicHttpUrl } from '@/components/public-site/site-utils';

export const revalidate = 60;

async function resolveOriginInfo(): Promise<{ origin: string; isCustomDomain: boolean }> {
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
  const cleanSlug = normalizeSlug(slug || '');
  if (!cleanSlug || isReservedSlug(cleanSlug)) {
    return {};
  }

  const [{ origin, isCustomDomain }, site] = await Promise.all([
    resolveOriginInfo(),
    getPublicSiteData(cleanSlug),
  ]);

  if (!site) {
    return {};
  }

  const encodedSlug = encodeURIComponent(site.tenant.slug);
  const pageUrl = isCustomDomain ? origin : `${origin}/${encodedSlug}`;
  const ogFallbackUrl = isCustomDomain
    ? `${origin}/og`
    : `${origin}/${encodedSlug}/og`;
  const ogBannerUrl = isSafePublicHttpUrl(site.config?.bannerUrl)
    ? site.config.bannerUrl
    : ogFallbackUrl;
  const iconUrl =
    site.tenant.pwaIconUrl || site.tenant.logoUrl || ogFallbackUrl;

  const title = site.tenant.nome;
  const description =
    site.config?.subtituloHero ||
    site.config?.sobreNos ||
    `Portal oficial de ${site.tenant.nome}: horários de cultos, informativos, localização e acolhimento.`;

  return {
    metadataBase: new URL(origin),
    applicationName: site.tenant.nome,
    appleWebApp: {
      capable: true,
      title: site.tenant.nome,
      statusBarStyle: 'default',
    },
    title: {
      default: title,
      template: `%s · ${site.tenant.nome}`,
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
      siteName: site.tenant.nome,
      title,
      description,
      images: [
        {
          url: ogBannerUrl,
          alt: site.tenant.nome,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogBannerUrl],
    },
  };
}

export default async function PublicTenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cleanSlug = normalizeSlug(slug || '');

  if (!cleanSlug || isReservedSlug(cleanSlug)) {
    notFound();
  }

  const site = await getPublicSiteData(cleanSlug);
  if (!site) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#faf9f6] text-stone-900 selection:bg-amber-400 selection:text-zinc-950">
      {children}
    </div>
  );
}
