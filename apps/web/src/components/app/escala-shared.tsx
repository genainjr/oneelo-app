import { Escala, EscalaDia, EscalaItem, MinisterioFuncao } from '@/types';
import { STATUS_CONFIRMACAO_COLOR, STATUS_CONFIRMACAO_LABEL } from '@/lib/utils';
import { StatusBadge } from './status-badge';

export function getFuncoes(escala: Escala): MinisterioFuncao[] {
  return escala.ministerio?.funcoes || [];
}

export function getDias(escala: Escala): EscalaDia[] {
  return (escala.dias || []).slice().sort((a: any, b: any) => {
    const ordemDiff = (a.ordem ?? 0) - (b.ordem ?? 0);
    if (ordemDiff !== 0) return ordemDiff;
    return new Date(a.data).getTime() - new Date(b.data).getTime();
  });
}

export function getItens(dia: EscalaDia, funcaoId: string): EscalaItem[] {
  return (dia.itens || [])
    .filter((item) => item.ministerioFuncaoId === funcaoId)
    .sort((a, b) => (a.membro?.nome || '').localeCompare(b.membro?.nome || '', 'pt-BR'));
}

export function isFuncaoOculta(dia: EscalaDia, funcaoId: string) {
  return dia.funcoesOcultas?.some((oculta) => oculta.funcaoId === funcaoId) ?? false;
}

export function MemberChip({ item }: { item: EscalaItem }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-2 py-1 shadow-xs">
      <p className="text-xs font-bold leading-tight text-gray-900">{item.membro?.nome || '-'}</p>
      <StatusBadge
        label={STATUS_CONFIRMACAO_LABEL[item.statusConfirmacao]}
        className={`mt-1 px-1.5 py-0.5 text-[10px] font-bold ${STATUS_CONFIRMACAO_COLOR[item.statusConfirmacao]}`}
      />
    </div>
  );
}
