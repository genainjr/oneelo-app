import { useState, useCallback } from 'react';
import { downloadCsv } from '@/lib/csv';
import { ExportField } from '@/components/app/export-shell';

export function useExport<T>(
  allFields: ExportField[],
  data: T[],
  filenamePrefix: string,
  rowMapper: (item: T, field: ExportField) => string
) {
  const [selectedFields, setSelectedFields] = useState<string[]>(
    allFields.map((f) => f.key)
  );
  const [error, setError] = useState<string | null>(null);

  const toggleField = useCallback((key: string) => {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelectedFields(allFields.map((f) => f.key));
  }, [allFields]);

  const clearAll = useCallback(() => {
    setSelectedFields([]);
  }, []);

  const handleExport = useCallback(() => {
    setError(null);
    try {
      const active = allFields.filter((f) => selectedFields.includes(f.key));
      if (active.length === 0) {
        throw new Error('Nenhum campo selecionado.');
      }
      if (!data || data.length === 0) {
        throw new Error('Nenhum dado para exportar.');
      }
      
      const headers = active.map((f) => f.label);
      const rows = data.map((item) =>
        active.map((f) => rowMapper(item, f))
      );
      
      const filename = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCsv(filename, headers, rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao gerar exportação.');
    }
  }, [allFields, selectedFields, data, filenamePrefix, rowMapper]);

  return {
    selectedFields,
    toggleField,
    selectAll,
    clearAll,
    handleExport,
    error,
  };
}
