import { Escala, EscalaDia, EscalaItem, MinisterioFuncao } from '@/types';
import { STATUS_CONFIRMACAO_COLOR, STATUS_CONFIRMACAO_LABEL } from '@/lib/utils';
import { StatusBadge } from './status-badge';

type OrderedEscalaDia = EscalaDia & { ordem?: number };

export const MONTH_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export function getFuncoes(escala: Escala): MinisterioFuncao[] {
  return escala.ministerio?.funcoes || [];
}

export function getDias(escala: Escala): EscalaDia[] {
  return (escala.dias || []).slice().sort((a: OrderedEscalaDia, b: OrderedEscalaDia) => {
    const ordemDiff = (a.ordem ?? 0) - (b.ordem ?? 0);
    if (ordemDiff !== 0) return ordemDiff;
    return new Date(a.data).getTime() - new Date(b.data).getTime();
  });
}

export function getItens(dia: EscalaDia, funcaoId: string): EscalaItem[] {
  return (dia.itens || [])
    .filter((item) => item.ministerioFuncaoId === funcaoId)
    .sort((a, b) => getMemberDisplayName(a.membro).localeCompare(getMemberDisplayName(b.membro), 'pt-BR'));
}

export function isFuncaoOculta(dia: EscalaDia, funcaoId: string) {
  return dia.funcoesOcultas?.some((oculta) => oculta.funcaoId === funcaoId) ?? false;
}

export function getDiaDisplayTitle(dia: Pick<EscalaDia, 'titulo' | 'evento'>) {
  const titulo = dia.titulo?.trim();
  if (titulo) return titulo;

  const eventoTitulo = dia.evento?.titulo?.trim();
  return eventoTitulo || '';
}

export function getMemberDisplayName(member?: { nome?: string | null; nomeExibicao?: string | null } | null) {
  const nomeExibicao = member?.nomeExibicao?.trim();
  if (nomeExibicao) return nomeExibicao;

  const nomeCompleto = member?.nome?.trim();
  if (!nomeCompleto) return '-';

  const primeiroNome = nomeCompleto.split(/\s+/)[0]?.trim();
  return primeiroNome || nomeCompleto;
}

export function MemberChip({ item }: { item: EscalaItem }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-2 py-1 shadow-xs">
      <p className="text-xs font-bold leading-tight text-gray-900">{getMemberDisplayName(item.membro)}</p>
      <StatusBadge
        label={STATUS_CONFIRMACAO_LABEL[item.statusConfirmacao]}
        className={`mt-1 px-1.5 py-0.5 text-[10px] font-bold ${STATUS_CONFIRMACAO_COLOR[item.statusConfirmacao]}`}
      />
    </div>
  );
}
