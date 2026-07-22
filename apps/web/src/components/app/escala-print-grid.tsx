'use client';

import { Escala, EscalaDia } from '@/types';
import { formatDate } from '@/lib/utils';
import {
  getDias,
  getFuncoes,
  getItens,
  getMemberDisplayName,
  isFuncaoOculta,
} from './escala-shared';

interface EscalaPrintGridProps {
  escala: Escala;
}

const WEEKDAY_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

function getWeekdayLabel(dia: EscalaDia) {
  const date = new Date(dia.data);
  if (Number.isNaN(date.getTime())) return '-';
  return WEEKDAY_LABELS[date.getUTCDay()] ?? '-';
}

function isSundayDia(dia: EscalaDia) {
  const date = new Date(dia.data);
  return !Number.isNaN(date.getTime()) && date.getUTCDay() === 0;
}

function getDisplayName(item: NonNullable<ReturnType<typeof getItens>[number]>) {
  return getMemberDisplayName(item.membro);
}

function getMemberNames(dia: EscalaDia, funcaoId: string) {
  return getItens(dia, funcaoId)
    .map((item) => getDisplayName(item))
    .filter((nome): nome is string => Boolean(nome))
    .join(', ');
}

export function EscalaPrintGrid({ escala }: EscalaPrintGridProps) {
  const funcoes = getFuncoes(escala);
  const dias = getDias(escala);

  if (funcoes.length === 0 || dias.length === 0) {
    return (
      <div className="print-empty">
        Esta escala ainda nao possui funcoes ou dias cadastrados.
      </div>
    );
  }

  return (
    <div className="print-table-frame">
      <table className="print-schedule-table print-schedule-grid">
        <thead>
          <tr>
            <th className="print-day-column">Dia</th>
            <th className="print-date-column">Data</th>
            {funcoes.map((funcao) => (
              <th key={funcao.id}>{funcao.nome}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dias.map((dia) => (
            <tr key={dia.id}>
              <td className={`print-day-column${isSundayDia(dia) ? ' print-schedule-sunday-cell' : ''}`}>
                {getWeekdayLabel(dia)}
              </td>
              <td className={`print-date-column${isSundayDia(dia) ? ' print-schedule-sunday-cell' : ''}`}>
                {formatDate(dia.data, 'dd/MM/yyyy')}
              </td>
              {funcoes.map((funcao) => {
                const oculto = isFuncaoOculta(dia, funcao.id);
                const nomes = getMemberNames(dia, funcao.id);

                return (
                  <td key={funcao.id}>
                    {oculto ? 'Indisponivel' : nomes || '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
