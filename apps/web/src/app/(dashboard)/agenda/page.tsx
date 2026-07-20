'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { endOfWeek, startOfWeek } from 'date-fns';
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
import { api } from '@/lib/api';
import { Evento, AuthUser, EventoMinisterioInput, EventoTipo, StatusEvento, Ministerio } from '@/types';
import { formatDate } from '@/lib/utils';

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

export default function AgendaPage() {
  const t = useTranslations('agenda');
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

  const { eventos, loading, error, refetch, applyFilter, createEvento, updateEvento, deleteEvento } = useEventos(initialFilter, { scope: 'MANAGE' });
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

  function toggleMinisterioId(ministerioId: string) {
    setMinisteriosConfig((current) => {
      const selected = current.some((config) => config.ministerioId === ministerioId);

      return selected ? current.filter((config) => config.ministerioId !== ministerioId) : [...current, { ministerioId, requerEscala: false }];
    });
  }

  function toggleRequerEscala(ministerioId: string) {
    setMinisteriosConfig((current) =>
      current.map((config) => (config.ministerioId === ministerioId ? { ...config, requerEscala: !config.requerEscala } : config)),
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || !dataInicio) return;

    try {
      const payload: EventoInput = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        tipo,
        dataInicio: new Date(dataInicio).toISOString(),
        dataFim: dataFim ? new Date(dataFim).toISOString() : undefined,
        local: local.trim() || undefined,
        status,
        ministerios: ministeriosConfig,
      };

      if (selectedEvento) {
        await updateEvento(selectedEvento.id, payload);
      } else {
        await createEvento(payload);
      }
      setIsModalOpen(false);
      setSelectedEvento(null);
      setModalError(null);
    } catch (error: unknown) {
      setModalError(getErrorMessage(error, t('errorSave')));
    }
  }

  async function handleUpdateStatus(ev: Evento, nextStatus: StatusEvento) {
    if (ev.status === nextStatus) return;

    try {
      await updateEvento(ev.id, { status: nextStatus });
    } catch (error: unknown) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(error, t('errorSave')),
      });
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
            onChange={(e) => setFilterField('dataInicio', e.target.value)}
          />

          <FilterInput
            id="filter-end"
            label={t('filter.to')}
            type="date"
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

            return (
              <EntityCard key={ev.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex px-2.5 py-0.5 text-xs font-bold border rounded-lg ${colors[evStatus]}`}>
                      {t(statusTranslationKeys[evStatus])}
                    </span>
                    <span className="inline-flex px-2.5 py-0.5 text-xs font-semibold border rounded-lg bg-gray-50 text-gray-600">
                      {t(typeTranslationKeys[ev.tipo])}
                    </span>
                    <h3 className="text-base font-bold text-gray-800">{ev.titulo}</h3>
                  </div>

                  {ev.descricao && <p className="text-sm text-gray-500 max-w-2xl">{ev.descricao}</p>}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-400 font-medium">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t('event.start')}: {formatDate(ev.dataInicio, 'dd/MM/yyyy HH:mm')}
                    </span>
                    {ev.dataFim && (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t('event.end')}: {formatDate(ev.dataFim, 'dd/MM/yyyy HH:mm')}
                      </span>
                    )}
                    {ev.local && (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {t('event.location')}: {ev.local}
                      </span>
                    )}
                    {ministeriosRelacionados && (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                        </svg>
                        {t('event.ministerios')}: {ministeriosRelacionados}
                      </span>
                    )}
                  </div>
                </div>

                {canManage && (
                  <div className="flex w-full flex-col items-end gap-2 sm:w-auto md:self-auto">
                    {ev.status === 'AGENDADO' && (
                      <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(ev, 'REALIZADO')}
                          className="inline-flex shrink-0 whitespace-nowrap px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all"
                        >
                          {t('actions.markCompleted')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(ev, 'CANCELADO')}
                          className="inline-flex shrink-0 whitespace-nowrap px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-100 hover:bg-red-50 rounded-xl transition-all"
                        >
                          {t('actions.cancelEvent')}
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-2">
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
        size="lg"
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
                id="ev-inicio"
                label={t('modal.startTime')}
                type="datetime-local"
                required
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
              <InputField id="ev-fim" label={t('modal.endTime')} type="datetime-local" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField id="ev-tipo" label={t('modal.typeLabel')} value={tipo} onChange={(e) => setTipo(e.target.value as EventoTipo)}>
                {canCreateGeneralEvent && <option value="GERAL">{t('event.type.GERAL')}</option>}
                <option value="MINISTERIO">{t('event.type.MINISTERIO')}</option>
                <option value="REUNIAO_INTERNA">{t('event.type.REUNIAO_INTERNA')}</option>
              </SelectField>

              <fieldset aria-labelledby="event-ministries-label" className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <span id="event-ministries-label" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {t('modal.ministeriosLabel')}
                  </span>
                  <span className="text-[11px] font-medium text-gray-400">
                    {ministeriosSelecionados.length}/{ministeriosAtivos.length}
                  </span>
                </div>
                <p className="text-xs leading-5 text-gray-500">
                  {t('modal.ministeriosHelp')}
                  {tipo === 'GERAL' ? ` ${t('modal.generalVisibilityHelp')}` : ''}
                </p>
                <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2">
                  {ministeriosLoading ? (
                    <div className="px-3 py-2 text-sm text-gray-500">{t('modal.ministeriosLoading')}</div>
                  ) : ministeriosAtivos.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">{t('modal.noMinisterios')}</div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {ministeriosAtivos.map((ministerio) => {
                        const config = ministeriosConfig.find((item) => item.ministerioId === ministerio.id);
                        const checked = Boolean(config);

                        return (
                          <div
                            key={ministerio.id}
                            className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition-all ${checked ? 'border-indigo-200 bg-indigo-50 text-indigo-900' : 'border-gray-200 bg-white text-gray-700'}`}
                          >
                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                              <input type="checkbox" checked={checked} onChange={() => toggleMinisterioId(ministerio.id)} className="sr-only" />
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                  checked ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white'
                                }`}
                                aria-hidden="true"
                              >
                                {checked && (
                                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none">
                                    <path d="M5 10.5L8.5 14L15 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </span>
                              <span className="min-w-0 flex-1 text-sm font-medium leading-5">{ministerio.nome}</span>
                            </label>

                            {checked && (
                              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-indigo-800">
                                <input
                                  type="checkbox"
                                  checked={config?.requerEscala ?? false}
                                  onChange={() => toggleRequerEscala(ministerio.id)}
                                  className="sr-only"
                                />
                                <span
                                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                                    config?.requerEscala
                                      ? 'border-indigo-600 bg-indigo-600 text-white'
                                      : 'border-indigo-300 bg-white'
                                  }`}
                                  aria-hidden="true"
                                >
                                  {config?.requerEscala && (
                                    <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="none">
                                      <path
                                        d="M5 10.5L8.5 14L15 6.5"
                                        stroke="currentColor"
                                        strokeWidth="2.2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  )}
                                </span>
                                <span className="block font-semibold">{t('modal.requiresScheduleLabel')}</span>
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </fieldset>
            </div>

            <TextareaField
              id="ev-desc"
              label={t('modal.descriptionLabel')}
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={t('modal.descriptionPlaceholder')}
            />
          </div>

          <ModalFooter
            form="agenda-form"
            primaryLabel={selectedEvento ? t('modal.save') : t('modal.save')}
            onCancel={() => {
              setIsModalOpen(false);
              setSelectedEvento(null);
              setModalError(null);
            }}
          />
        </form>
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
