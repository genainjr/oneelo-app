'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarDays, Clock3, MapPin, TriangleAlert, ListChecks, CircleDashed } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { useEventos } from '@/hooks/use-eventos';
import { useFilterState } from '@/hooks/use-filter-state';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { FilterShell, FilterActions } from '@/components/app/filter-shell';
import { FilterInput, FilterSelect } from '@/components/app/filter-field';
import { EmptyState } from '@/components/app/empty-state';
import { EntityCard } from '@/components/app/entity-card';
import { StatusBadge } from '@/components/app/status-badge';
import { formatDate, STATUS_EVENTO_COLOR, STATUS_EVENTO_LABEL } from '@/lib/utils';
import type { Evento, StatusEvento } from '@/types';

const STATUS_OPTIONS: Array<{ value: '' | StatusEvento; labelKey: string }> = [
  { value: '', labelKey: 'filter.allStatuses' },
  { value: 'AGENDADO', labelKey: 'status.AGENDADO' },
  { value: 'REALIZADO', labelKey: 'status.REALIZADO' },
  { value: 'CANCELADO', labelKey: 'status.CANCELADO' },
];

function toDateInputValue(date: Date) {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
}

export default function AgendaVisualizacaoPage() {
  const t = useTranslations('agenda');

  const monthStart = useMemo(() => startOfMonth(new Date()), []);
  const monthEnd = useMemo(() => endOfMonth(new Date()), []);
  const initialFilter = useMemo(() => ({
    status: '',
    dataInicio: toDateInputValue(monthStart),
    dataFim: toDateInputValue(monthEnd),
  }), [monthStart, monthEnd]);

  const { eventos, loading, error, applyFilter, refetch } = useEventos(initialFilter);

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
    return [...eventos].sort((a, b) => {
      const startA = new Date(a.dataInicio).getTime();
      const startB = new Date(b.dataInicio).getTime();
      return startA - startB;
    });
  }, [eventos]);

  const stats = useMemo(() => {
    const total = sortedEventos.length;
    const agendados = sortedEventos.filter((evento) => evento.status === 'AGENDADO').length;
    const realizados = sortedEventos.filter((evento) => evento.status === 'REALIZADO').length;
    const cancelados = sortedEventos.filter((evento) => evento.status === 'CANCELADO').length;
    return { total, agendados, realizados, cancelados };
  }, [sortedEventos]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t('view.pageTitle')}
        description={t('view.pageDescription')}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={t('view.stats.total')} value={stats.total} icon={<CalendarDays className="w-5 h-5" />} color="indigo" />
        <StatCard title={t('view.stats.scheduled')} value={stats.agendados} icon={<CircleDashed className="w-5 h-5" />} color="blue" />
        <StatCard title={t('view.stats.completed')} value={stats.realizados} icon={<ListChecks className="w-5 h-5" />} color="emerald" />
        <StatCard title={t('view.stats.cancelled')} value={stats.cancelados} icon={<TriangleAlert className="w-5 h-5" />} color="rose" />
      </div>

      <FilterShell
        onSubmit={handleFilterSubmit}
        actions={
          <FilterActions
            submitLabel={t('filter.apply')}
            clearLabel={t('filter.clear')}
            reloadLabel={t('reload')}
            onClear={() => handleClearFilters()}
            onReload={refetch}
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

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between gap-4">
          <span>{error}</span>
          <button type="button" onClick={() => refetch()} className="font-semibold underline underline-offset-2">
            {t('reload')}
          </button>
        </div>
      )}

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
            const statusClass = STATUS_EVENTO_COLOR[evento.status];

            return (
              <EntityCard key={evento.id} className="p-5">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge label={statusLabel} className={statusClass} />
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          {formatDate(evento.dataInicio, 'dd/MM/yyyy')}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-gray-900 leading-snug">{evento.titulo}</h3>
                        {evento.descricao && (
                          <p className="text-sm text-gray-500 max-w-3xl">{evento.descricao}</p>
                        )}
                      </div>
                    </div>

                    {evento.local && (
                      <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('event.location')}</p>
                        <p className="text-sm font-semibold text-gray-700">{evento.local}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="h-4 w-4 text-gray-400" />
                      {t('event.start')}: {formatDate(evento.dataInicio, 'dd/MM/yyyy HH:mm')}
                    </span>
                    {evento.dataFim && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-4 w-4 text-gray-400" />
                        {t('event.end')}: {formatDate(evento.dataFim, 'dd/MM/yyyy HH:mm')}
                      </span>
                    )}
                    {evento.local && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-gray-400" />
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
  );
}
