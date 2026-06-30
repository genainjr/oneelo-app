'use client';

import React, { useState, useEffect } from 'react';
import { useEscalas } from '@/hooks/use-escalas';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/app/page-header';
import { Skeleton } from '@/components/app/skeleton';
import { EmptyState } from '@/components/app/empty-state';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { FilterShell, FilterActions } from '@/components/app/filter-shell';
import { FilterSelect } from '@/components/app/filter-field';
import { useFilterState } from '@/hooks/use-filter-state';
import { ModalShell, ModalFooter, ModalError } from '@/components/app/modal-shell';
import { SelectField, TextareaField } from '@/components/app/form-field';
import { api } from '@/lib/api';
import { Escala, EscalaItem, Ministerio, MinisterioMembro, AuthUser, StatusEscala } from '@/types';
import { MONTH_KEYS, WEEKDAY_KEYS } from '@/components/app/escala-shared';
import { StatusBadge } from '@/components/app/status-badge';
import { EscalaGrid } from '@/components/app/escala-grid';
import { STATUS_ESCALA_COLOR } from '@/lib/utils';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function EscalasPage() {
  const t = useTranslations('schedules');
  const tGrid = useTranslations('schedules.grid');
  const hoje = new Date();

  const {
    escalas,
    loading,
    error,
    refetch,
    applyFilter,
    createEscala,
    updateEscala,
    deleteEscala,
    addDia,
    removeDia,
    reorderDias,
    addMembroItem,
    removeMembroItem,
    toggleCelula,
  } = useEscalas({
    mes: String(hoje.getMonth() + 1),
    ano: String(hoje.getFullYear()),
  });

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const [selectedEscala, setSelectedEscala] = useState<Escala | null>(null);
  const [detailedEscala, setDetailedEscala] = useState<Escala | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [ministryMembers, setMinistryMembers] = useState<MinisterioMembro[]>([]);

  const {
    formState: filterState,
    setField: setFilterField,
    handleClear: handleClearFilters,
    handleSubmit: handleFilterSubmit,
  } = useFilterState({
    initialState: {
      mes: String(hoje.getMonth() + 1),
      ano: String(hoje.getFullYear()),
      ministerioId: '',
    },
    onApply: (filters) => {
      applyFilter({
        mes: filters.mes,
        ano: filters.ano,
        ministerioId: filters.ministerioId || undefined,
      });
    },
  });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newMes, setNewMes] = useState(hoje.getMonth() + 1);
  const [newAno, setNewAno] = useState(hoje.getFullYear());
  const [newMinId, setNewMinId] = useState('');
  const [newObs, setNewObs] = useState('');
  const [newDiasSemana, setNewDiasSemana] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [aiToastOpen, setAiToastOpen] = useState(false);
  const [pendingConfirmAction, setPendingConfirmAction] = useState<{
    type: 'deleteEscala' | 'removeDia';
    label: string;
    diaId?: string;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    api.get<AuthUser>('/api/auth/me').then(setCurrentUser).catch(() => setCurrentUser(null));
    api.get<Ministerio[]>('/api/ministerios').then(d => setMinisterios(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  async function fetchDetail(escala: Escala) {
    setLoadingDetail(true);
    setDetailedEscala(null);
    setSelectedEscala(escala);
    try {
      const data = await api.get<Escala>(`/api/escalas/${escala.id}`);
      setDetailedEscala(data);
      if (data.ministerioId) {
        const min = await api.get<Ministerio>(`/api/ministerios/${data.ministerioId}`);
        setMinistryMembers(min.membros || []);
      }
    } catch {
      showToast(t('errorLoadDetail'), 'error');
    } finally {
      setLoadingDetail(false);
    }
  }

  async function refreshDetail() {
    if (!selectedEscala) return;
    setLoadingDetail(true);
    try {
      const data = await api.get<Escala>(`/api/escalas/${selectedEscala.id}`);
      setDetailedEscala(data);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newMinId) return;
    setCreateError('');
    setCreating(true);
    try {
      const created = await createEscala({
        mes: newMes,
        ano: newAno,
        ministerioId: newMinId,
        observacoes: newObs || undefined,
        diasSemana: newDiasSemana.length ? newDiasSemana : undefined,
      });
      setIsCreateOpen(false);
      setNewMinId('');
      setNewObs('');
      setNewDiasSemana([]);
      setCreateError('');
      showToast('Escala mensal criada com sucesso!');
      fetchDetail(created);
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Erro ao criar escala.');
      setCreateError(message);
      showToast(message, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateStatus(status: StatusEscala) {
    if (!selectedEscala) return;
    try {
      await updateEscala(selectedEscala.id, { status });
      await refreshDetail();
      refetch();
      showToast('Status atualizado!');
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Erro ao atualizar status.'), 'error');
    }
  }

  async function handleDelete() {
    if (!selectedEscala) return;
    const mesNome = t(`months.${selectedEscala.mes}` as never);
    setPendingConfirmAction({
      type: 'deleteEscala',
      label: t('deleteConfirm', { month: mesNome, year: selectedEscala.ano }),
    });
  }

  async function executePendingAction() {
    if (!pendingConfirmAction) return;
    setConfirmLoading(true);
    try {
      if (pendingConfirmAction.type === 'deleteEscala' && selectedEscala) {
        await deleteEscala(selectedEscala.id);
        setSelectedEscala(null);
        setDetailedEscala(null);
        showToast('Escala removida.');
      } else if (pendingConfirmAction.type === 'removeDia' && pendingConfirmAction.diaId) {
        await removeDia(pendingConfirmAction.diaId);
        await refreshDetail();
      }
      setPendingConfirmAction(null);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Erro ao executar ação.'), 'error');
    } finally {
      setConfirmLoading(false);
    }
  }

  async function handleToggleCelula(diaId: string, funcaoId: string, ocultar: boolean) {
    // Atualização otimista
    setDetailedEscala((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dias: prev.dias?.map((dia) => {
          if (dia.id !== diaId) return dia;
          const atuais = dia.funcoesOcultas ?? [];
          const novas = ocultar
            ? [...atuais, { funcaoId }]
            : atuais.filter((o) => o.funcaoId !== funcaoId);
          return { ...dia, funcoesOcultas: novas };
        }),
      };
    });

    try {
      await toggleCelula(diaId, funcaoId, ocultar);
    } catch {
      showToast('Erro ao atualizar célula.', 'error');
      await refreshDetail();
    }
  }

  function appendEscalaItem(diaId: string, item: EscalaItem) {
    setDetailedEscala((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        dias: prev.dias?.map((dia) => {
          if (dia.id !== diaId) return dia;

          const itens = dia.itens ?? [];
          const nextItens = itens.some((current) => current.id === item.id)
            ? itens.map((current) => (current.id === item.id ? item : current))
            : [...itens, item];

          return { ...dia, itens: nextItens };
        }),
      };
    });
  }

  function removeEscalaItem(itemId: string) {
    setDetailedEscala((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        dias: prev.dias?.map((dia) => ({
          ...dia,
          itens: dia.itens?.filter((item) => item.id !== itemId) ?? [],
        })),
      };
    });
  }

  const canManageTenant = currentUser?.role === 'ADMIN' || currentUser?.role === 'STAFF';
  const ledMinisterioIds = new Set(ministerios.map((m) => m.id));
  const canCreateEscala =
    canManageTenant ||
    (currentUser?.role === 'BASIC' && ledMinisterioIds.size > 0);
  const canManageSelectedEscala =
    canManageTenant ||
    (currentUser?.role === 'BASIC' &&
      !!detailedEscala?.ministerioId &&
      ledMinisterioIds.has(detailedEscala.ministerioId));
  const anos = Array.from({ length: 4 }, (_, i) => hoje.getFullYear() - 1 + i);

  const STATUS_LABELS: Record<string, string> = {
    RASCUNHO: t('status.RASCUNHO'),
    PUBLICADA: t('status.PUBLICADA'),
    ENCERRADA: t('status.ENCERRADA'),
  };

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-medium border animate-in slide-in-from-bottom-3 ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            {toast.type === 'success'
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            }
          </svg>
          {toast.msg}
        </div>
      )}

      <PageHeader
        title={t('title')}
        description={t('description')}
        stackActionsOnMobile
        action={
          canCreateEscala ? (
            <button
              id="btn-nova-escala"
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 max-sm:w-full"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t('new')}
            </button>
          ) : undefined
        }
      />

      <ModalShell
        isOpen={aiToastOpen}
        title={t('ai.title')}
        description={t('ai.badge')}
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        }
        onClose={() => setAiToastOpen(false)}
        size="sm"
      >
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-gray-500 leading-relaxed">{t('ai.description')}</p>
          <div className="space-y-2">
            {[t('ai.feature1'), t('ai.feature2'), t('ai.feature3')].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-gray-600">
                <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </div>
            ))}
          </div>
        </div>
        <ModalFooter
          primaryLabel={t('ai.understood')}
          cancelLabel={t('ai.understood')}
          onCancel={() => setAiToastOpen(false)}
          type="button"
          onClick={() => setAiToastOpen(false)}
        />
      </ModalShell>

      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => setAiToastOpen(true)}
          title={t('ai.badge')}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 max-sm:w-full"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {t('generateAI')}
          <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
            {t('aiComingSoon')}
          </span>
        </button>
      </div>

      <FilterShell
        className="mb-6"
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
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 items-end">
          <FilterSelect
            id="filter-mes"
            label={t('filter.month')}
            value={filterState.mes}
            onChange={(e) => setFilterField('mes', e.target.value)}
          >
            {MONTH_KEYS.map((m) => <option key={m} value={String(m)}>{t(`months.${m}`)}</option>)}
          </FilterSelect>
          <FilterSelect
            id="filter-ano"
            label={t('filter.year')}
            value={filterState.ano}
            onChange={(e) => setFilterField('ano', e.target.value)}
          >
            {anos.map(a => <option key={a} value={String(a)}>{a}</option>)}
          </FilterSelect>
          <FilterSelect
            id="filter-ministerio"
            label={t('filter.ministry')}
            value={filterState.ministerioId}
            onChange={(e) => setFilterField('ministerioId', e.target.value)}
          >
            <option value="">{t('filter.all')}</option>
            {ministerios.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </FilterSelect>
        </div>
      </FilterShell>

      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl flex justify-between items-center">
          {t('errorLoading')}
          <button onClick={refetch} className="underline font-semibold hover:text-red-800">Recarregar</button>
        </div>
      )}

      {/* ─── Seletor de escalas (faixa horizontal) ─────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide px-1">
          {t(`months.${parseInt(filterState.mes)}` as never)} / {filterState.ano}
        </h2>

        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] w-56 shrink-0 rounded-2xl" />
            ))}
          </div>
        ) : escalas.length === 0 ? (
          <EmptyState
            title={t('noSchedules')}
            description={canCreateEscala ? t('noSchedulesDesc') : undefined}
          />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {escalas.map((e) => (
              <button
                key={e.id}
                id={`escala-card-${e.id}`}
                onClick={() => fetchDetail(e)}
                className={`shrink-0 w-56 text-left p-4 rounded-2xl border transition-all ${
                  selectedEscala?.id === e.id
                    ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                    : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{e.ministerio?.nome || '—'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t(`months.${e.mes}` as never)} / {e.ano}</p>
                  </div>
                  <StatusBadge
                    label={STATUS_LABELS[e.status]}
                    className={`text-[11px] border ${STATUS_ESCALA_COLOR[e.status]}`}
                  />
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  {e._count?.dias ?? 0} {e._count?.dias === 1 ? 'dia' : 'dias'} cadastrado{e._count?.dias === 1 ? '' : 's'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Grade da Escala (largura total) ───────────────────────────────── */}
      <div>
          {!selectedEscala ? (
            <div className="flex items-center justify-center h-full min-h-[300px] bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <div className="text-center text-sm text-gray-400 space-y-1">
                <svg className="w-10 h-10 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="font-medium">{t('selectSchedule')}</p>
                <p className="text-xs">{t('selectScheduleDesc')}</p>
              </div>
            </div>
          ) : loadingDetail ? (
            <div className="space-y-4">
              <Skeleton className="h-12 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl bg-gray-50 border border-gray-100" />
            </div>
          ) : detailedEscala ? (
            <div className="space-y-4">
              <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-xs flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-base font-bold text-gray-800">
                    {detailedEscala.ministerio?.nome} — {t(`months.${detailedEscala.mes}` as never)} {detailedEscala.ano}
                  </h2>
                  {detailedEscala.observacoes && (
                    <p className="text-xs text-gray-500 mt-0.5">{detailedEscala.observacoes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge
                    label={STATUS_LABELS[detailedEscala.status]}
                    className={`px-2.5 py-1 font-bold border ${STATUS_ESCALA_COLOR[detailedEscala.status]}`}
                  />
                  {canManageSelectedEscala && (
                    <>
                      {detailedEscala.status === 'RASCUNHO' && (
                        <button
                          id="btn-publicar-escala"
                          onClick={() => handleUpdateStatus('PUBLICADA')}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all"
                        >
                          {t('status.PUBLICADA')}
                        </button>
                      )}
                      {detailedEscala.status === 'PUBLICADA' && (
                        <button
                          onClick={() => handleUpdateStatus('ENCERRADA')}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-gray-700 hover:bg-gray-800 rounded-xl transition-all"
                        >
                          {t('status.ENCERRADA')}
                        </button>
                      )}
                      <button
                        onClick={handleDelete}
                        className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-100 hover:bg-red-50 rounded-xl transition-all"
                      >
                        Excluir
                      </button>
                    </>
                  )}
                </div>
              </div>

              <EscalaGrid
                escala={detailedEscala}
                ministryMembers={ministryMembers}
                canManage={canManageSelectedEscala}
                tGrid={tGrid}
                onToggleCelula={handleToggleCelula}
                onAddMembro={async (diaId, membroId, funcaoId) => {
                  try {
                    const item = await addMembroItem(diaId, membroId, funcaoId);
                    appendEscalaItem(diaId, item);
                  } catch (err: unknown) {
                    showToast(getErrorMessage(err, 'Erro ao adicionar membro na escala.'), 'error');
                    throw err;
                  }
                }}
                onRemoveMembro={async (itemId) => {
                  try {
                    await removeMembroItem(itemId);
                    removeEscalaItem(itemId);
                  } catch (err: unknown) {
                    showToast(getErrorMessage(err, 'Erro ao remover membro da escala.'), 'error');
                    throw err;
                  }
                }}
                onAddDia={async (data, titulo) => {
                  await addDia(detailedEscala.id, data, titulo);
                  await refreshDetail();
                }}
                onRemoveDia={async (diaId) => {
                  setPendingConfirmAction({
                    type: 'removeDia',
                    label: tGrid('removeDayConfirm'),
                    diaId,
                  });
                }}
                onReorderDias={async (diaIds) => {
                  await reorderDias(detailedEscala.id, diaIds);
                }}
              />
            </div>
          ) : null}
      </div>

      {/* ─── Modal Criar Escala ───────────────────────────────────────────────── */}
      <ModalShell
        isOpen={isCreateOpen}
        title={t('modal.title')}
        onClose={() => {
          setIsCreateOpen(false);
          setCreateError('');
        }}
        size="md"
      >
        <form id="escala-form" onSubmit={handleCreate}>
          <div className="space-y-4 p-6">
            {createError && <ModalError message={createError} />}

            <div className="grid grid-cols-2 gap-4">
              <SelectField
                id="create-mes"
                label={`${t('modal.month')} *`}
                value={newMes}
                onChange={(e) => setNewMes(parseInt(e.target.value))}
              >
                {MONTH_KEYS.map((m) => <option key={m} value={m}>{t(`months.${m}`)}</option>)}
              </SelectField>
              <SelectField
                id="create-ano"
                label={`${t('modal.year')} *`}
                value={newAno}
                onChange={(e) => setNewAno(parseInt(e.target.value))}
              >
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </SelectField>
            </div>

            <SelectField
              id="create-ministerio"
              label={`${t('modal.ministry')} *`}
              value={newMinId}
              required
              onChange={(e) => setNewMinId(e.target.value)}
            >
              <option value="">{t('modal.ministryPlaceholder')}</option>
              {ministerios.filter(m => m.ativo).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </SelectField>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">{t('modal.weekdays')}</label>
              <p className="text-xs text-gray-400">{t('modal.weekdaysDesc')}</p>
              <div className="flex gap-1.5 flex-wrap">
                {WEEKDAY_KEYS.map(({ key, value }) => {
                  const selected = newDiasSemana.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setNewDiasSemana(prev =>
                        selected ? prev.filter(d => d !== value) : [...prev, value]
                      )}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all select-none ${
                        selected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                    >
                      {t(`modal.days.${key}` as never)}
                    </button>
                  );
                })}
              </div>
              {newDiasSemana.length > 0 && (() => {
                const totalDias = new Date(newAno, newMes, 0).getDate();
                let count = 0;
                for (let d = 1; d <= totalDias; d++) {
                  if (newDiasSemana.includes(new Date(newAno, newMes - 1, d).getDay())) count++;
                }
                return (
                  <p className="text-xs text-indigo-600 font-semibold">
                    {count === 1 ? t('modal.dayGenerated', { count }) : t('modal.daysGenerated', { count })}
                  </p>
                );
              })()}
            </div>

            <TextareaField
              label={t('modal.notes')}
              value={newObs}
              onChange={(e) => setNewObs(e.target.value)}
              rows={2}
              placeholder={t('modal.notesPlaceholder')}
            />
          </div>

          <ModalFooter
            form="escala-form"
            primaryLabel={creating ? t('modal.creating') : t('modal.create')}
            onCancel={() => {
              setIsCreateOpen(false);
              setCreateError('');
            }}
            loading={creating}
            disabled={!newMinId}
          />
        </form>
      </ModalShell>

      <ConfirmDialog
        isOpen={!!pendingConfirmAction}
        title={pendingConfirmAction?.type === 'deleteEscala' ? t('deleteTitle') : tGrid('removeDay')}
        description={pendingConfirmAction?.label || ''}
        confirmLabel={pendingConfirmAction?.type === 'deleteEscala' ? 'Excluir' : 'Remover'}
        variant={pendingConfirmAction?.type === 'deleteEscala' ? 'danger' : 'warning'}
        loading={confirmLoading}
        onConfirm={executePendingAction}
        onCancel={() => setPendingConfirmAction(null)}
      />
    </div>
  );
}
