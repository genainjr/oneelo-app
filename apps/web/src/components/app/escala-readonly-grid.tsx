'use client';

import { Escala } from '@/types';
import { getDatePartsWithWeekday } from '@/lib/utils';
import { getDiaDisplayTitle, getFuncoes, getDias, getItens, isFuncaoOculta, MemberChip } from './escala-shared';

interface EscalaReadonlyGridProps {
  escala: Escala;
}

export function EscalaReadonlyGrid({ escala }: EscalaReadonlyGridProps) {
  const funcoes = getFuncoes(escala);
  const dias = getDias(escala);

  if (funcoes.length === 0 || dias.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
        Esta escala ainda nao possui funcoes ou dias cadastrados.
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white md:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="sticky left-0 z-10 w-32 bg-gray-50 px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">
                Data
              </th>
              {funcoes.map((funcao) => (
                <th key={funcao.id} className="min-w-[170px] px-3 py-3 text-left text-xs font-bold uppercase text-gray-500">
                  {funcao.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dias.map((dia) => {
              const { weekday, date } = getDatePartsWithWeekday(dia.data, 'dd/MM');
              const diaTitle = getDiaDisplayTitle(dia);
              return (
                <tr key={dia.id} className="align-top">
                  <td className="sticky left-0 z-10 border-r border-gray-100 bg-white px-4 py-3">
                    <p className="text-xs font-bold uppercase text-indigo-600">{weekday}</p>
                    <p className="text-sm font-bold text-gray-900">{date}</p>
                    {diaTitle && <p className="mt-0.5 text-xs text-gray-500">{diaTitle}</p>}
                  </td>
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
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {dias.map((dia) => {
          const { weekday, date } = getDatePartsWithWeekday(dia.data, 'dd/MM/yyyy');
          const diaTitle = getDiaDisplayTitle(dia);
          return (
            <section key={dia.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-3">
                <p className="text-xs font-bold uppercase text-indigo-600">{weekday}</p>
                <p className="text-sm font-bold text-gray-900">{date}</p>
                {diaTitle && <p className="text-xs text-gray-500">{diaTitle}</p>}
              </div>
              <div className="space-y-3">
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
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
