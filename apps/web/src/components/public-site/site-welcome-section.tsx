import Link from 'next/link';
import { ArrowRight, HeartHandshake, LogIn, Sparkles, UserPlus } from 'lucide-react';

export function SiteWelcomeSection({
  churchName,
  basePath,
  slug,
  membersLoginHref = '/login',
}: {
  churchName: string;
  basePath?: string;
  slug: string;
  membersLoginHref?: string;
}) {
  const cadastroHref =
    basePath !== undefined ? `${basePath}/cadastro` : `/${slug}/cadastro`;

  return (
    <section
      aria-labelledby="bem-vindo-titulo"
      className="border-b border-stone-200/80 bg-white py-14 sm:py-18"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="min-w-0 space-y-3 lg:col-span-5">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>Conexão & Acolhimento</span>
            </div>
            <h2
              id="bem-vindo-titulo"
              className="text-[clamp(1.625rem,1.25rem+1.4vw,2.25rem)] font-extrabold tracking-[-0.025em] text-zinc-950 [text-wrap:balance]"
            >
              Caminhe com a nossa comunidade
            </h2>
            <p className="max-w-[48ch] text-sm leading-relaxed text-stone-600 [text-wrap:pretty] sm:text-base">
              Seja em sua primeira visita ou já fazendo parte da {churchName}, preparamos um canal simples para cuidar de você e da sua família.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7">
            <div className="flex flex-col justify-between gap-5 rounded-2xl border border-stone-200/90 bg-[#faf9f6] p-6 transition hover:border-amber-400/60 hover:shadow-sm">
              <div className="space-y-2.5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 text-amber-400">
                  <HeartHandshake className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-bold tracking-tight text-zinc-950 [text-wrap:balance]">
                  Primeira vez aqui?
                </h3>
                <p className="text-sm leading-relaxed text-stone-600 [text-wrap:pretty]">
                  Preencha sua ficha de visitante ou solicitação de integração em menos de 1 minuto.
                </p>
              </div>

              <Link
                href={cadastroHref}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                <UserPlus className="h-4 w-4 text-amber-400" aria-hidden="true" />
                <span>Fazer Cadastro</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="flex flex-col justify-between gap-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-white shadow-sm">
              <div className="space-y-2.5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/40 bg-zinc-900 text-amber-400">
                  <LogIn className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-bold tracking-tight text-white [text-wrap:balance]">
                  Já faz parte da igreja?
                </h3>
                <p className="text-sm leading-relaxed text-zinc-300 [text-wrap:pretty]">
                  Entre no portal para acompanhar escalas, agenda, comunicados e seus dados de membro.
                </p>
              </div>

              <a
                href={membersLoginHref}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span>Área de Membros</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
