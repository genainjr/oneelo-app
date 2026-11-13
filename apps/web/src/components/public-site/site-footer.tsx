import Link from 'next/link';
import {
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Music,
  Phone,
} from 'lucide-react';
import {
  ChurchBrandMark,
  InstagramIcon,
  YouTubeIcon,
} from './church-brand-mark';
import type {
  PublicChurchSchedule,
  PublicSiteConfig,
  PublicSiteTenant,
} from '@/lib/api-website';
import {
  buildSafeGoogleMapsLink,
  isSafePublicHttpUrl,
} from './site-utils';

export function SiteFooter({
  tenant,
  config,
  basePath,
  canonicalAppOrigin = '/',
}: {
  tenant: PublicSiteTenant;
  config: PublicSiteConfig | null;
  schedules?: PublicChurchSchedule[];
  basePath?: string;
  membersLoginHref?: string;
  canonicalAppOrigin?: string;
  hasSchedules?: boolean;
  hasNews?: boolean;
  hasAbout?: boolean;
  hasLocation?: boolean;
}) {
  const homeHref = basePath !== undefined ? basePath || '/' : `/${tenant.slug}`;

  const phoneDisplay = config?.whatsappAtendimento || tenant.telefone;
  const telHref = phoneDisplay
    ? `tel:${phoneDisplay.replace(/[^\d+]/g, '')}`
    : null;
  const mapsLink = buildSafeGoogleMapsLink({
    googleMapsUrl: config?.googleMapsUrl,
    endereco: config?.endereco,
    numero: config?.numero,
    bairro: config?.bairro,
    cidade: config?.cidade,
    estado: config?.estado,
    cep: config?.cep,
    churchName: tenant.nome,
  });

  const addressSummary = [
    [config?.endereco?.trim(), config?.numero?.trim() ? `nº ${config.numero.trim()}` : null]
      .filter(Boolean)
      .join(', '),
    [config?.bairro?.trim(), [config?.cidade?.trim(), config?.estado?.trim()].filter(Boolean).join(' - ')]
      .filter(Boolean)
      .join(' · '),
  ]
    .filter(Boolean)
    .join(' — ');

  const socialLinks = [
    isSafePublicHttpUrl(config?.instagramUrl)
      ? { label: 'Instagram', href: config.instagramUrl, icon: InstagramIcon }
      : null,
    isSafePublicHttpUrl(config?.youtubeUrl)
      ? { label: 'YouTube', href: config.youtubeUrl, icon: YouTubeIcon }
      : null,
    isSafePublicHttpUrl(config?.facebookUrl)
      ? { label: 'Facebook', href: config.facebookUrl, icon: Globe }
      : null,
    isSafePublicHttpUrl(config?.spotifyUrl)
      ? { label: 'Spotify', href: config.spotifyUrl, icon: Music }
      : null,
  ].filter(Boolean) as Array<{ label: string; href: string; icon: typeof Globe }>;

  return (
    <footer
      data-site-footer="true"
      className="border-t border-zinc-800/90 bg-[#060608] text-zinc-300"
    >
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-14 sm:px-6 sm:pb-12 sm:pt-16 lg:px-8">
        <div className="grid grid-cols-1 gap-10 border-b border-zinc-800/90 pb-12 md:grid-cols-12 md:items-start">
          {/* Bloco 1: Identidade + Redes Sociais */}
          <div className="min-w-0 space-y-5 md:col-span-7">
            <Link href={homeHref} className="inline-flex items-center gap-3 text-white">
              <ChurchBrandMark
                logoUrl={tenant.logoUrl}
                churchName={tenant.nome}
                size="md"
              />
              <span className="text-lg font-extrabold tracking-tight text-white">
                {tenant.nome}
              </span>
            </Link>

            <p className="max-w-md text-sm leading-relaxed text-zinc-400 [text-wrap:pretty]">
              {config?.subtituloHero ||
                'Um lugar de fé, comunhão e acolhimento. Venha caminhar conosco e conhecer nossa comunidade.'}
            </p>

            {socialLinks.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                  Redes Sociais
                </p>
                <ul className="flex flex-wrap items-center gap-2.5">
                  {socialLinks.map((social) => {
                    const Icon = social.icon;
                    return (
                      <li key={social.label}>
                        <a
                          href={social.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={social.label}
                          title={social.label}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/90 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:border-amber-400/60 hover:bg-zinc-900 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                          <Icon className="h-4 w-4 text-amber-400" aria-hidden="true" />
                          <span>{social.label}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Bloco 2: Contato */}
          <div className="min-w-0 space-y-4 md:col-span-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
              Contato
            </p>

            {addressSummary && (
              <div className="space-y-1.5 text-xs leading-relaxed text-zinc-400">
                <div className="flex items-start gap-2">
                  <MapPin
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400"
                    aria-hidden="true"
                  />
                  <span>{addressSummary}</span>
                </div>
                {mapsLink && (
                  <a
                    href={mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-8 items-center gap-1 pl-5 font-semibold text-amber-300 transition hover:text-amber-200"
                  >
                    <span>Abrir no Google Maps</span>
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
              </div>
            )}

            {(phoneDisplay || tenant.email) && (
              <ul className="space-y-1 text-xs">
                {phoneDisplay && telHref && (
                  <li>
                    <a
                      href={telHref}
                      className="inline-flex min-h-8 items-center gap-2 text-zinc-300 transition hover:text-amber-300"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                      <span className="whitespace-nowrap">{phoneDisplay}</span>
                    </a>
                  </li>
                )}
                {tenant.email && (
                  <li>
                    <a
                      href={`mailto:${tenant.email}`}
                      className="inline-flex min-h-8 items-center gap-2 text-zinc-300 transition hover:text-amber-300"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                      <span className="break-all">{tenant.email}</span>
                    </a>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 pt-7 text-xs text-zinc-500 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} {tenant.nome}. Todos os direitos reservados.</p>

          <p>
            Portal desenvolvido com{' '}
            <a
              href={canonicalAppOrigin}
              className="inline-flex min-h-9 items-center font-semibold text-zinc-300 underline-offset-4 hover:text-amber-300 hover:underline"
            >
              One Elo
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
