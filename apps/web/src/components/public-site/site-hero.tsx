import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Newspaper,
  UserPlus,
} from 'lucide-react';
import type {
  PublicChurchSchedule,
  PublicSiteConfig,
  PublicSiteTenant,
} from '@/lib/api-website';
import { formatShortWeekdayLabel } from './site-utils';

interface SiteHeroProps {
  tenant: PublicSiteTenant;
  config: PublicSiteConfig | null;
  hasSchedules: boolean;
  schedules?: PublicChurchSchedule[];
  hasNews?: boolean;
  hasAbout?: boolean;
  hasLocation?: boolean;
  basePath?: string;
  membersLoginHref?: string;
}

interface HighlightShortcut {
  key: string;
  label: string;
  href: string;
  icon: typeof CalendarClock;
}

export function SiteHero({
  tenant,
  config,
  hasSchedules,
  schedules = [],
  hasNews = false,
  hasAbout = false,
  basePath,
}: SiteHeroProps) {
  const headline = config?.tituloHero || `Bem-vindo à ${tenant.nome}`;
  const subtitle =
    config?.subtituloHero ||
    'Um lugar de fé, comunhão e acolhimento. Venha caminhar conosco e conhecer nossa comunidade.';
  const cadastroHref =
    basePath !== undefined ? `${basePath}/cadastro` : `/${tenant.slug}/cadastro`;
  const anchorBase = basePath !== undefined ? `${basePath}/` : `/${tenant.slug}`;

  const topSchedules = schedules.slice(0, 3);

  const highlights: HighlightShortcut[] = [
    hasAbout
      ? {
          key: 'sobre',
          label: 'A Igreja',
          href: `${anchorBase}#sobre`,
          icon: BookOpen,
        }
      : null,
    {
      key: 'visitar',
      label: 'Boas Vindas',
      href: cadastroHref,
      icon: UserPlus,
    },
    hasSchedules
      ? {
          key: 'agenda',
          label: 'Agendas',
          href: `${anchorBase}#cultos`,
          icon: CalendarClock,
        }
      : null,
    hasNews
      ? {
          key: 'noticias',
          label: 'Informativos',
          href: `${anchorBase}#noticias`,
          icon: Newspaper,
        }
      : null,
  ].filter(Boolean) as HighlightShortcut[];

  return (
    <section className="relative overflow-hidden border-b border-zinc-800/90 bg-zinc-950 text-white">
      {/* Textura arquitetônica sutil inspirada em portais modernos */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-amber-500/12 blur-3xl"
      />

      {/* Banner full-bleed expandido: no mobile em 16:9 no topo; no desktop 100% expandido em largura com degradê esquerdo para leitura */}
      {config?.bannerUrl && (
        <div
          aria-hidden="true"
          className="pointer-events-none relative aspect-[16/9] w-full overflow-hidden lg:absolute lg:inset-0 lg:aspect-auto"
        >
          <Image
            src={config.bannerUrl}
            alt={headline}
            fill
            priority
            fetchPriority="high"
            sizes="100vw"
            className="object-cover object-center lg:object-[72%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent lg:bg-gradient-to-r lg:from-zinc-950 lg:from-[22%] lg:via-zinc-950/88 lg:via-[44%] lg:to-zinc-950/15" />
          <div className="hidden lg:block lg:absolute lg:inset-x-0 lg:bottom-0 lg:h-24 lg:bg-gradient-to-t lg:from-zinc-950 lg:to-transparent" />
          <div className="hidden lg:block lg:absolute lg:inset-x-0 lg:top-0 lg:h-16 lg:bg-gradient-to-b lg:from-zinc-950/60 lg:to-transparent" />
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-8 pt-3 sm:px-6 sm:pb-10 sm:pt-10 lg:px-8 lg:pb-12 lg:pt-12">
        <div className="max-w-lg space-y-3.5 sm:space-y-4 lg:max-w-[460px]">
          <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
            <span>Portal Oficial</span>
          </p>

          <h1 className="text-[clamp(1.75rem,1.25rem+2.3vw,3.125rem)] font-extrabold leading-[1.07] tracking-[-0.03em] text-white [text-wrap:balance]">
            {headline}
          </h1>

          <p className="max-w-[44ch] text-sm leading-relaxed text-zinc-300 [text-wrap:pretty] sm:text-base">
            {subtitle}
          </p>

          {topSchedules.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-medium text-zinc-300 sm:text-sm">
              <span className="font-bold uppercase tracking-[0.14em] text-amber-400">
                Cultos
              </span>
              <span aria-hidden="true" className="text-zinc-600">
                •
              </span>
              {topSchedules.map((item, idx) => (
                <span key={item.id} className="inline-flex items-center gap-2 tabular-nums">
                  <span>
                    <strong className="font-semibold text-white">
                      {formatShortWeekdayLabel(item.diaSemana)}
                    </strong>{' '}
                    {item.horario}
                  </span>
                  {idx < topSchedules.length - 1 && (
                    <span aria-hidden="true" className="text-zinc-600">
                      |
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href={cadastroHref}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-amber-400 px-6 py-2.5 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-500/15 transition hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              <span>Sou Novo Aqui</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>

            {hasSchedules && (
              <a
                href={`${anchorBase}#cultos`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/8 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-white/35 hover:bg-white/14 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                <CalendarClock className="h-4 w-4 text-amber-400" aria-hidden="true" />
                <span>Ver Horários</span>
              </a>
            )}
          </div>

          {config?.versiculoTema && (
            <blockquote className="mt-2 border-l-2 border-amber-400/80 pl-4 pt-0.5">
              <p className="max-w-[44ch] text-sm italic leading-relaxed text-zinc-200 [text-wrap:pretty]">
                “{config.versiculoTema}”
              </p>
              {config.versiculoReferencia && (
                <footer className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-400">
                  {config.versiculoReferencia}
                </footer>
              )}
            </blockquote>
          )}
        </div>

        {/* Faixa de atalhos circulares inspirada nos destaques do @trigo.church */}
        {highlights.length > 0 && (
          <div className="mt-10 border-t border-white/10 pt-7 sm:mt-12">
            <ul
              aria-label="Acesso rápido"
              className="flex items-start gap-4 overflow-x-auto pb-2 sm:flex-wrap sm:gap-6 sm:overflow-visible sm:pb-0"
            >
              {highlights.map((item) => {
                const Icon = item.icon;
                const circleClasses =
                  'border-amber-400/55 bg-zinc-900/95 text-amber-400 ring-2 ring-amber-400/10 group-hover:border-amber-300 group-hover:bg-amber-400 group-hover:text-zinc-950';

                const inner = (
                  <>
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-full border transition duration-200 ${circleClasses}`}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="max-w-[76px] truncate text-center text-[11px] font-medium text-zinc-300 transition-colors group-hover:text-white">
                      {item.label}
                    </span>
                  </>
                );

                return (
                  <li key={item.key} className="shrink-0">
                    {item.href.startsWith('/') ? (
                      <Link
                        href={item.href}
                        className="group flex min-w-[64px] flex-col items-center gap-2 rounded-xl px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <a
                        href={item.href}
                        className="group flex min-w-[64px] flex-col items-center gap-2 rounded-xl px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                      >
                        {inner}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
