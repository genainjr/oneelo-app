import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Calendar, Newspaper, Star } from 'lucide-react';
import type { PublicTenantNews } from '@/lib/api-website';

function formatNewsDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function SiteNewsSection({
  slug,
  news,
  basePath,
}: {
  slug: string;
  news: PublicTenantNews[];
  basePath?: string;
}) {
  if (news.length === 0) return null;

  const prefix = basePath !== undefined ? basePath : `/${slug}`;

  return (
    <section
      id="noticias"
      className="border-b border-stone-200/80 bg-[#faf9f6] py-14 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-2xl space-y-2.5">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
            <Newspaper className="h-4 w-4" aria-hidden="true" />
            <span>Vida em Comunidade</span>
          </div>
          <h2 className="text-[clamp(1.625rem,1.25rem+1.4vw,2.375rem)] font-extrabold tracking-[-0.025em] text-zinc-950 [text-wrap:balance]">
            Informativos e Comunicados
          </h2>
          <p className="max-w-[65ch] text-sm leading-relaxed text-stone-600 [text-wrap:pretty] sm:text-base">
            Acompanhe os avisos recentes, conferências, batismos e programações especiais da igreja.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {news.map((item) => (
            <li key={item.id} className="min-w-0">
              <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-2xs transition duration-200 hover:-translate-y-0.5 hover:border-zinc-900/20 hover:shadow-md">
                <Link
                  href={`${prefix}/noticias/${item.slug}`}
                  className="relative block aspect-[16/10] w-full overflow-hidden bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-inset"
                >
                  {item.imagemUrl ? (
                    <Image
                      src={item.imagemUrl}
                      alt={item.titulo}
                      fill
                      loading="lazy"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-800 text-amber-400/70">
                      <Newspaper className="h-10 w-10" aria-hidden="true" />
                    </div>
                  )}

                  {item.destaque && (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-zinc-950/90 px-3 py-1 text-[11px] font-bold text-amber-400 shadow-xs ring-1 ring-amber-400/40 backdrop-blur-sm">
                      <Star className="h-3 w-3 fill-amber-400" aria-hidden="true" />
                      Destaque
                    </span>
                  )}
                </Link>

                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                    <time dateTime={item.dataPublicacao}>
                      {formatNewsDate(item.dataPublicacao)}
                    </time>
                  </div>

                  <h3 className="mt-2.5 text-lg font-bold leading-snug text-zinc-950 [text-wrap:balance]">
                    <Link
                      href={`${prefix}/noticias/${item.slug}`}
                      className="rounded-sm transition-colors hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                    >
                      {item.titulo}
                    </Link>
                  </h3>

                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-stone-600 [text-wrap:pretty]">
                    {item.resumo || item.conteudo}
                  </p>

                  <div className="mt-auto border-t border-stone-100 pt-4">
                    <Link
                      href={`${prefix}/noticias/${item.slug}`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full text-sm font-bold text-zinc-950 transition hover:text-amber-700 group-hover:gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                    >
                      <span>Ler comunicado</span>
                      <ArrowRight className="h-4 w-4 text-amber-600" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
