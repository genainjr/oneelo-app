'use client';

import { useEventos } from '@/hooks/use-eventos';
import { useExport } from '@/hooks/use-export';
import { ExportShell } from '@/components/app/export-shell';

const ALL_FIELDS = [
  { key: 'titulo',    label: 'Título' },
  { key: 'dataInicio',label: 'Data de início' },
  { key: 'dataFim',   label: 'Data de término' },
  { key: 'local',     label: 'Local' },
  { key: 'status',    label: 'Status' },
  { key: 'descricao', label: 'Descrição' },
  { key: 'createdAt', label: 'Criado em' },
];

const STATUS_LABEL: Record<string, string> = {
  AGENDADO: 'Agendado',
  REALIZADO: 'Realizado',
  CANCELADO: 'Cancelado',
};

export default function AgendaExportacaoPage() {
  const { eventos, loading } = useEventos();

  const exportHook = useExport(
    ALL_FIELDS,
    eventos,
    'agenda',
    (ev, f) => {
      if (f.key === 'status') return STATUS_LABEL[ev.status] ?? ev.status;
      if (f.key === 'dataInicio') return new Date(ev.dataInicio).toLocaleDateString('pt-BR');
      if (f.key === 'dataFim') return ev.dataFim ? new Date(ev.dataFim).toLocaleDateString('pt-BR') : '';
      if (f.key === 'createdAt') return new Date(ev.createdAt).toLocaleDateString('pt-BR');
      return (ev as unknown as Record<string, unknown>)[f.key] as string ?? '';
    }
  );

  return (
    <ExportShell
      title="Exportação de Agenda"
      description="Selecione os campos e baixe a lista de eventos em CSV."
      fields={ALL_FIELDS}
      loading={loading}
      totalItems={eventos.length}
      selectedFields={exportHook.selectedFields}
      onToggleField={exportHook.toggleField}
      onSelectAll={exportHook.selectAll}
      onClear={exportHook.clearAll}
      onExport={exportHook.handleExport}
      error={exportHook.error}
    />
  );
}
