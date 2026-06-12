'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useEventos } from '@/hooks/use-eventos';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { FilterShell, FilterActions } from '@/components/app/filter-shell';
import { useFilterState } from '@/hooks/use-filter-state';
import { api } from '@/lib/api';
import { Evento, AuthUser } from '@/types';
import { formatDate } from '@/lib/utils';

type FeedbackMessage = {
  type: 'success' | 'error';
  message: string;
} | null;

export default function AgendaPage() {
  const t = useTranslations('agenda');

  const {
    eventos,
    loading,
    error,
    refetch,
    applyFilter,
    createEvento,
    updateEvento,
    deleteEvento,
  } = useEventos();

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [local, setLocal] = useState('');
  const [status, setStatus] = useState<'AGENDADO' | 'REALIZADO' | 'CANCELADO'>('AGENDADO');

  const {
    formState: filterState,
    setField: setFilterField,
    handleClear: handleClearFilters,
    handleSubmit: handleFilterSubmit,
  } = useFilterState({
    initialState: {
      status: '',
      dataInicio: '',
      dataFim: '',
    },
    onApply: (filters) => {
      applyFilter({
        status: filters.status || undefined,
        dataInicio: filters.dataInicio ? new Date(filters.dataInicio).toISOString() : undefined,
        dataFim: filters.dataFim ? new Date(filters.dataFim).toISOString() : undefined,
      });
    },
  });

  const [feedback, setFeedback] = useState<FeedbackMessage>(null);
  const [pendingDeleteEvento, setPendingDeleteEvento] = useState<Evento | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    api.get<AuthUser>('/api/auth/me')
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'STAFF';

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || !dataInicio) return;

    try {
      const payload: any = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        dataInicio: new Date(dataInicio).toISOString(),
        dataFim: dataFim ? new Date(dataFim).toISOString() : undefined,
        local: local.trim() || undefined,
        status,
      };

      if (selectedEvento) {
        await updateEvento(selectedEvento.id, payload);
      } else {
        await createEvento(payload);
      }
      setIsModalOpen(false);
      setSelectedEvento(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || t('errorSave') });
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
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || t('errorDelete') });
    } finally {
      setConfirmLoading(false);
    }
  }

  function toLocalDatetimeString(isoString?: string) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const tzoffset = date.getTimezoneOffset() * 60000;
    return (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
  }

  function openEdit(ev: Evento) {
    setSelectedEvento(ev);
    setTitulo(ev.titulo);
    setDescricao(ev.descricao || '');
    setDataInicio(toLocalDatetimeString(ev.dataInicio));
    setDataFim(toLocalDatetimeString(ev.dataFim));
    setLocal(ev.local || '');
    setStatus(ev.status);
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
    setIsModalOpen(true);
  }


  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        action={
          canManage ? (
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all text-sm flex items-center gap-2"
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
        <div className={`p-4 text-sm border rounded-2xl flex items-center justify-between ${
          feedback.type === 'success'
            ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
            : 'text-red-700 bg-red-50 border-red-100'
        }`}>
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="font-semibold opacity-70 hover:opacity-100"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Filters */}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="filter-status" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('filter.statusLabel')}
            </label>
            <select
              id="filter-status"
              value={filterState.status}
              onChange={(e) => setFilterField('status', e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white text-gray-700 transition-all"
            >
              <option value="">{t('filter.allStatuses')}</option>
              <option value="AGENDADO">{t('status.AGENDADO')}</option>
              <option value="REALIZADO">{t('status.REALIZADO')}</option>
              <option value="CANCELADO">{t('status.CANCELADO')}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="filter-start" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('filter.from')}
            </label>
            <input
              id="filter-start"
              type="date"
              value={filterState.dataInicio}
              onChange={(e) => setFilterField('dataInicio', e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="filter-end" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('filter.to')}
            </label>
            <input
              id="filter-end"
              type="date"
              value={filterState.dataFim}
              onChange={(e) => setFilterField('dataFim', e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
          </div>
        </div>
      </FilterShell>

      {/* Events List */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-28 bg-gray-100 border border-gray-200 rounded-2xl" />
          <div className="h-28 bg-gray-100 border border-gray-200 rounded-2xl" />
        </div>
      ) : eventos.length === 0 ? (
        <EmptyState
          title={t('noEvents')}
          description={t('noEventsDesc')}
        />
      ) : (
        <div className="space-y-4">
          {eventos.map((ev) => {
            const evStatus = ev.status;
            const colors: Record<string, string> = {
              AGENDADO: 'bg-blue-50 text-blue-700 border-blue-150',
              REALIZADO: 'bg-emerald-50 text-emerald-700 border-emerald-150',
              CANCELADO: 'bg-rose-50 text-rose-700 border-rose-150',
            };

            return (
              <div
                key={ev.id}
                className="bg-white rounded-2xl border border-gray-150 p-5 shadow-2xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex px-2.5 py-0.5 text-xs font-bold border rounded-lg ${colors[evStatus]}`}>
                      {t(`status.${evStatus}` as any)}
                    </span>
                    <h3 className="text-base font-bold text-gray-800">{ev.titulo}</h3>
                  </div>

                  {ev.descricao && (
                    <p className="text-sm text-gray-500 max-w-2xl">{ev.descricao}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-400 font-medium">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t('event.start')}: {formatDate(ev.dataInicio)}
                    </span>
                    {ev.dataFim && (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t('event.end')}: {formatDate(ev.dataFim)}
                      </span>
                    )}
                    {ev.local && (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {t('event.location')}: {ev.local}
                      </span>
                    )}
                  </div>
                </div>

                {canManage && (
                  <div className="flex gap-2 items-center justify-end self-end md:self-auto">
                    <button
                      onClick={() => openEdit(ev)}
                      className="p-2 border border-gray-200 hover:border-gray-300 rounded-xl text-gray-600 bg-white transition-all hover:bg-gray-50 flex items-center justify-center"
                      title={t('modal.editTooltip')}
                    >
                      <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(ev)}
                      className="p-2 border border-red-100 hover:bg-red-50 rounded-xl text-red-500 transition-all flex items-center justify-center"
                      title={t('modal.deleteTooltip')}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/20">
              <h2 className="text-lg font-bold text-gray-800">
                {selectedEvento ? t('modal.editTitle') : t('modal.createTitle')}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedEvento(null);
                }}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="ev-titulo" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {t('modal.titleLabel')}
                  </label>
                  <input
                    id="ev-titulo"
                    type="text"
                    required
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder={t('modal.titlePlaceholder')}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="ev-inicio" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      {t('modal.startTime')}
                    </label>
                    <input
                      id="ev-inicio"
                      type="datetime-local"
                      required
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="ev-fim" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      {t('modal.endTime')}
                    </label>
                    <input
                      id="ev-fim"
                      type="datetime-local"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="ev-local" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      {t('modal.locationLabel')}
                    </label>
                    <input
                      id="ev-local"
                      type="text"
                      value={local}
                      onChange={(e) => setLocal(e.target.value)}
                      placeholder={t('modal.locationPlaceholder')}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="ev-status" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      {t('modal.statusLabel')}
                    </label>
                    <select
                      id="ev-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white text-gray-700"
                    >
                      <option value="AGENDADO">{t('status.AGENDADO')}</option>
                      <option value="REALIZADO">{t('status.REALIZADO')}</option>
                      <option value="CANCELADO">{t('status.CANCELADO')}</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="ev-desc" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {t('modal.descriptionLabel')}
                  </label>
                  <textarea
                    id="ev-desc"
                    rows={3}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder={t('modal.descriptionPlaceholder')}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedEvento(null);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-150 rounded-xl"
                >
                  {t('modal.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                >
                  {t('modal.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
