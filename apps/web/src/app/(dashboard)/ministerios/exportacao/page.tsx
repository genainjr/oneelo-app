'use client';

import { useState } from 'react';
import { useMinisterios } from '@/hooks/use-ministerios';
import { PageHeader } from '@/components/app/page-header';
import { downloadCsv } from '@/lib/csv';

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
  const [selectedFields, setSelectedFields] = useState<string[]>(
    ALL_FIELDS.map((f) => f.key),
  );

  function toggleField(key: string) {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function handleExport() {
    const active = ALL_FIELDS.filter((f) => selectedFields.includes(f.key));
    const headers = active.map((f) => f.label);
    const rows = ministerios.map((m) =>
      active.map((f) => {
        if (f.key === 'ativo') return m.ativo ? 'Ativo' : 'Inativo';
        if (f.key === 'membros') return String(m._count?.membros ?? m.membros?.length ?? 0);
        if (f.key === 'funcoes') return String(m.funcoes?.length ?? 0);
        if (f.key === 'createdAt') return new Date(m.createdAt).toLocaleDateString('pt-BR');
        return (m as any)[f.key] ?? '';
      }),
    );
    downloadCsv(`ministerios-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Exportação de Ministérios"
        description="Selecione os campos e baixe a lista de ministérios em CSV."
      />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
        {/* Formato */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">Formato</p>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="format" defaultChecked className="accent-indigo-600" />
              <span className="text-sm text-gray-700">CSV</span>
            </label>
            <label className="flex items-center gap-2 cursor-not-allowed opacity-50">
              <input type="radio" name="format" disabled />
              <span className="text-sm text-gray-500">XLSX <span className="text-xs text-indigo-400 font-medium">(em breve)</span></span>
            </label>
          </div>
        </div>

        {/* Campos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Campos</p>
            <div className="flex gap-3 text-xs text-indigo-600">
              <button onClick={() => setSelectedFields(ALL_FIELDS.map((f) => f.key))} className="hover:underline">
                Selecionar todos
              </button>
              <button onClick={() => setSelectedFields([])} className="hover:underline">
                Limpar
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ALL_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={selectedFields.includes(f.key)}
                  onChange={() => toggleField(f.key)}
                  className="accent-indigo-600 w-4 h-4"
                />
                <span className="text-sm text-gray-700">{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Resumo */}
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 flex items-center gap-3">
          {loading ? (
            <span className="text-sm text-indigo-600">Carregando dados...</span>
          ) : (
            <>
              <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-indigo-700">
                <strong>{ministerios.length}</strong> ministério(s) · <strong>{selectedFields.length}</strong> campo(s) selecionado(s)
              </span>
            </>
          )}
        </div>

        {/* Botão */}
        <button
          onClick={handleExport}
          disabled={loading || selectedFields.length === 0 || ministerios.length === 0}
          className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar CSV
        </button>
      </div>
    </div>
  );
}
