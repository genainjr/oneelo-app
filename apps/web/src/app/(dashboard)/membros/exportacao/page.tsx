'use client';

import { useMembros } from '@/hooks/use-membros';
import { useExport } from '@/hooks/use-export';
import { ExportShell } from '@/components/app/export-shell';
import { formatDate } from '@/lib/utils';

const ALL_FIELDS = [
  { key: 'nome',          label: 'Nome' },
  { key: 'email',         label: 'E-mail' },
  { key: 'whatsapp',      label: 'WhatsApp' },
  { key: 'status',        label: 'Status' },
  { key: 'dataNascimento',label: 'Data de nascimento' },
  { key: 'createdAt',     label: 'Data de entrada' },
  { key: 'tags',          label: 'Tags' },
];

const STATUS_LABEL: Record<string, string> = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  ARQUIVADO: 'Arquivado',
};

export default function MembrosExportacaoPage() {
  const { membros, loading } = useMembros();

  const exportHook = useExport(
    ALL_FIELDS,
    membros,
    'membros',
    (m, f) => {
      if (f.key === 'tags') return m.tags?.map((t: { tag: { nome: string } }) => t.tag.nome).join('; ') ?? '';
      if (f.key === 'status') return STATUS_LABEL[m.status] ?? m.status;
      if (f.key === 'dataNascimento') return m.dataNascimento ? formatDate(new Date(m.dataNascimento)) : '';
      if (f.key === 'createdAt') return formatDate(new Date(m.createdAt));
      return (m as unknown as Record<string, unknown>)[f.key] as string ?? '';
    }
  );

  return (
    <ExportShell
      title="Exportação de Membros"
      description="Selecione os campos e baixe a lista de membros em CSV."
      fields={ALL_FIELDS}
      loading={loading}
      totalItems={membros.length}
      selectedFields={exportHook.selectedFields}
      onToggleField={exportHook.toggleField}
      onSelectAll={exportHook.selectAll}
      onClear={exportHook.clearAll}
      onExport={exportHook.handleExport}
      error={exportHook.error}
    />
  );
}
