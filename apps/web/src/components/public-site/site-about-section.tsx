import Image from 'next/image';
import { BookOpen, Compass, HeartHandshake, UserRound } from 'lucide-react';
import type { PublicSiteConfig } from '@/lib/api-website';
import { splitSafeParagraphs } from './site-utils';

export function hasAboutContent(config: PublicSiteConfig | null): boolean {
  if (!config) return false;
  return Boolean(
    config.sobreNos ||
      config.historia ||
      config.visaoValores ||
      config.pastoresNomes ||
      config.pastoresBio ||
      config.pastoresFotoUrl,
  );
}

export function SiteAboutSection({
  churchName,
  config,
}: {
  churchName: string;
  config: PublicSiteConfig | null;
}) {
  if (!config || !hasAboutContent(config)) return null;

  const sobreParagraphs = splitSafeParagraphs(config.sobreNos);
  const historiaParagraphs = splitSafeParagraphs(config.historia);
  const visaoParagraphs = splitSafeParagraphs(config.visaoValores);
  const pastoresBioParagraphs = splitSafeParagraphs(config.pastoresBio);
  const hasPastoralBlock = Boolean(
    config.pastoresFotoUrl || config.pastoresNomes || pastoresBioParagraphs.length > 0,
  );
  const hasBothSubcards = historiaParagraphs.length > 0 && visaoParagraphs.length > 0;

  return (
    <section
      id="sobre"
      className="border-b border-stone-200/80 bg-white py-14 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
          <div
            className={
              hasPastoralBlock
                ? 'min-w-0 space-y-8 lg:col-span-7'
                : 'min-w-0 space-y-8 lg:col-span-12'
            }
          >
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                <span>Nossa Identidade</span>
              </div>
              <h2 className="text-[clamp(1.625rem,1.25rem+1.4vw,2.375rem)] font-extrabold tracking-[-0.025em] text-zinc-950 [text-wrap:balance]">
                Conheça a {churchName}
              </h2>
            </div>

            {sobreParagraphs.length > 0 && (
              <div className="max-w-[65ch] space-y-3.5 text-base leading-relaxed text-stone-700 [text-wrap:pretty]">
                {sobreParagraphs.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            )}

            {(historiaParagraphs.length > 0 || visaoParagraphs.length > 0) && (
              <div
                className={
                  hasBothSubcards
                    ? 'grid grid-cols-1 gap-5 sm:grid-cols-2'
                    : 'grid grid-cols-1 gap-5'
                }
              >
                {historiaParagraphs.length > 0 && (
                  <div className="min-w-0 space-y-3 rounded-2xl border border-stone-200/90 bg-[#faf9f6] p-6">
                    <div className="flex items-center gap-3 text-sm font-bold text-zinc-950">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-amber-400">
                        <HeartHandshake className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <h3 className="[text-wrap:balance]">Nossa História</h3>
                    </div>
                    <div className="max-w-[65ch] space-y-2.5 text-sm leading-relaxed text-stone-600 [text-wrap:pretty]">
                      {historiaParagraphs.map((paragraph, idx) => (
                        <p key={idx}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                )}

                {visaoParagraphs.length > 0 && (
                  <div className="min-w-0 space-y-3 rounded-2xl border border-stone-200/90 bg-[#faf9f6] p-6">
                    <div className="flex items-center gap-3 text-sm font-bold text-zinc-950">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-amber-400">
                        <Compass className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <h3 className="[text-wrap:balance]">Visão e Valores</h3>
                    </div>
                    <div className="max-w-[65ch] space-y-2.5 text-sm leading-relaxed text-stone-600 [text-wrap:pretty]">
                      {visaoParagraphs.map((paragraph, idx) => (
                        <p key={idx}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {hasPastoralBlock && (
            <aside className="min-w-0 lg:col-span-5">
              <div className="overflow-hidden rounded-2xl border border-zinc-800/15 bg-zinc-950 text-zinc-100 shadow-lg">
                {config.pastoresFotoUrl && (
                  <div className="relative aspect-[4/3] w-full bg-zinc-900">
                    <Image
                      src={config.pastoresFotoUrl}
                      alt={config.pastoresNomes || 'Liderança Pastoral'}
                      fill
                      loading="lazy"
                      sizes="(max-width: 1024px) 100vw, 40vw"
                      className="object-cover"
                    />
                  </div>
                )}

                <div className="space-y-3 p-6">
                  <div className="flex items-center gap-3">
                    {!config.pastoresFotoUrl && (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-400/50 bg-zinc-900 text-amber-400">
                        <UserRound className="h-5 w-5" aria-hidden="true" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-400">
                        Liderança Pastoral
                      </p>
                      {config.pastoresNomes && (
                        <h3 className="mt-0.5 text-lg font-extrabold text-white [text-wrap:balance] sm:text-xl">
                          {config.pastoresNomes}
                        </h3>
                      )}
                    </div>
                  </div>

                  {pastoresBioParagraphs.length > 0 && (
                    <div className="max-w-[65ch] space-y-2 text-sm leading-relaxed text-zinc-300 [text-wrap:pretty]">
                      {pastoresBioParagraphs.map((paragraph, idx) => (
                        <p key={idx}>{paragraph}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}
