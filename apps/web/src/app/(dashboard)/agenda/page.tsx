'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { endOfWeek, startOfWeek } from 'date-fns';
import { AlertTriangle, Check, X } from 'lucide-react';
import { EventoInput, useEventos } from '@/hooks/use-eventos';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { EntityCard } from '@/components/app/entity-card';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { FilterShell, FilterActions } from '@/components/app/filter-shell';
import { FilterInput, FilterSelect } from '@/components/app/filter-field';
import { useFilterState } from '@/hooks/use-filter-state';
import { useMinisterios } from '@/hooks/use-ministerios';
import { ModalShell, ModalError, ModalFooter } from '@/components/app/modal-shell';
import { InputField, SelectField, TextareaField } from '@/components/app/form-field';
import { WEEKDAY_OPTIONS, WeekdaySelector } from '@/components/app/weekday-selector';
import { CreationModeSelector } from '@/components/app/creation-mode-selector';
import { SearchCombobox } from '@/components/app/search-combobox';
import { api, HttpError } from '@/lib/api';
import { Evento, AuthUser, EventoMinisterioInput, EventoTipo, StatusEvento, Ministerio } from '@/types';
import { formatDate } from '@/lib/utils';
import {
  EVENT_BATCH_MAX_OCCURRENCES,
  formatOperationalDateTime,
  generateWeeklyOccurrences,
  type WeeklyEventDay,
} from '@/lib/event-batch';

type FeedbackMessage = {
  type: 'success' | 'error';
  message: string;
} | null;

const statusTranslationKeys: Record<StatusEvento, 'status.AGENDADO' | 'status.REALIZADO' | 'status.CANCELADO'> = {
  AGENDADO: 'status.AGENDADO',
  REALIZADO: 'status.REALIZADO',
  CANCELADO: 'status.CANCELADO',
};

