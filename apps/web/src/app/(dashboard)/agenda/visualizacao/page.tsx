'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarDays, CircleDashed, Clock3, ListChecks, MapPin, TriangleAlert } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { useEventos } from '@/hooks/use-eventos';
import { useFilterState } from '@/hooks/use-filter-state';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { FilterShell, FilterActions } from '@/components/app/filter-shell';
import { FilterInput, FilterSelect } from '@/components/app/filter-field';
import { EmptyState } from '@/components/app/empty-state';
import { EntityCard } from '@/components/app/entity-card';
import { PrintScheduleFooter, PrintScheduleHeader } from '@/components/app/print-layout';
import { api } from '@/lib/api';
import { formatDate, STATUS_EVENTO_LABEL } from '@/lib/utils';
import type { AuthUser, Evento, StatusEvento } from '@/types';

const STATUS_OPTIONS: Array<{ value: '' | StatusEvento; labelKey: string }> = [
  { value: '', labelKey: 'filter.allStatuses' },
  { value: 'AGENDADO', labelKey: 'status.AGENDADO' },
  { value: 'REALIZADO', labelKey: 'status.REALIZADO' },
  { value: 'CANCELADO', labelKey: 'status.CANCELADO' },
];

const STATUS_VIEW_COLOR: Record<StatusEvento, string> = {
  AGENDADO: 'bg-blue-50 text-blue-700 border-blue-150',
  REALIZADO: 'bg-emerald-50 text-emerald-700 border-emerald-150',
  CANCELADO: 'bg-rose-50 text-rose-700 border-rose-150',
};

function toDateInputValue(date: Date) {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
}

