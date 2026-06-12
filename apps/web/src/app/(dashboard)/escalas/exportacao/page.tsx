'use client';

import { useEscalas } from '@/hooks/use-escalas';
import { useExport } from '@/hooks/use-export';
import { ExportShell } from '@/components/app/export-shell';

const ALL_FIELDS = [
  { key: 'ministerio', label: 'Ministério' },
  { key: 'mes',        label: 'Mês' },
  { key: 'ano',        label: 'Ano' },
  { key: 'status',     label: 'Status' },
  { key: 'dias',       label: 'Nº de dias' },
  { key: 'observacoes',label: 'Observações' },
  { key: 'createdAt',  label: 'Criado em' },
];

const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  PUBLICADA: 'Publicada',
  ENCERRADA: 'Encerrada',
};

const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function EscalasExportacaoPage() {
  const { escalas, loading } = useEscalas();

  const exportHook = useExport(
    ALL_FIELDS,
    escalas,
    'escalas',
    (e, f) => {
      if (f.key === 'ministerio') return e.ministerio?.nome ?? '';
      if (f.key === 'mes') return MESES[e.mes] ?? String(e.mes);
      if (f.key === 'ano') return String(e.ano);
      if (f.key === 'status') return STATUS_LABEL[e.status] ?? e.status;
      if (f.key === 'dias') return String(e._count?.dias ?? e.dias?.length ?? 0);
      if (f.key === 'observacoes') return e.observacoes ?? '';
      if (f.key === 'createdAt') return new Date(e.createdAt).toLocaleDateString('pt-BR');
      return '';
    }
  );

  return (
    <ExportShell
      title="Exportação de Escalas"
      description="Selecione os campos e baixe a lista de escalas em CSV."
      fields={ALL_FIELDS}
      loading={loading}
      totalItems={escalas.length}
      selectedFields={exportHook.selectedFields}
      onToggleField={exportHook.toggleField}
      onSelectAll={exportHook.selectAll}
      onClear={exportHook.clearAll}
      onExport={exportHook.handleExport}
      error={exportHook.error}
    />
  );
}
