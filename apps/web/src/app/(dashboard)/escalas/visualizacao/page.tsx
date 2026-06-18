'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { SkeletonList } from '@/components/app/skeleton';
import { EmptyState } from '@/components/app/empty-state';
import { EscalaReadonlyGrid } from '@/components/app/escala-readonly-grid';
import { FilterShell, FilterActions } from '@/components/app/filter-shell';
import { StatCard } from '@/components/app/stat-card';
import { StatusBadge } from '@/components/app/status-badge';
import { useFilterState } from '@/hooks/use-filter-state';
import { useEscalasVisualizacao } from '@/hooks/use-escalas-visualizacao';
import { api } from '@/lib/api';
import { STATUS_ESCALA_COLOR, STATUS_ESCALA_LABEL } from '@/lib/utils';
import { Ministerio } from '@/types';
import { Calendar, List, AlertTriangle } from 'lucide-react';

const MESES = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Marco' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

export default function EscalasVisualizacaoPage() {
  const now = new Date();
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const { escalas, loading, error, applyFilter, refetch } = useEscalasVisualizacao({
    mes: String(now.getMonth() + 1),
    ano: String(now.getFullYear()),
  });

  const {
    formState: filterState,
    setField: setFilterField,
    handleClear: handleClearFilters,
    handleSubmit: handleFilterSubmit,
  } = useFilterState({
    initialState: {
      ministerioId: '',
      status: '',
      mes: String(now.getMonth() + 1),
      ano: String(now.getFullYear()),
      pendentesApenas: false,
    },
    onApply: (filters) => {
      applyFilter({
        ministerioId: filters.ministerioId || undefined,
        status: filters.status || undefined,
        mes: filters.mes || undefined,
        ano: filters.ano || undefined,
        pendentesApenas: filters.pendentesApenas ? 'true' : undefined,
      });
    },
  });

  useEffect(() => {
    api.get<Ministerio[]>('/api/ministerios')
      .then((data) => setMinisterios(Array.isArray(data) ? data : []))
      .catch(() => setMinisterios([]));
  }, []);

  const totais = useMemo(() => {
    const dias = escalas.reduce((acc, escala) => acc + (escala.dias?.length || 0), 0);
    const itens = escalas.reduce((acc, escala) => (
      acc + (escala.dias || []).reduce((diaAcc, dia) => diaAcc + (dia.itens?.length || 0), 0)
    ), 0);
    const pendentes = escalas.reduce((acc, escala) => (
      acc + (escala.dias || []).reduce((diaAcc, dia) => (
        diaAcc + (dia.itens || []).filter((item) => item.statusConfirmacao === 'PENDENTE').length
      ), 0)
    ), 0);
    return { dias, itens, pendentes };
  }, [escalas]);

  return (
    <div className="p-6">
      <PageHeader
        title="Visualizacao de escalas"
        description="Acompanhe as escalas publicadas ou em rascunho em formato de leitura, sem controles de montagem."
        action={(
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50"
          >
            Imprimir
          </button>
        )}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard title="Escalas" value={escalas.length} icon={<Calendar className="w-5 h-5" />} color="indigo" />
        <StatCard title="Dias" value={totais.dias} icon={<List className="w-5 h-5" />} color="blue" />
        <StatCard title="Pendencias" value={totais.pendentes} icon={<AlertTriangle className="w-5 h-5" />} color="amber" />
      </div>

      <FilterShell
        onSubmit={handleFilterSubmit}
        actions={
          <FilterActions
            submitLabel="Filtrar"
            clearLabel="Limpar"
            reloadLabel="Recarregar"
            onClear={() => handleClearFilters()}
            onReload={refetch}
          />
        }
      >
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-5 items-center">
          <select
            value={filterState.ministerioId}
            onChange={(event) => setFilterField('ministerioId', event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-gray-50 focus:bg-white transition-all w-full"
          >
            <option value="">Todos os ministerios</option>
            {ministerios.map((ministerio) => (
              <option key={ministerio.id} value={ministerio.id}>{ministerio.nome}</option>
            ))}
          </select>
          <select
            value={filterState.status}
            onChange={(event) => setFilterField('status', event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-gray-50 focus:bg-white transition-all w-full"
          >
            <option value="">Todos os status</option>
            <option value="RASCUNHO">Rascunho</option>
            <option value="PUBLICADA">Publicada</option>
            <option value="ENCERRADA">Encerrada</option>
          </select>
          <select
            value={filterState.mes}
            onChange={(event) => setFilterField('mes', event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-gray-50 focus:bg-white transition-all w-full"
          >
            {MESES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <input
            type="number"
            min="2020"
            max="2100"
            value={filterState.ano}
            onChange={(event) => setFilterField('ano', event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-gray-50 focus:bg-white transition-all w-full"
          />
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors w-full cursor-pointer">
            <input
              type="checkbox"
              checked={filterState.pendentesApenas}
              onChange={(event) => setFilterField('pendentesApenas', event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
            />
            Pendentes
          </label>
        </div>
      </FilterShell>

      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <SkeletonList count={2} className="h-64" />
      ) : escalas.length === 0 ? (
        <EmptyState title="Nenhuma escala encontrada" description="Ajuste os filtros para localizar outras escalas." />
      ) : (
        <div className="space-y-6">
          {escalas.map((escala) => {
            const participacoes = (escala.dias || []).reduce((acc, dia) => acc + (dia.itens?.length || 0), 0);
            return (
              <section key={escala.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-indigo-600">{escala.ministerio?.nome || 'Ministerio'}</p>
                    <h2 className="text-lg font-black text-gray-900">
                      {MESES.find((item) => item.value === String(escala.mes))?.label || escala.mes} de {escala.ano}
                    </h2>
                    {escala.observacoes && <p className="mt-1 text-sm text-gray-500">{escala.observacoes}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={STATUS_ESCALA_LABEL[escala.status]}
                      className={`px-2.5 py-1 font-bold ${STATUS_ESCALA_COLOR[escala.status]}`}
                    />
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
                      {participacoes} participacoes
                    </span>
                  </div>
                </div>
                <EscalaReadonlyGrid escala={escala} />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
