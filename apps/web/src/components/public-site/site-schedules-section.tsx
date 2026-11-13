import { CalendarClock } from 'lucide-react';
import type { ModalidadeCulto, PublicChurchSchedule } from '@/lib/api-website';
import { formatWeekdayLabel } from './site-utils';

const MODALIDADE_META: Record<
  ModalidadeCulto,
  { label: string; dotClassName: string; badgeClassName: string }
> = {
  PRESENCIAL: {
    label: 'Presencial',
    dotClassName: 'bg-emerald-400',
    badgeClassName: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  ONLINE: {
    label: 'Online',
    dotClassName: 'bg-sky-400',
    badgeClassName: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  },
  HIBRIDO: {
    label: 'Híbrido',
    dotClassName: 'bg-amber-400',
    badgeClassName: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
};

export function SiteSchedulesSection({
  schedules,
}: {
  schedules: PublicChurchSchedule[];
}) {
  if (schedules.length === 0) return null;

  return (
    <section
      id="cultos"
      className="border-b border-zinc-800/90 bg-[#0d0d11] py-14 text-white sm:py-18 lg:py-22"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-9 flex flex-col gap-3 sm:mb-11 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-400">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              <span>Programação Semanal</span>
            </div>
            <h2 className="text-[clamp(1.625rem,1.25rem+1.4vw,2.375rem)] font-extrabold tracking-[-0.025em] text-white [text-wrap:balance]">
              Horários dos Nossos Cultos
            </h2>
            <p className="max-w-[56ch] text-sm leading-relaxed text-zinc-400 [text-wrap:pretty] sm:text-base">
              Escolha o melhor dia para estar conosco presencialmente ou acompanhar nossas reuniões.
            </p>
          </div>
        </div>

        <ul className="grid grid-cols-1 divide-y divide-zinc-800/80 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/65 md:grid-cols-2 md:gap-5 md:divide-y-0 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent lg:grid-cols-3">
          {schedules.map((schedule) => {
            const mode = MODALIDADE_META[schedule.modalidade];
            return (
              <li
                key={schedule.id}
                className="flex items-start gap-4 p-4 transition hover:bg-zinc-900/90 md:flex-col md:justify-between md:gap-6 md:rounded-2xl md:border md:border-zinc-800 md:bg-zinc-900/75 md:p-6 md:hover:border-amber-400/50 md:hover:bg-zinc-900"
              >
                <div className="flex shrink-0 flex-col items-center justify-center rounded-xl border border-zinc-700/80 bg-zinc-950/90 px-3 py-2 text-center md:flex md:w-full md:flex-row md:items-center md:justify-between md:border-0 md:bg-transparent md:p-0 md:text-left">
                  <span className="hidden text-xs font-bold uppercase tracking-[0.14em] text-amber-400 md:inline">
                    {formatWeekdayLabel(schedule.diaSemana)}
                  </span>
                  <span className="text-lg font-extrabold tabular-nums tracking-tight text-white md:hidden">
                    {schedule.horario}
                  </span>
                  <span
                    className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold md:inline-flex ${mode.badgeClassName}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${mode.dotClassName}`}
                      aria-hidden="true"
                    />
                    {mode.label}
                  </span>
                </div>

                <div className="min-w-0 flex-1 space-y-1.5 md:w-full md:space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 md:hidden">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-400">
                      {formatWeekdayLabel(schedule.diaSemana)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${mode.badgeClassName}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${mode.dotClassName}`}
                        aria-hidden="true"
                      />
                      {mode.label}
                    </span>
                  </div>

                  <p className="hidden text-4xl font-extrabold tabular-nums tracking-tight text-white md:block">
                    {schedule.horario}
                  </p>

                  <h3 className="text-base font-bold leading-snug text-white sm:text-lg">
                    {schedule.titulo}
                  </h3>

                  {schedule.descricao && (
                    <p className="text-sm leading-relaxed text-zinc-400 [text-wrap:pretty]">
                      {schedule.descricao}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
