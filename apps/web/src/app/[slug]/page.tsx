import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getPublicSiteData } from '@/lib/api-website';
import { isReservedSlug, normalizeSlug } from '@/lib/reserved-slugs';
import { getCanonicalAppOrigin } from '@/lib/site-host';
import { SiteHeader } from '@/components/public-site/site-header';
import { SiteHero } from '@/components/public-site/site-hero';
import { SiteSchedulesSection } from '@/components/public-site/site-schedules-section';
import { SiteNewsSection } from '@/components/public-site/site-news-section';
import {
  hasAboutContent,
  SiteAboutSection,
} from '@/components/public-site/site-about-section';
import {
  hasLocationContent,
  SiteLocationSection,
} from '@/components/public-site/site-location-section';
import { SiteFooter } from '@/components/public-site/site-footer';
import { SiteWelcomeSection } from '@/components/public-site/site-welcome-section';
import { SiteWhatsappFloat } from '@/components/public-site/site-whatsapp-float';
import { buildWhatsappLink } from '@/components/public-site/site-utils';

export const revalidate = 60;

export default async function PublicTenantHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cleanSlug = normalizeSlug(slug || '');

  if (!cleanSlug || isReservedSlug(cleanSlug)) {
    notFound();
  }

  const [headerStore, site] = await Promise.all([
    headers(),
    getPublicSiteData(cleanSlug),
  ]);
  if (!site) {
    notFound();
  }

  const isCustomDomain = Boolean(headerStore.get('x-oneelo-custom-domain'));
  const basePath = isCustomDomain ? '' : undefined;
  const canonicalAppOrigin = isCustomDomain ? getCanonicalAppOrigin() : '/';
  const loginQuery = `igreja=${encodeURIComponent(site.tenant.slug)}`;
  const membersLoginHref = isCustomDomain
    ? `${canonicalAppOrigin}/login?${loginQuery}`
    : `/login?${loginQuery}`;

  const hasSchedules = site.schedules.length > 0;
  const hasNews = site.news.length > 0;
  const hasAbout = hasAboutContent(site.config);
  const hasLocation = hasLocationContent(site.tenant, site.config);
  const whatsappHref = buildWhatsappLink(
    site.config?.whatsappAtendimento || site.tenant.telefone,
    site.tenant.nome,
  );

  return (
    <div className="public-site-root flex min-h-screen flex-col overflow-x-clip bg-zinc-950">
      <SiteHeader
        tenant={site.tenant}
        hasSchedules={hasSchedules}
        hasNews={hasNews}
        hasAbout={hasAbout}
        hasLocation={hasLocation}
        basePath={basePath}
        membersLoginHref={membersLoginHref}
      />

      <main id="conteudo-principal" tabIndex={-1} className="flex-1 focus:outline-none">
        <SiteHero
          tenant={site.tenant}
          config={site.config}
          hasSchedules={hasSchedules}
          schedules={site.schedules}
          hasNews={hasNews}
          hasAbout={hasAbout}
          hasLocation={hasLocation}
          basePath={basePath}
          membersLoginHref={membersLoginHref}
        />

        <SiteSchedulesSection schedules={site.schedules} />

        <SiteWelcomeSection
          churchName={site.tenant.nome}
          slug={site.tenant.slug}
          basePath={basePath}
          membersLoginHref={membersLoginHref}
        />

        <SiteNewsSection
          slug={site.tenant.slug}
          news={site.news}
          basePath={basePath}
        />

        <SiteAboutSection churchName={site.tenant.nome} config={site.config} />

        <SiteLocationSection tenant={site.tenant} config={site.config} />
      </main>

      <SiteFooter
        tenant={site.tenant}
        config={site.config}
        schedules={site.schedules}
        basePath={basePath}
        membersLoginHref={membersLoginHref}
        canonicalAppOrigin={canonicalAppOrigin}
        hasSchedules={hasSchedules}
        hasNews={hasNews}
        hasAbout={hasAbout}
        hasLocation={hasLocation}
      />

      <SiteWhatsappFloat href={whatsappHref} churchName={site.tenant.nome} />
    </div>
  );
}
