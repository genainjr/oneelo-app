'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Escala } from '@/types';
import { getDatePartsWithWeekday } from '@/lib/utils';
import { getDiaDisplayTitle, getFuncoes, getDias, getItens, isFuncaoOculta, MemberChip } from './escala-shared';

interface EscalaReadonlyGridProps {
  escala: Escala;
}

export function EscalaReadonlyGrid({ escala }: EscalaReadonlyGridProps) {
  const tGrid = useTranslations('schedules.grid');
  const funcoes = getFuncoes(escala);
  const dias = getDias(escala);
  const [diasMinimizados, setDiasMinimizados] = useState<Set<string>>(
    () => new Set(),
  );

  function toggleDiaMinimizado(diaId: string) {
    setDiasMinimizados((current) => {
      const next = new Set(current);
      if (next.has(diaId)) {
        next.delete(diaId);
      } else {
        next.add(diaId);
      }
      return next;
    });
  }

  if (funcoes.length === 0 || dias.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
        Esta escala ainda nao possui funcoes ou dias cadastrados.
      </div>
    );
  }

  return (
    <>
      <div className="hidden space-y-3 md:block">
        {dias.map((dia) => {
          const { weekday, date } = getDatePartsWithWeekday(dia.data, 'dd/MM/yyyy');
          const diaTitle = getDiaDisplayTitle(dia);
          const minimizado = diasMinimizados.has(dia.id);

          return (
            <section key={dia.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="flex items-start justify-between gap-4 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-xs font-bold uppercase text-indigo-600">{weekday}</p>
                  <p className="text-sm font-bold text-gray-900">{date}</p>
                  {diaTitle && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <p className="text-xs text-gray-500">{diaTitle}</p>
                      {dia.evento?.status === 'CANCELADO' && (
                        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                          {tGrid('eventStatus.CANCELADO')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleDiaMinimizado(dia.id)}
                  aria-expanded={!minimizado}
                  className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 shadow-xs transition hover:bg-gray-50"
                >
                  {minimizado ? 'Mostrar dia' : 'Minimizar dia'}
                </button>
              </div>

              {!minimizado && (
                <div className="overflow-x-auto border-t border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/60">
                        {funcoes.map((funcao) => (
                          <th key={funcao.id} className="min-w-[170px] px-3 py-3 text-left text-xs font-bold uppercase text-gray-500">
                            {funcao.nome}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="align-top">
                        {funcoes.map((funcao) => {
                          const itens = getItens(dia, funcao.id);
                          const oculto = isFuncaoOculta(dia, funcao.id);
                          return (
                            <td key={funcao.id} className="px-3 py-3">
                              {oculto ? (
                                <span className="text-xs font-semibold text-gray-300">Indisponivel</span>
                              ) : itens.length > 0 ? (
                                <div className="space-y-1.5">
                                  {itens.map((item) => <MemberChip key={item.id} item={item} />)}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-300">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="space-y-3 md:hidden">
        {dias.map((dia) => {
          const { weekday, date } = getDatePartsWithWeekday(dia.data, 'dd/MM/yyyy');
          const diaTitle = getDiaDisplayTitle(dia);
          const minimizado = diasMinimizados.has(dia.id);
          return (
            <section key={dia.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className={minimizado ? '' : 'mb-3'}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-indigo-600">{weekday}</p>
                    <p className="text-sm font-bold text-gray-900">{date}</p>
                    {diaTitle && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-xs text-gray-500">{diaTitle}</p>
                        {dia.evento?.status === 'CANCELADO' && (
                          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                            {tGrid('eventStatus.CANCELADO')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleDiaMinimizado(dia.id)}
                    aria-expanded={!minimizado}
                    className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 shadow-xs transition hover:bg-gray-50"
                  >
                    {minimizado ? 'Mostrar dia' : 'Minimizar dia'}
                  </button>
                </div>
              </div>
              {!minimizado && <div className="space-y-3">
                {funcoes.map((funcao) => {
                  const itens = getItens(dia, funcao.id);
                  const oculto = isFuncaoOculta(dia, funcao.id);
                  return (
                    <div key={funcao.id} className="border-t border-gray-100 pt-3">
                      <p className="mb-2 text-xs font-bold uppercase text-gray-500">{funcao.nome}</p>
                      {oculto ? (
                        <span className="text-xs font-semibold text-gray-300">Indisponivel</span>
                      ) : itens.length > 0 ? (
                        <div className="space-y-1.5">
                          {itens.map((item) => <MemberChip key={item.id} item={item} />)}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">Sem membro escalado</span>
                      )}
                    </div>
                  );
                })}
              </div>}
            </section>
          );
        })}
      </div>
    </>
  );
}
