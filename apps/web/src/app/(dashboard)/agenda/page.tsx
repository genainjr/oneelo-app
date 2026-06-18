'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useEventos } from '@/hooks/use-eventos';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { EntityCard } from '@/components/app/entity-card';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { FilterShell, FilterActions } from '@/components/app/filter-shell';
import { FilterInput, FilterSelect } from '@/components/app/filter-field';
import { useFilterState } from '@/hooks/use-filter-state';
import { ModalShell, ModalError, ModalFooter } from '@/components/app/modal-shell';
import { InputField, SelectField, TextareaField } from '@/components/app/form-field';
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
          {Array.from({ length: 2 }).map((_, i) => <EntityCard key={i} loading />)}
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
              <EntityCard
                key={ev.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
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
              </EntityCard>
            );
          })}
        </div>
      )}

      <ModalShell
        isOpen={isModalOpen}
        title={selectedEvento ? t('modal.editTitle') : t('modal.createTitle')}
        onClose={() => { setIsModalOpen(false); setSelectedEvento(null); }}
        size="md"
      >
        <form id="agenda-form" onSubmit={handleSave}>
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
              <InputField
                id="ev-fim"
                label={t('modal.endTime')}
                type="datetime-local"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
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
              <SelectField
                id="ev-status"
                label={t('modal.statusLabel')}
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              >
                <option value="AGENDADO">{t('status.AGENDADO')}</option>
                <option value="REALIZADO">{t('status.REALIZADO')}</option>
                <option value="CANCELADO">{t('status.CANCELADO')}</option>
              </SelectField>
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
            onCancel={() => { setIsModalOpen(false); setSelectedEvento(null); }}
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