export default function AgendaVisualizacaoPage() {
  const t = useTranslations('agenda');
  const [tenantName, setTenantName] = useState('OneElo');
  const [printedAt, setPrintedAt] = useState(() => new Date());

  const monthStart = useMemo(() => startOfMonth(new Date()), []);
  const monthEnd = useMemo(() => endOfMonth(new Date()), []);
  const initialFilter = useMemo(
    () => ({
      status: '',
      dataInicio: toDateInputValue(monthStart),
      dataFim: toDateInputValue(monthEnd),
    }),
    [monthStart, monthEnd],
  );

  const { eventos, loading, error, applyFilter, refetch } = useEventos(initialFilter);

  useEffect(() => {
    api.get<AuthUser>('/api/auth/me')
      .then((user) => setTenantName(user.tenant?.nome || 'OneElo'))
      .catch(() => setTenantName('OneElo'));
  }, []);

  const {
    formState: filterState,
    setField: setFilterField,
    handleClear: handleClearFilters,
    handleSubmit: handleFilterSubmit,
  } = useFilterState({
    initialState: initialFilter,
    onApply: (filters) => {
      applyFilter({
        status: filters.status || undefined,
        dataInicio: filters.dataInicio || undefined,
        dataFim: filters.dataFim || undefined,
      });
    },
  });

  const sortedEventos = useMemo(() => {
    return [...eventos].sort((a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime());
  }, [eventos]);

  const stats = useMemo(() => {
    const total = sortedEventos.length;
    const agendados = sortedEventos.filter((evento) => evento.status === 'AGENDADO').length;
    const realizados = sortedEventos.filter((evento) => evento.status === 'REALIZADO').length;
    const cancelados = sortedEventos.filter((evento) => evento.status === 'CANCELADO').length;
    return { total, agendados, realizados, cancelados };
  }, [sortedEventos]);

  function handlePrint() {
    setPrintedAt(new Date());
    window.setTimeout(() => window.print(), 0);
  }

  return (
    <div className="p-6">
      <div className="no-print space-y-6">
        <PageHeader
          title={t('view.pageTitle')}
          description={t('view.pageDescription')}
          action={(
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || sortedEventos.length === 0}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Imprimir
            </button>
          )}
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title={t('view.stats.total')} value={stats.total} icon={<CalendarDays className="w-5 h-5" />} color="indigo" />
          <StatCard title={t('view.stats.scheduled')} value={stats.agendados} icon={<CircleDashed className="w-5 h-5" />} color="blue" />
          <StatCard title={t('view.stats.completed')} value={stats.realizados} icon={<ListChecks className="w-5 h-5" />} color="emerald" />
          <StatCard title={t('view.stats.cancelled')} value={stats.cancelados} icon={<TriangleAlert className="w-5 h-5" />} color="rose" />
        </div>

        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between gap-4">
            <span>{error}</span>
            <button type="button" onClick={() => refetch()} className="font-semibold underline underline-offset-2">
              {t('reload')}
            </button>
          </div>
        )}

        <FilterShell
          onSubmit={handleFilterSubmit}
          actions={
            <FilterActions
              submitLabel={t('filter.apply')}
              clearLabel={t('filter.clear')}
              onClear={() => handleClearFilters()}
            />
          }
        >
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 items-end">
            <FilterSelect
              label={t('filter.statusLabel')}
              value={filterState.status}
              onChange={(event) => setFilterField('status', event.target.value as '' | StatusEvento)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {t(option.labelKey as any)}
                </option>
              ))}
            </FilterSelect>

            <FilterInput
              label={t('filter.from')}
              type="date"
              value={filterState.dataInicio}
              onChange={(event) => setFilterField('dataInicio', event.target.value)}
            />

            <FilterInput
              label={t('filter.to')}
              type="date"
              value={filterState.dataFim}
              onChange={(event) => setFilterField('dataFim', event.target.value)}
            />
          </div>
        </FilterShell>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <EntityCard key={index} loading />
            ))}
          </div>
        ) : sortedEventos.length === 0 ? (
          <EmptyState
            title={t('view.emptyTitle')}
            description={t('view.emptyDescription')}
            action={
              <button
                type="button"
                onClick={() => handleClearFilters()}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50"
              >
                {t('filter.clear')}
              </button>
            }
          />
        ) : (
          <div className="space-y-4">
            {sortedEventos.map((evento: Evento) => {
              const statusLabel = STATUS_EVENTO_LABEL[evento.status];
              const statusClass = STATUS_VIEW_COLOR[evento.status];

              return (
                <EntityCard
                  key={evento.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex px-2.5 py-0.5 text-xs font-bold border rounded-lg ${statusClass}`}>
                        {statusLabel}
                      </span>
                      <h3 className="text-base font-bold text-gray-800 tracking-tight">{evento.titulo}</h3>
                    </div>

                    {evento.descricao && (
                      <p className="text-sm text-gray-500 max-w-3xl">{evento.descricao}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-400 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-3.5 w-3.5 text-gray-400" />
                        {t('event.start')}: {formatDate(evento.dataInicio, 'dd/MM/yyyy HH:mm')}
                      </span>
                      {evento.dataFim && (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5 text-gray-400" />
                          {t('event.end')}: {formatDate(evento.dataFim, 'dd/MM/yyyy HH:mm')}
                        </span>
                      )}
                      {evento.local && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-gray-400" />
                          {evento.local}
                        </span>
                      )}
                    </div>
                  </div>
                </EntityCard>
              );
            })}
          </div>
        )}
      </div>

      {!loading && sortedEventos.length > 0 && (
        <div className="print-area hidden" aria-hidden="true">
          <section className="print-page">
            <PrintScheduleHeader
              title={tenantName}
              subtitle={`Agenda - ${formatDate(filterState.dataInicio, 'dd/MM/yyyy')} a ${formatDate(filterState.dataFim, 'dd/MM/yyyy')}`}
            />
            <AgendaPrintTable eventos={sortedEventos} />
            <PrintScheduleFooter printedAt={printedAt} />
          </section>
        </div>
      )}
    </div>
  );
}

function AgendaPrintTable({ eventos }: { eventos: Evento[] }) {
  return (
    <table className="print-schedule-table print-events-table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Evento</th>
          <th>Status</th>
          <th>Local</th>
          <th>Descricao</th>
        </tr>
      </thead>
      <tbody>
        {eventos.map((evento) => (
          <tr key={evento.id}>
            <td>{formatDate(evento.dataInicio, 'dd/MM/yyyy HH:mm')}</td>
            <td>{evento.titulo}</td>
            <td>{STATUS_EVENTO_LABEL[evento.status]}</td>
            <td>{evento.local || '-'}</td>
            <td>{evento.descricao || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
