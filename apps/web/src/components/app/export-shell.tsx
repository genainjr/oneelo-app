import { PageHeader } from '@/components/app/page-header';

export interface ExportField {
  key: string;
  label: string;
}

export interface ExportShellProps {
  title: string;
  description: string;
  fields: ExportField[];
  selectedFields: string[];
  onToggleField: (key: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onExport: () => void;
  loading: boolean;
  totalItems: number;
  error?: string | null;
}

export function ExportShell({
  title,
  description,
  fields,
  selectedFields,
  onToggleField,
  onSelectAll,
  onClear,
  onExport,
  loading,
  totalItems,
  error,
}: ExportShellProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title={title}
        description={description}
      />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
        {error && (
          <div className="p-4 rounded-xl border border-red-100 bg-red-50 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

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
              <button onClick={onSelectAll} className="hover:underline">
                Selecionar todos
              </button>
              <button onClick={onClear} className="hover:underline">
                Limpar
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {fields.map((f) => (
              <label key={f.key} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={selectedFields.includes(f.key)}
                  onChange={() => onToggleField(f.key)}
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
                <strong>{totalItems}</strong> registro(s) · <strong>{selectedFields.length}</strong> campo(s) selecionado(s)
              </span>
            </>
          )}
        </div>

        {/* Botão */}
        <button
          onClick={onExport}
          disabled={loading || selectedFields.length === 0 || totalItems === 0}
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