const typeTranslationKeys: Record<EventoTipo, 'event.type.GERAL' | 'event.type.MINISTERIO' | 'event.type.REUNIAO_INTERNA'> = {
  GERAL: 'event.type.GERAL',
  MINISTERIO: 'event.type.MINISTERIO',
  REUNIAO_INTERNA: 'event.type.REUNIAO_INTERNA',
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function toDateInputValue(date: Date) {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
}

const WEEKDAY_TRANSLATION_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function createInitialWeeklyDays(): WeeklyEventDay[] {
  return WEEKDAY_OPTIONS.map(({ value: weekday }) => ({
    weekday,
    enabled: false,
    startTime: '',
    endTime: '',
  }));
}

export default function AgendaPage() {
  const t = useTranslations('agenda');
  const tSchedules = useTranslations('schedules');
  const locale = useLocale();
  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const weekEnd = useMemo(() => endOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const initialFilter = useMemo(
    () => ({
      status: '',
      tipo: '',
      ministerioId: '',
      dataInicio: toDateInputValue(weekStart),
      dataFim: toDateInputValue(weekEnd),
    }),
    [weekStart, weekEnd],
  );

  const { eventos, loading, error, refetch, applyFilter, createEvento, createEventosEmLote, updateEvento, deleteEvento } = useEventos(initialFilter, { scope: 'MANAGE' });
  const { ministerios, loading: ministeriosLoading } = useMinisterios();

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [local, setLocal] = useState('');
  const [status, setStatus] = useState<'AGENDADO' | 'REALIZADO' | 'CANCELADO'>('AGENDADO');
  const [tipo, setTipo] = useState<EventoTipo>('GERAL');
  const [ministeriosConfig, setMinisteriosConfig] = useState<EventoMinisterioInput[]>([]);
  const [ministerioSearch, setMinisterioSearch] = useState('');
  const [createMode, setCreateMode] = useState<'single' | 'weekly'>('single');
  const [weeklyStartDate, setWeeklyStartDate] = useState('');
  const [weeklyEndDate, setWeeklyEndDate] = useState('');
  const [weeklyDays, setWeeklyDays] = useState<WeeklyEventDay[]>(createInitialWeeklyDays);
  const [excludedOccurrences, setExcludedOccurrences] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const {
    formState: filterState,
    setFormState: setFilterState,
    setField: setFilterField,
    handleClear: handleClearFilters,
    handleSubmit: handleFilterSubmit,
  } = useFilterState({
    initialState: initialFilter,
    onApply: (filters) => {
      applyFilter({
        status: filters.status || undefined,
        tipo: filters.tipo || undefined,
        ministerioId: filters.ministerioId || undefined,
        dataInicio: filters.dataInicio || undefined,
        dataFim: filters.dataFim || undefined,
      });
    },
  });

  const [feedback, setFeedback] = useState<FeedbackMessage>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [pendingDeleteEvento, setPendingDeleteEvento] = useState<Evento | null>(null);
  const [pendingStatusEvento, setPendingStatusEvento] = useState<Evento | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    api
      .get<AuthUser>('/api/auth/me')
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  const basicHasLeadership =
    currentUser?.role === 'BASIC' &&
    (currentUser.membro?.ministerios?.some((membership) => membership.role === 'LEADER' || membership.role === 'ASSISTANT_LEADER') ?? false);
  const canCreateGeneralEvent = currentUser?.role === 'ADMIN' || currentUser?.role === 'STAFF';
  const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'STAFF' || basicHasLeadership;
  const ministeriosAtivos = useMemo(() => ministerios.filter((ministerio: Ministerio) => ministerio.ativo), [ministerios]);
  const ministeriosSelecionados = useMemo(
    () => ministeriosAtivos.filter((ministerio) => ministeriosConfig.some((config) => config.ministerioId === ministerio.id)),
    [ministeriosAtivos, ministeriosConfig],
  );
  const ministeriosDisponiveis = useMemo(
    () => ministeriosAtivos.filter((ministerio) => !ministeriosConfig.some((config) => config.ministerioId === ministerio.id)),
    [ministeriosAtivos, ministeriosConfig],
  );
  const weeklyGeneration = useMemo(() => {
    try {
      return {
        error: null,
        occurrences: generateWeeklyOccurrences(weeklyStartDate, weeklyEndDate, weeklyDays),
      };
    } catch (error) {
      return {
        error: getErrorMessage(error, t('batch.invalidPattern')),
        occurrences: [],
      };
    }
  }, [t, weeklyDays, weeklyEndDate, weeklyStartDate]);
  const batchOccurrences = useMemo(
    () => weeklyGeneration.occurrences.filter((occurrence) => !excludedOccurrences.has(occurrence.dataInicio)),
    [excludedOccurrences, weeklyGeneration.occurrences],
  );
  const removedOccurrenceCount = weeklyGeneration.occurrences.length - batchOccurrences.length;

  function toggleMinisterioId(ministerioId: string) {
    setMinisteriosConfig((current) => {
      const selected = current.some((config) => config.ministerioId === ministerioId);

      return selected ? current.filter((config) => config.ministerioId !== ministerioId) : [...current, { ministerioId, requerEscala: false }];
    });
  }

  function toggleRequerEscala(ministerioId: string) {
    const ministerio = ministeriosAtivos.find((item) => item.id === ministerioId);
    if (!ministerio?.usaEscalas) return;

    setMinisteriosConfig((current) =>
      current.map((config) => (config.ministerioId === ministerioId ? { ...config, requerEscala: !config.requerEscala } : config)),
    );
  }

  function addMinisterio(ministerio: Ministerio) {
    setMinisteriosConfig((current) => (
      current.some((config) => config.ministerioId === ministerio.id)
        ? current
        : [...current, { ministerioId: ministerio.id, requerEscala: false }]
    ));
    setMinisterioSearch('');
  }

  function updateWeeklyDay(weekday: number, patch: Partial<WeeklyEventDay>) {
    setWeeklyDays((current) => current.map((day) => (
      day.weekday === weekday ? { ...day, ...patch } : day
    )));
  }

  function changeCreateMode(mode: 'single' | 'weekly') {
    setCreateMode(mode);
    setModalError(null);
    if (mode === 'single') {
      setWeeklyStartDate('');
      setWeeklyEndDate('');
      setWeeklyDays(createInitialWeeklyDays());
      setExcludedOccurrences(new Set());
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;

    if (!selectedEvento && createMode === 'weekly') {
      if (weeklyGeneration.error) {
        setModalError(weeklyGeneration.error);
        return;
      }
      if (batchOccurrences.length === 0) {
        setModalError(t('batch.noOccurrencesError'));
        return;
      }
    } else if (!dataInicio) {
      return;
    }

    setSaving(true);
    try {
      const commonPayload = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        tipo,
        local: local.trim() || undefined,
        status,
        ministerios: ministeriosConfig.map((config) => ({
          ...config,
          requerEscala: config.requerEscala && Boolean(ministeriosAtivos.find((ministerio) => ministerio.id === config.ministerioId)?.usaEscalas),
        })),
      };

      if (selectedEvento) {
        const payload: EventoInput = {
          ...commonPayload,
          dataInicio: new Date(dataInicio).toISOString(),
          dataFim: dataFim ? new Date(dataFim).toISOString() : undefined,
        };
        await updateEvento(selectedEvento.id, payload);
      } else if (createMode === 'weekly') {
        const response = await createEventosEmLote({
          ...commonPayload,
          ocorrencias: batchOccurrences.map(({ dataInicio, dataFim }) => ({ dataInicio, dataFim })),
        });
        setFeedback({
          type: 'success',
          message: t('batch.createdSuccess', { count: response.total }),
        });
        await refetch();
      } else {
        await createEvento({
          ...commonPayload,
          dataInicio: new Date(dataInicio).toISOString(),
          dataFim: dataFim ? new Date(dataFim).toISOString() : undefined,
        });
      }
      setIsModalOpen(false);
      setSelectedEvento(null);
      setModalError(null);
    } catch (error: unknown) {
      const conflictingDates = error instanceof HttpError
        ? (error.data as typeof error.data & { conflictingDates?: string[] }).conflictingDates
        : undefined;
      setModalError(
        conflictingDates?.length
          ? t('batch.conflictError', {
              dates: conflictingDates.map((date) => formatOperationalDateTime(date, locale)).join(', '),
            })
          : getErrorMessage(error, t('errorSave')),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStatus(ev: Evento, nextStatus: StatusEvento) {
    if (ev.status === nextStatus) return;

    setConfirmLoading(true);
    setFeedback(null);
    try {
      await updateEvento(ev.id, { status: nextStatus });
      setPendingStatusEvento(null);
    } catch (error: unknown) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(error, t('errorSave')),
      });
    } finally {
      setConfirmLoading(false);
    }
  }

  function handleDelete(ev: Evento) {
    setPendingDeleteEvento(ev);
  }

  async function confirmDeleteEvento() {
    if (!pendingDeleteEvento) return;
    setConfirmLoading(true);
    setFeedback(null);
    try {
      await deleteEvento(pendingDeleteEvento.id);
      setPendingDeleteEvento(null);
    } catch (error: unknown) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(error, t('errorDelete')),
      });
    } finally {
      setConfirmLoading(false);
    }
  }

  function toLocalDatetimeString(isoString?: string) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const tzoffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzoffset).toISOString().slice(0, 16);
  }

  function openEdit(ev: Evento) {
    setSelectedEvento(ev);
    setTitulo(ev.titulo);
    setDescricao(ev.descricao || '');
    setDataInicio(toLocalDatetimeString(ev.dataInicio));
    setDataFim(toLocalDatetimeString(ev.dataFim));
    setLocal(ev.local || '');
    setStatus(ev.status);
    setTipo(ev.tipo);
    setMinisteriosConfig(
      (ev.ministerios || []).map((relacao) => ({
        ministerioId: relacao.ministerioId,
        requerEscala: relacao.requerEscala ?? false,
      })),
    );
    setMinisterioSearch('');
    setCreateMode('single');
    setModalError(null);
    setIsModalOpen(true);
  }

  function openCreate() {
    setSelectedEvento(null);
    setTitulo('');
    setDescricao('');
    setDataInicio('');
    setDataFim('');
    setLocal('');
    setStatus('AGENDADO');
    setTipo(canCreateGeneralEvent ? 'GERAL' : 'MINISTERIO');
    setMinisteriosConfig([]);
    setMinisterioSearch('');
    setCreateMode('single');
    setWeeklyStartDate('');
    setWeeklyEndDate('');
    setWeeklyDays(createInitialWeeklyDays());
    setExcludedOccurrences(new Set());
    setModalError(null);
    setIsModalOpen(true);
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        stackActionsOnMobile
        action={
          canManage ? (
            <button
              onClick={openCreate}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 max-sm:w-full"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t('newEvent')}
            </button>
          ) : undefined
        }
      />

      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => refetch()} className="underline font-semibold hover:text-red-800">
            {t('reload')}
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={`p-4 text-sm border rounded-2xl flex items-center justify-between ${
            feedback.type === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-700 bg-red-50 border-red-100'
          }`}
        >
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="font-semibold opacity-70 hover:opacity-100">
            Fechar
          </button>
        </div>
      )}

      {/* Filters */}
      <FilterShell
        onSubmit={handleFilterSubmit}
        actions={<FilterActions submitLabel={t('filter.apply')} clearLabel={t('filter.clear')} onClear={() => handleClearFilters()} />}
      >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <FilterSelect
            id="filter-status"
            label={t('filter.statusLabel')}
            value={filterState.status}
            onChange={(e) => setFilterField('status', e.target.value)}
          >
            <option value="">{t('filter.allStatuses')}</option>
            <option value="AGENDADO">{t('status.AGENDADO')}</option>
            <option value="REALIZADO">{t('status.REALIZADO')}</option>
            <option value="CANCELADO">{t('status.CANCELADO')}</option>
          </FilterSelect>

          <FilterSelect id="filter-tipo" label={t('filter.tipoLabel')} value={filterState.tipo} onChange={(e) => setFilterField('tipo', e.target.value)}>
            <option value="">{t('filter.allTypes')}</option>
            <option value="GERAL">{t('event.type.GERAL')}</option>
            <option value="MINISTERIO">{t('event.type.MINISTERIO')}</option>
            <option value="REUNIAO_INTERNA">{t('event.type.REUNIAO_INTERNA')}</option>
          </FilterSelect>

          <FilterSelect
            id="filter-ministerio"
            label={t('filter.ministryLabel')}
            value={filterState.ministerioId}
            onChange={(e) => setFilterField('ministerioId', e.target.value)}
          >
            <option value="">{t('filter.allMinisterios')}</option>
            {ministeriosAtivos.map((ministerio) => (
              <option key={ministerio.id} value={ministerio.id}>
                {ministerio.nome}
              </option>
            ))}
          </FilterSelect>

          <FilterInput
            id="filter-start"
            label={t('filter.from')}
            type="date"
            value={filterState.dataInicio}
            onChange={(e) => {
              const dataInicio = e.target.value;
              setFilterState((current) => ({
                ...current,
                dataInicio,
                dataFim: dataInicio && current.dataFim && current.dataFim < dataInicio ? dataInicio : current.dataFim,
              }));
            }}
          />

          <FilterInput
            id="filter-end"
            label={t('filter.to')}
            type="date"
            min={filterState.dataInicio || undefined}
            value={filterState.dataFim}
            onChange={(e) => setFilterField('dataFim', e.target.value)}
          />
        </div>
      </FilterShell>

      {/* Events List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <EntityCard key={i} loading />
          ))}
        </div>
      ) : eventos.length === 0 ? (
        <EmptyState title={t('noEvents')} description={t('noEventsDesc')} />
      ) : (
        <div className="space-y-4">
          {eventos.map((ev) => {
            const evStatus = ev.status;
            const colors: Record<string, string> = {
              AGENDADO: 'bg-blue-50 text-blue-700 border-blue-150',
              REALIZADO: 'bg-emerald-50 text-emerald-700 border-emerald-150',
              CANCELADO: 'bg-rose-50 text-rose-700 border-rose-150',
            };
            const ministeriosRelacionados = (ev.ministerios || [])
              .map((relacao) => relacao.ministerio?.nome)
              .filter(Boolean)
              .join(', ');
            const statusActionClass: Record<StatusEvento, string> = {
              AGENDADO: 'text-amber-600',
              REALIZADO: 'text-emerald-600',
              CANCELADO: 'text-red-500',
            };

            return (
              <EntityCard key={ev.id} className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="min-w-0 space-y-2">
                    <h3 className="break-words text-base font-bold leading-6 tracking-tight text-gray-800 sm:text-lg">
                      {ev.titulo}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex shrink-0 rounded-lg border px-2.5 py-0.5 text-xs font-bold ${colors[evStatus]}`}>
                        {t(statusTranslationKeys[evStatus])}
                      </span>
                      <span className="inline-flex shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                        {t(typeTranslationKeys[ev.tipo])}
                      </span>
                    </div>
                  </div>

                  {ev.descricao && <p className="max-w-3xl break-words text-sm leading-6 text-gray-500">{ev.descricao}</p>}

                  <div className="grid gap-2 text-xs font-medium text-gray-500 sm:grid-cols-2 xl:grid-cols-4">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="truncate">{t('event.start')}: {formatDate(ev.dataInicio, 'dd/MM/yyyy HH:mm')}</span>
                    </span>
                    {ev.dataFim && (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="truncate">{t('event.end')}: {formatDate(ev.dataFim, 'dd/MM/yyyy HH:mm')}</span>
                      </span>
                    )}
                    {ev.local && (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{t('event.location')}: {ev.local}</span>
                      </span>
                    )}
                    {ministeriosRelacionados && (
                      <span className="flex min-w-0 items-start gap-1.5 sm:col-span-2 xl:col-span-1">
                        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                        </svg>
                        <span className="min-w-0 break-words">{t('event.ministerios')}: {ministeriosRelacionados}</span>
                      </span>
                    )}
                  </div>
                </div>

                {canManage && (
                  <div className="flex w-full justify-end sm:w-auto md:self-start">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingStatusEvento(ev)}
                        className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50"
                        title={t('actions.changeStatus')}
                        aria-label={t('actions.changeStatus')}
                      >
                        {ev.status === 'AGENDADO' ? (
                          <svg className={`h-4 w-4 ${statusActionClass[ev.status]}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                          </svg>
                        ) : ev.status === 'REALIZADO' ? (
                          <svg className={`h-4 w-4 ${statusActionClass[ev.status]}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                          </svg>
                        ) : (
                          <svg className={`h-4 w-4 ${statusActionClass[ev.status]}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => openEdit(ev)}
                        className="p-2 border border-gray-200 hover:border-gray-300 rounded-xl text-gray-600 bg-white transition-all hover:bg-gray-50 flex items-center justify-center"
                        title={t('modal.editTooltip')}
                      >
                        <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(ev)}
                        className="p-2 border border-red-100 hover:bg-red-50 rounded-xl text-red-500 transition-all flex items-center justify-center"
                        title={t('modal.deleteTooltip')}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </EntityCard>
            );
          })}
        </div>
      )}

      <ModalShell
        isOpen={isModalOpen}
        title={selectedEvento ? t('modal.editTitle') : t('modal.createTitle')}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEvento(null);
          setModalError(null);
        }}
        size="md"
        height={!selectedEvento ? 'viewport' : 'auto'}
        bodyClassName="[overflow-anchor:none]"
        footer={
          <ModalFooter
            form="agenda-form"
            loading={saving}
            disabled={!selectedEvento && createMode === 'weekly' && (batchOccurrences.length === 0 || Boolean(weeklyGeneration.error))}
            onCancel={() => {
              setIsModalOpen(false);
              setSelectedEvento(null);
              setModalError(null);
            }}
          />
        }
      >
        <form id="agenda-form" onSubmit={handleSave}>
          <ModalError message={modalError} />
          <div className="space-y-4 p-6">
            <InputField
              id="ev-titulo"
              label={t('modal.titleLabel')}
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={t('modal.titlePlaceholder')}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                id="ev-local"
                label={t('modal.locationLabel')}
                type="text"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder={t('modal.locationPlaceholder')}
              />
              <SelectField id="ev-status" label={t('modal.statusLabel')} value={status} onChange={(e) => setStatus(e.target.value as StatusEvento)}>
                <option value="AGENDADO">{t('status.AGENDADO')}</option>
                <option value="REALIZADO">{t('status.REALIZADO')}</option>
                <option value="CANCELADO">{t('status.CANCELADO')}</option>
              </SelectField>
            </div>

            <div className="space-y-4">
              <SelectField id="ev-tipo" label={t('modal.typeLabel')} value={tipo} onChange={(e) => setTipo(e.target.value as EventoTipo)}>
                {canCreateGeneralEvent && <option value="GERAL">{t('event.type.GERAL')}</option>}
                <option value="MINISTERIO">{t('event.type.MINISTERIO')}</option>
                <option value="REUNIAO_INTERNA">{t('event.type.REUNIAO_INTERNA')}</option>
              </SelectField>

              <fieldset className="space-y-2">
                <SearchCombobox
                  label={t('modal.ministeriosLabel')}
                  optionalLabel={`${ministeriosSelecionados.length}/${ministeriosAtivos.length}`}
                  placeholder={t('modal.ministrySearchPlaceholder')}
                  loadingPlaceholder={t('modal.ministeriosLoading')}
                  loading={ministeriosLoading}
                  options={ministeriosDisponiveis}
                  search={ministerioSearch}
                  emptyMessage={t('modal.ministrySearchEmpty')}
                  onSearchChange={setMinisterioSearch}
                  onSelect={addMinisterio}
                  onClear={() => setMinisterioSearch('')}
                />
                <p className="text-xs leading-5 text-gray-500">
                  {t('modal.ministeriosHelp')}
                  {tipo === 'GERAL' ? ` ${t('modal.generalVisibilityHelp')}` : ''}
                </p>
                {ministeriosSelecionados.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-400">
                    {t('modal.noSelectedMinistries')}
                  </p>
                ) : (
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
                    {ministeriosSelecionados.map((ministerio) => {
                      const config = ministeriosConfig.find((item) => item.ministerioId === ministerio.id);
                      return (
                        <div key={ministerio.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                          <span className="min-w-0 flex-1 text-sm font-semibold text-gray-800">{ministerio.nome}</span>
                          {ministerio.usaEscalas ? (
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={config?.requerEscala ?? false}
                              onClick={() => toggleRequerEscala(ministerio.id)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700"
                            >
                              <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${config?.requerEscala ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-indigo-300 bg-white'}`}>
                                {config?.requerEscala && <Check className="h-3 w-3" strokeWidth={2.5} />}
                              </span>
                              {t('modal.requiresScheduleLabel')}
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-gray-400">{t('modal.scheduleNotUsedLabel')}</span>
                          )}
                          <button type="button" onClick={() => toggleMinisterioId(ministerio.id)} aria-label={t('modal.removeMinistryLabel', { name: ministerio.nome })} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </fieldset>
            </div>

            {!selectedEvento && (
              <CreationModeSelector
                legend={t('batch.creationMode')}
                options={(['single', 'weekly'] as const).map((mode) => ({
                  id: mode,
                  title: t(`batch.mode.${mode}`),
                  description: t(`batch.modeDescription.${mode}`),
                }))}
                selected={createMode}
                onChange={changeCreateMode}
              />
            )}

            {selectedEvento || createMode === 'single' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  id="ev-inicio"
                  label={t('modal.startTime')}
                  type="datetime-local"
                  required
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
                <InputField id="ev-fim" label={t('modal.endTime')} type="datetime-local" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            ) : (
              <section className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InputField id="batch-start" label={t('batch.startDate')} type="date" required value={weeklyStartDate} onChange={(event) => setWeeklyStartDate(event.target.value)} />
                  <InputField id="batch-end" label={t('batch.endDate')} type="date" required value={weeklyEndDate} min={weeklyStartDate || undefined} onChange={(event) => setWeeklyEndDate(event.target.value)} />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase text-gray-500">{t('batch.weekdaysLabel')}</p>
                  <p className="text-xs text-gray-400">{t('batch.weekdaysDescription')}</p>
                  <WeekdaySelector
                    selectedDays={weeklyDays.filter((day) => day.enabled).map((day) => day.weekday)}
                    onToggle={(weekday) => {
                      const day = weeklyDays.find((item) => item.weekday === weekday);
                      updateWeeklyDay(weekday, { enabled: !day?.enabled });
                    }}
                    getLabel={(key) => tSchedules(`modal.days.${key}`)}
                    ariaLabel={t('batch.weekdaysLabel')}
                  />
                  <div className="space-y-2 pt-1">
                    {weeklyDays.filter((day) => day.enabled).map((day) => (
                      <div key={day.weekday} className="space-y-3 rounded-xl border border-indigo-200 bg-white p-3">
                        <p className="text-sm font-semibold text-gray-700">
                          {t(`batch.weekdays.${WEEKDAY_TRANSLATION_KEYS[day.weekday]}`)}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <InputField id={`batch-start-time-${day.weekday}`} label={t('batch.startTime')} type="time" required value={day.startTime} onChange={(event) => updateWeeklyDay(day.weekday, { startTime: event.target.value })} />
                          <InputField id={`batch-end-time-${day.weekday}`} label={t('batch.endTime')} type="time" value={day.endTime} onChange={(event) => updateWeeklyDay(day.weekday, { endTime: event.target.value })} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">{t('batch.timeHint')}</p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{t('batch.previewTitle')}</p>
                      <p className="text-xs text-gray-500">{t('batch.previewCount', { count: batchOccurrences.length, max: EVENT_BATCH_MAX_OCCURRENCES })}</p>
                    </div>
                    {removedOccurrenceCount > 0 && (
                      <button type="button" onClick={() => setExcludedOccurrences(new Set())} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                        {t('batch.restoreRemoved', { count: removedOccurrenceCount })}
                      </button>
                    )}
                  </div>
                  {weeklyGeneration.error ? (
                    <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{weeklyGeneration.error}</p>
                  ) : batchOccurrences.length === 0 ? (
                    <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">{t('batch.previewEmpty')}</p>
                  ) : (
                    <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                      {batchOccurrences.map((occurrence) => (
                        <div key={occurrence.dataInicio} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 text-sm">
                          <span className="font-medium text-gray-700">
                            {formatOperationalDateTime(occurrence.dataInicio, locale)}
                            {occurrence.dataFim ? ` - ${formatOperationalDateTime(occurrence.dataFim, locale, false)}` : ''}
                          </span>
                          <button type="button" onClick={() => setExcludedOccurrences((current) => new Set(current).add(occurrence.dataInicio))} className="shrink-0 text-xs font-semibold text-rose-600 hover:text-rose-700">
                            {t('batch.removeOccurrence')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{t('batch.independentNotice')}</p>
                </div>
              </section>
            )}

            <TextareaField
              id="ev-desc"
              label={t('modal.descriptionLabel')}
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={t('modal.descriptionPlaceholder')}
            />
          </div>
        </form>
      </ModalShell>

      <ModalShell
        isOpen={!!pendingStatusEvento}
        title={t('actions.changeStatus')}
        icon={<AlertTriangle className="h-5 w-5" />}
        onClose={() => setPendingStatusEvento(null)}
        size="sm"
        bodyClassName="p-6"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPendingStatusEvento(null)}
              disabled={confirmLoading}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-150 rounded-xl transition-all disabled:opacity-60"
            >
              {t('modal.cancel')}
            </button>
            {pendingStatusEvento?.status !== 'CANCELADO' && (
              <button
                type="button"
                onClick={() => pendingStatusEvento && handleUpdateStatus(pendingStatusEvento, 'CANCELADO')}
                disabled={confirmLoading}
                className="px-5 py-2 text-sm font-semibold text-white rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-60 bg-red-600 hover:bg-red-700"
              >
                {confirmLoading ? t('modal.processing') : t('actions.markCanceled')}
              </button>
            )}
            {pendingStatusEvento?.status !== 'REALIZADO' && (
              <button
                type="button"
                onClick={() => pendingStatusEvento && handleUpdateStatus(pendingStatusEvento, 'REALIZADO')}
                disabled={confirmLoading}
                className="px-5 py-2 text-sm font-semibold text-white rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-60 bg-emerald-600 hover:bg-emerald-700"
              >
                {confirmLoading ? t('modal.processing') : t('actions.completeEvent')}
              </button>
            )}
          </>
        }
      >
        <div className="text-sm leading-6 text-gray-600">
          {pendingStatusEvento ? t('statusModal.description', { title: pendingStatusEvento.titulo }) : ''}
        </div>
      </ModalShell>

      <ConfirmDialog
        isOpen={!!pendingDeleteEvento}
        title={t('modal.deleteTooltip')}
        description={pendingDeleteEvento ? t('deleteConfirm', { title: pendingDeleteEvento.titulo }) : ''}
        confirmLabel={t('modal.deleteTooltip')}
        loading={confirmLoading}
        onConfirm={confirmDeleteEvento}
        onCancel={() => setPendingDeleteEvento(null)}
      />
    </div>
  );
}
