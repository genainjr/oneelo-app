'use client';

import { useMinisterios } from '@/hooks/use-ministerios';
import { useExport } from '@/hooks/use-export';
import { ExportShell } from '@/components/app/export-shell';

const ALL_FIELDS = [
  { key: 'nome',      label: 'Nome' },
  { key: 'descricao', label: 'Descrição' },
  { key: 'ativo',     label: 'Status' },
  { key: 'membros',   label: 'Nº de membros' },
  { key: 'funcoes',   label: 'Nº de funções' },
  { key: 'createdAt', label: 'Criado em' },
];

export default function MinisteriosExportacaoPage() {
  const { ministerios, loading } = useMinisterios();

  const exportHook = useExport(
    ALL_FIELDS,
    ministerios,
    'ministerios',
    (m, f) => {
      if (f.key === 'ativo') return m.ativo ? 'Ativo' : 'Inativo';
      if (f.key === 'membros') return String(m._count?.membros ?? m.membros?.length ?? 0);
      if (f.key === 'funcoes') return String(m.funcoes?.length ?? 0);
      if (f.key === 'createdAt') return new Date(m.createdAt).toLocaleDateString('pt-BR');
      return (m as unknown as Record<string, unknown>)[f.key] as string ?? '';
    }
  );

  return (
    <ExportShell
      title="Exportação de Ministérios"
      description="Selecione os campos e baixe a lista de ministérios em CSV."
      fields={ALL_FIELDS}
      loading={loading}
      totalItems={ministerios.length}
      selectedFields={exportHook.selectedFields}
      onToggleField={exportHook.toggleField}
      onSelectAll={exportHook.selectAll}
      onClear={exportHook.clearAll}
      onExport={exportHook.handleExport}
      error={exportHook.error}
    />
  );
}
