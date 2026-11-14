import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, UserPlus } from 'lucide-react';
import { getPublicNewsItem, getPublicSiteData } from '@/lib/api-website';
import { isReservedSlug, normalizeSlug } from '@/lib/reserved-slugs';
import { getCanonicalAppOrigin } from '@/lib/site-host';
import { SiteHeader } from '@/components/public-site/site-header';
import { SiteFooter } from '@/components/public-site/site-footer';
import { hasAboutContent } from '@/components/public-site/site-about-section';
import { hasLocationContent } from '@/components/public-site/site-location-section';
import {
  isSafePublicHttpUrl,
  splitSafeParagraphs,
} from '@/components/public-site/site-utils';

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
  params: Promise<{ slug: string; noticiaSlug: string }>;
}): Promise<Metadata> {
  const { slug, noticiaSlug } = await params;
  const cleanSlug = normalizeSlug(slug || '');
  const cleanNewsSlug = normalizeSlug(noticiaSlug || '');

  if (!cleanSlug || !cleanNewsSlug || isReservedSlug(cleanSlug)) {
    return {};
  }

  const [{ origin, isCustomDomain }, detail] = await Promise.all([
    resolveOriginInfo(),
    getPublicNewsItem(cleanSlug, cleanNewsSlug),
  ]);

  if (!detail) {
    return {};
  }

  const encodedSlug = encodeURIComponent(detail.tenant.slug);
  const encodedNewsSlug = encodeURIComponent(detail.news.slug);
  const pageUrl = isCustomDomain
    ? `${origin}/noticias/${encodedNewsSlug}`
    : `${origin}/${encodedSlug}/noticias/${encodedNewsSlug}`;
  const ogFallback = isCustomDomain
    ? `${origin}/og`
    : `${origin}/${encodedSlug}/og`;
  const ogImage = isSafePublicHttpUrl(detail.news.imagemUrl)
    ? detail.news.imagemUrl
    : ogFallback;

  const description =
    detail.news.resumo ||
    detail.news.conteudo.slice(0, 160);

  return {
    title: detail.news.titulo,
    description,
    openGraph: {
      type: 'article',
      locale: 'pt_BR',
      url: pageUrl,
      siteName: detail.tenant.nome,
      title: `${detail.news.titulo} · ${detail.tenant.nome}`,
      description,
      images: [{ url: ogImage, alt: detail.news.titulo }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${detail.news.titulo} · ${detail.tenant.nome}`,
      description,
      images: [ogImage],
    },
  };
}

export default async function PublicTenantNewsDetailPage({
  params,
}: {
  params: Promise<{ slug: string; noticiaSlug: string }>;
}) {
  const { slug, noticiaSlug } = await params;
  const cleanSlug = normalizeSlug(slug || '');
  const cleanNewsSlug = normalizeSlug(noticiaSlug || '');

  if (!cleanSlug || !cleanNewsSlug || isReservedSlug(cleanSlug)) {
    notFound();
  }

  const [headerStore, detail, site] = await Promise.all([
    headers(),
    getPublicNewsItem(cleanSlug, cleanNewsSlug),
    getPublicSiteData(cleanSlug),
  ]);

  if (!detail || !site) {
    notFound();
  }

  const isCustomDomain = Boolean(headerStore.get('x-oneelo-custom-domain'));
  const basePath = isCustomDomain ? '' : undefined;
  const canonicalAppOrigin = isCustomDomain ? getCanonicalAppOrigin() : '/';
  const loginQuery = `igreja=${encodeURIComponent(site.tenant.slug)}`;
  const membersLoginHref = isCustomDomain
    ? `${canonicalAppOrigin}/login?${loginQuery}`
    : `/login?${loginQuery}`;
  const backHref = isCustomDomain ? '/#noticias' : `/${site.tenant.slug}#noticias`;
  const cadastroHref = isCustomDomain ? '/cadastro' : `/${site.tenant.slug}/cadastro`;

  const paragraphs = splitSafeParagraphs(detail.news.conteudo);
  const formattedDate = new Date(detail.news.dataPublicacao).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        tenant={site.tenant}
        hasSchedules={site.schedules.length > 0}
        hasNews={site.news.length > 0}
        hasAbout={hasAboutContent(site.config)}
        hasLocation={hasLocationContent(site.tenant, site.config)}
        basePath={basePath}
        membersLoginHref={membersLoginHref}
      />

      <main className="flex-1 py-10 sm:py-14">
        <article className="mx-auto max-w-3xl px-4 sm:px-6">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-ink hover:text-accent-ink-hover"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar para {site.tenant.nome}</span>
          </Link>

          <header className="mt-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
              <Calendar className="h-3.5 w-3.5 text-stone-400" />
              <time dateTime={detail.news.dataPublicacao}>{formattedDate}</time>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-stone-950 sm:text-4xl">
              {detail.news.titulo}
            </h1>

            {detail.news.resumo && (
              <p className="text-base leading-relaxed text-stone-600 sm:text-lg">
                {detail.news.resumo}
              </p>
            )}
          </header>

          {detail.news.imagemUrl && (
            <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-3xl border border-stone-200 bg-stone-100 shadow-sm">
              <Image
                src={detail.news.imagemUrl}
                alt={detail.news.titulo}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
              />
            </div>
          )}

          <div className="mt-8 space-y-5 rounded-3xl border border-stone-200 bg-white p-6 shadow-2xs sm:p-8">
            {paragraphs.map((paragraph, index) => (
              <p
                key={index}
                className="text-base leading-relaxed text-stone-800"
              >
                {paragraph}
              </p>
            ))}
          </div>

          <div className="mt-8 flex flex-col justify-between gap-4 rounded-2xl border border-accent-soft-border bg-accent-soft/70 p-6 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <p className="text-sm font-bold text-stone-900">
                Deseja participar ou receber acompanhamento pastoral?
              </p>
              <p className="text-xs text-stone-600">
                Preencha sua ficha de visitante ou solicitação de membro na {site.tenant.nome}.
              </p>
            </div>
            <Link
              href={cadastroHref}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-xs transition hover:bg-brand-hover"
            >
              <UserPlus className="h-4 w-4" />
              <span>Fazer Cadastro</span>
            </Link>
          </div>
        </article>
      </main>

      <SiteFooter
        tenant={site.tenant}
        config={site.config}
        basePath={basePath}
        membersLoginHref={membersLoginHref}
        canonicalAppOrigin={canonicalAppOrigin}
      />
    </div>
  );
}
