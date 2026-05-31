'use client';

import { useState, useEffect } from 'react';
import { useEscalas, FilterEscalas } from '@/hooks/use-escalas';
import { PageHeader } from '@/components/app/page-header';
import { DataTable, Column } from '@/components/app/data-table';
import { api } from '@/lib/api';
import { Escala, EscalaItem, Ministerio } from '@/types';
import { formatDate } from '@/lib/utils';
import { getCurrentUser } from '@/lib/auth';

// ─── Toast inline ─────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

let toastCounter = 0;

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function EscalasPage() {
  const {
    escalas,
    loading,
    error,
    refetch,
    applyFilter,
    createEscala,
    updateEscala,
    deleteEscala,
    confirmarPresenca,
    addMembroItem,
    removeMembroItem,
    updateMembroItemStatus,
  } = useEscalas();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  function showToast(message: string, type: ToastType = 'success') {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  // Modals and selections
  const [selectedEscala, setSelectedEscala] = useState<Escala | null>(null);
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [escalaToDelete, setEscalaToDelete] = useState<Escala | null>(null);

  // Saving states
  const [isSavingScale, setIsSavingScale] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isDeletingScale, setIsDeletingScale] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // New Scale form
  const [titulo, setTitulo] = useState('');
  const [dataEscala, setDataEscala] = useState('');
  const [ministerioId, setMinisterioId] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Add Scale Item form
  const [selectedMembroId, setSelectedMembroId] = useState('');
  const [funcao, setFuncao] = useState('');
  const [itemObs, setItemObs] = useState('');
  const [ministryMembers, setMinistryMembers] = useState<any[]>([]);
  const [loadingMinMembers, setLoadingMinMembers] = useState(false);

  // Filter states
  const [filterMinId, setFilterMinId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  useEffect(() => {
    setCurrentUser(getCurrentUser());

    // Load ministries for filters & form
    api.get<Ministerio[]>('/api/ministerios')
      .then((res) => setMinisterios(Array.isArray(res) ? res : []))
      .catch((err) => console.error(err));
  }, []);

  // Fetch members of the selected scale's ministry when team modal is opened
  useEffect(() => {
    if (isTeamModalOpen && selectedEscala) {
      setLoadingMinMembers(true);
      api.get<any>(`/api/ministerios/${selectedEscala.ministerioId}`)
        .then((res) => {
          setMinistryMembers(res?.membros || []);
        })
        .catch((err) => console.error(err))
        .finally(() => setLoadingMinMembers(false));
    }
  }, [isTeamModalOpen, selectedEscala]);

  const canManage = currentUser?.role === 'ADMIN_GERAL' || currentUser?.role === 'PASTOR' || currentUser?.role === 'LIDER_MINISTERIO';

  // Apply filters
  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    applyFilter({
      ministerioId: filterMinId || undefined,
      status: filterStatus || undefined,
      dataInicio: filterStart || undefined,
      dataFim: filterEnd || undefined,
    });
  }

  // Clear filters
  function handleClear() {
    setFilterMinId('');
    setFilterStatus('');
    setFilterStart('');
    setFilterEnd('');
    applyFilter({});
  }

  // Handle save scale info (Create/Update)
  async function handleSaveScale(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || !dataEscala || !ministerioId) return;
    setIsSavingScale(true);

    try {
      const payload = {
        titulo: titulo.trim(),
        data: new Date(dataEscala).toISOString(),
        ministerioId,
        observacoes: observacoes.trim() || undefined,
      };

      if (selectedEscala) {
        await updateEscala(selectedEscala.id, payload);
        showToast('Escala atualizada com sucesso!');
      } else {
        await createEscala(payload);
        showToast('Escala criada com sucesso!');
      }
      setIsScaleModalOpen(false);
      setSelectedEscala(null);
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar escala.', 'error');
    } finally {
      setIsSavingScale(false);
    }
  }

  // Handle delete scale (com modal de confirmação inline)
  function openDeleteConfirm(escala: Escala) {
    setEscalaToDelete(escala);
    setIsDeleteConfirmOpen(true);
  }

  async function handleConfirmDelete() {
    if (!escalaToDelete) return;
    setIsDeletingScale(true);
    try {
      await deleteEscala(escalaToDelete.id);
      showToast(`Escala "${escalaToDelete.titulo}" excluída com sucesso.`);
      setIsDeleteConfirmOpen(false);
      setEscalaToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir escala.', 'error');
    } finally {
      setIsDeletingScale(false);
    }
  }

  // Quick Publish/Finish scale status
  async function handleUpdateStatus(escala: Escala, status: 'RASCUNHO' | 'PUBLICADA' | 'ENCERRADA') {
    setUpdatingStatusId(escala.id + status);
    try {
      await updateEscala(escala.id, { status });
      const labels = { PUBLICADA: 'publicada', ENCERRADA: 'encerrada', RASCUNHO: 'rascunho' };
      showToast(`Escala ${labels[status]} com sucesso!`);
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar status da escala.', 'error');
    } finally {
      setUpdatingStatusId(null);
    }
  }

  // Scheduled member item CRUD
  async function handleAddMemberItem(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMembroId || !funcao.trim() || !selectedEscala) return;
    setIsSavingItem(true);

    try {
      await addMembroItem(selectedEscala.id, selectedMembroId, funcao.trim(), itemObs.trim() || undefined);
      setSelectedMembroId('');
      setFuncao('');
      setItemObs('');
      showToast('Membro adicionado à escala!');

      // Refresh the selected escala details
      const updated = await api.get<Escala>(`/api/escalas/${selectedEscala.id}`);
      setSelectedEscala(updated);
    } catch (err: any) {
      showToast(err.message || 'Erro ao escalar membro.', 'error');
    } finally {
      setIsSavingItem(false);
    }
  }

  async function handleRemoveMemberItem(membroId: string) {
    if (!selectedEscala) return;
    try {
      await removeMembroItem(selectedEscala.id, membroId);
      showToast('Membro removido da escala.');
      const updated = await api.get<Escala>(`/api/escalas/${selectedEscala.id}`);
      setSelectedEscala(updated);
    } catch (err: any) {
      showToast(err.message || 'Erro ao remover membro da escala.', 'error');
    }
  }

  async function handleUpdateItemStatus(membroId: string, status: 'PENDENTE' | 'CONFIRMADO' | 'RECUSADO') {
    if (!selectedEscala) return;
    try {
      await updateMembroItemStatus(selectedEscala.id, membroId, status);
      const updated = await api.get<Escala>(`/api/escalas/${selectedEscala.id}`);
      setSelectedEscala(updated);
    } catch (err: any) {
      showToast(err.message || 'Erro ao alterar status de confirmação.', 'error');
    }
  }

  // Current User quick confirmation handler
  async function handleMyConfirmation(escalaId: string, status: 'CONFIRMADO' | 'RECUSADO') {
    try {
      await confirmarPresenca(escalaId, status);
      showToast(status === 'CONFIRMADO' ? 'Presença confirmada! ✅' : 'Presença recusada.');
    } catch (err: any) {
      showToast(err.message || 'Erro ao confirmar presença.', 'error');
    }
  }

  // Pre-fill fields for editing basic scale
  function openEditScale(escala: Escala) {
    setSelectedEscala(escala);
    setTitulo(escala.titulo);
    setDataEscala(escala.data ? escala.data.split('T')[0] : '');
    setMinisterioId(escala.ministerioId);
    setObservacoes(escala.observacoes || '');
    setIsScaleModalOpen(true);
  }

  // Pre-fill fields for creating scale
  function openCreateScale() {
    setSelectedEscala(null);
    setTitulo('');
    setDataEscala('');
    setMinisterioId('');
    setObservacoes('');
    setIsScaleModalOpen(true);
  }

  // Confirmation summary helper
  function getConfirmacaoSummary(itens?: EscalaItem[]) {
    if (!itens || itens.length === 0) return null;
    const confirmados = itens.filter((i) => i.statusConfirmacao === 'CONFIRMADO').length;
    const pendentes = itens.filter((i) => i.statusConfirmacao === 'PENDENTE').length;
    const recusados = itens.filter((i) => i.statusConfirmacao === 'RECUSADO').length;
    return { confirmados, pendentes, recusados };
  }

  // Columns definition
  const columns: Column<Escala>[] = [
    {
      key: 'titulo',
      header: 'Escala / Data',
      render: (e) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-gray-800">{e.titulo}</span>
          <span className="text-xs text-gray-500">{formatDate(e.data)}</span>
        </div>
      ),
    },
    {
      key: 'ministerio',
      header: 'Ministério',
      render: (e) => (
        <span className="inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
          {e.ministerio?.nome || 'Sem ministério'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => {
        const badges: Record<string, string> = {
          RASCUNHO: 'bg-gray-100 text-gray-700 border-gray-200',
          PUBLICADA: 'bg-blue-50 text-blue-700 border-blue-150',
          ENCERRADA: 'bg-emerald-50 text-emerald-700 border-emerald-150',
        };
        const labels: Record<string, string> = {
          RASCUNHO: 'Rascunho',
          PUBLICADA: 'Publicada',
          ENCERRADA: 'Encerrada',
        };
        return (
          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${badges[e.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
            {labels[e.status] ?? e.status}
          </span>
        );
      },
    },
    {
      key: 'equipe',
      header: 'Equipe',
      render: (e) => {
        const summary = getConfirmacaoSummary(e.itens);
        const count = e.itens?.length ?? 0;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-500 font-medium">
              {count} {count === 1 ? 'membro' : 'membros'}
            </span>
            {summary && count > 0 && (
              <span className="text-[10px] text-gray-400 font-medium">
                ✅{summary.confirmados} · ⏳{summary.pendentes} · ❌{summary.recusados}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'minhaPresenca',
      header: 'Minha Presença',
      render: (e) => {
        if (!currentUser) return null;

        // Find if current user is scheduled (by email comparison)
        const myItem = e.itens?.find((item) => item.membro?.email === currentUser.email);
        if (!myItem) return <span className="text-xs text-gray-300">Não escalado</span>;

        const colors: Record<string, string> = {
          PENDENTE: 'text-amber-600 bg-amber-50 border-amber-200',
          CONFIRMADO: 'text-emerald-600 bg-emerald-50 border-emerald-200',
          RECUSADO: 'text-rose-600 bg-rose-50 border-rose-200',
        };

        return (
          <div className="flex flex-col gap-1.5 items-start">
            <span className={`inline-flex px-2 py-0.5 text-xs font-bold border rounded-lg ${colors[myItem.statusConfirmacao]}`}>
              {myItem.statusConfirmacao === 'PENDENTE' && '⏳ Pendente'}
              {myItem.statusConfirmacao === 'CONFIRMADO' && '✅ Confirmado'}
              {myItem.statusConfirmacao === 'RECUSADO' && '❌ Recusado'}
            </span>

            {/* Quick buttons to confirm/refuse presence */}
            {e.status === 'PUBLICADA' && myItem.statusConfirmacao === 'PENDENTE' && (
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleMyConfirmation(e.id, 'CONFIRMADO')}
                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold shadow-sm"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => handleMyConfirmation(e.id, 'RECUSADO')}
                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[10px] font-bold shadow-sm"
                >
                  Recusar
                </button>
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (e) => (
        <div className="flex items-center justify-end gap-2">
          {/* Manage items action */}
          <button
            onClick={() => {
              setSelectedEscala(e);
              setIsTeamModalOpen(true);
            }}
            className="px-2.5 py-1 border border-gray-200 hover:border-gray-300 rounded-xl text-xs font-semibold text-gray-600 bg-white transition-all flex items-center gap-1"
            title="Gerenciar escalados"
          >
            <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Membros
          </button>

          {canManage && (
            <>
              {/* Quick actions for publishing or finishing scale */}
              {e.status === 'RASCUNHO' && (
                <button
                  onClick={() => handleUpdateStatus(e, 'PUBLICADA')}
                  disabled={updatingStatusId === e.id + 'PUBLICADA'}
                  className="px-2 py-1 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-100 disabled:opacity-50 transition-all"
                >
                  {updatingStatusId === e.id + 'PUBLICADA' ? '...' : 'Publicar'}
                </button>
              )}
              {e.status === 'PUBLICADA' && (
                <button
                  onClick={() => handleUpdateStatus(e, 'ENCERRADA')}
                  disabled={updatingStatusId === e.id + 'ENCERRADA'}
                  className="px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 disabled:opacity-50 transition-all"
                >
                  {updatingStatusId === e.id + 'ENCERRADA' ? '...' : 'Encerrar'}
                </button>
              )}

              {/* Edit basic scale */}
              <button
                onClick={() => openEditScale(e)}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
                title="Editar dados básicos"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>

              {/* Delete scale */}
              <button
                onClick={() => openDeleteConfirm(e)}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
                title="Excluir escala"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Toast notifications */}
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium border animate-in slide-in-from-right-4 duration-300 ${
              t.type === 'success'
                ? 'bg-white text-emerald-700 border-emerald-100'
                : t.type === 'error'
                ? 'bg-white text-red-700 border-red-100'
                : 'bg-white text-indigo-700 border-indigo-100'
            }`}
          >
            {t.type === 'success' && <span className="text-base">✅</span>}
            {t.type === 'error' && <span className="text-base">❌</span>}
            {t.type === 'info' && <span className="text-base">ℹ️</span>}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      <PageHeader
        title="Escalas de Serviço"
        description="Agende equipes de serviço nos ministérios, envie convites de confirmação e monitore presenças."
        action={
          canManage ? (
            <button
              onClick={openCreateScale}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Nova Escala
            </button>
          ) : undefined
        }
      />

      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => refetch()} className="underline font-semibold hover:text-red-800">
            Recarregar
          </button>
        </div>
      )}

      {/* Filters Form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <form onSubmit={handleFilter} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          {/* Ministry */}
          <div className="space-y-1.5">
            <label htmlFor="filter-min" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Ministério
            </label>
            <select
              id="filter-min"
              value={filterMinId}
              onChange={(e) => setFilterMinId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white text-gray-700"
            >
              <option value="">Todos os ministérios</option>
              {ministerios.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label htmlFor="filter-status" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Status Escala
            </label>
            <select
              id="filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white text-gray-700"
            >
              <option value="">Todos os status</option>
              <option value="RASCUNHO">Rascunho</option>
              <option value="PUBLICADA">Publicada</option>
              <option value="ENCERRADA">Encerrada</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="space-y-1.5">
            <label htmlFor="filter-start" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              De (Data)
            </label>
            <input
              id="filter-start"
              type="date"
              value={filterStart}
              onChange={(e) => setFilterStart(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none"
            />
          </div>

          {/* End Date */}
          <div className="space-y-1.5">
            <label htmlFor="filter-end" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Até (Data)
            </label>
            <input
              id="filter-end"
              type="date"
              value={filterEnd}
              onChange={(e) => setFilterEnd(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white font-semibold rounded-xl text-sm transition-all"
            >
              Filtrar
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl text-sm transition-all"
            >
              Limpar
            </button>
          </div>
        </form>
      </div>

      {/* DataTable of Scales */}
      <DataTable
        columns={columns}
        data={escalas}
        loading={loading}
        itemsPerPage={10}
        emptyTitle="Nenhuma escala de serviço encontrada"
        emptyDescription="Crie uma nova escala de serviço para organizar as atribuições e funções do ministério."
      />

      {/* ─── Delete Confirmation Modal ─── */}
      {isDeleteConfirmOpen && escalaToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-800">Excluir escala?</h3>
              <p className="text-sm text-gray-500">
                Tem certeza que deseja excluir a escala{' '}
                <span className="font-semibold text-gray-700">"{escalaToDelete.titulo}"</span>?
                Todos os membros escalados também serão removidos. Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setEscalaToDelete(null);
                }}
                disabled={isDeletingScale}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeletingScale}
                className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {isDeletingScale && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                )}
                {isDeletingScale ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Scale Creation / Edit Modal ─── */}
      {isScaleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/20">
              <h2 className="text-lg font-bold text-gray-800">
                {selectedEscala ? 'Editar Escala' : 'Nova Escala de Serviço'}
              </h2>
              <button
                onClick={() => {
                  setIsScaleModalOpen(false);
                  setSelectedEscala(null);
                }}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveScale}>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="escala-titulo" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Título do Culto / Escala *
                  </label>
                  <input
                    id="escala-titulo"
                    type="text"
                    required
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex: Culto de Celebração de Domingo"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="escala-data" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Data do Evento *
                  </label>
                  <input
                    id="escala-data"
                    type="date"
                    required
                    value={dataEscala}
                    onChange={(e) => setDataEscala(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="escala-min" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Ministério Atendido *
                  </label>
                  <select
                    id="escala-min"
                    required
                    value={ministerioId}
                    onChange={(e) => setMinisterioId(e.target.value)}
                    disabled={!!selectedEscala}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white text-gray-700 disabled:opacity-60"
                  >
                    <option value="">Selecione um ministério...</option>
                    {ministerios.filter(m => m.ativo).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                  {!!selectedEscala && (
                    <p className="text-[11px] text-gray-400">O ministério não pode ser alterado após a criação.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="escala-obs" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Instruções / Observações
                  </label>
                  <textarea
                    id="escala-obs"
                    rows={3}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Instruções para a equipe de serviço escalada..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                <button
                  type="button"
                  onClick={() => {
                    setIsScaleModalOpen(false);
                    setSelectedEscala(null);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingScale}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isSavingScale && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  )}
                  {isSavingScale ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Scale Item Team Management Modal ─── */}
      {isTeamModalOpen && selectedEscala && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/20">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{selectedEscala.titulo}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ministério: {selectedEscala.ministerio?.nome} • Data: {formatDate(selectedEscala.data)}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsTeamModalOpen(false);
                  setSelectedEscala(null);
                }}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">

              {/* Resumo de confirmações */}
              {selectedEscala.itens && selectedEscala.itens.length > 0 && (() => {
                const s = getConfirmacaoSummary(selectedEscala.itens);
                if (!s) return null;
                return (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-150 rounded-2xl">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Confirmações:</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
                      ✅ {s.confirmados} confirmados
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg">
                      ⏳ {s.pendentes} pendentes
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-lg">
                      ❌ {s.recusados} recusados
                    </span>
                  </div>
                );
              })()}

              {/* Aviso de escala encerrada */}
              {selectedEscala.status === 'ENCERRADA' && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-500">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Esta escala está encerrada. Não é possível adicionar ou remover membros.
                </div>
              )}

              {/* Form to scale a member (only for leaders/admins and non-ENCERRADA) */}
              {canManage && selectedEscala.status !== 'ENCERRADA' && (
                <form onSubmit={handleAddMemberItem} className="bg-gray-50 border border-gray-150 p-4 rounded-2xl">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-3">
                    Escalar Membro do Ministério
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div className="space-y-1">
                      <label htmlFor="team-membro" className="text-[10px] font-bold text-gray-400 uppercase">Membro</label>
                      <select
                        id="team-membro"
                        required
                        value={selectedMembroId}
                        onChange={(e) => setSelectedMembroId(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-gray-250 rounded-xl text-xs focus:outline-none"
                      >
                        <option value="">Selecione...</option>
                        {loadingMinMembers ? (
                          <option>Carregando membros...</option>
                        ) : ministryMembers.length === 0 ? (
                          <option>Sem membros no ministério</option>
                        ) : (
                          ministryMembers.map((mm) => (
                            <option key={mm.membro.id} value={mm.membro.id}>
                              {mm.membro.nome}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="team-funcao" className="text-[10px] font-bold text-gray-400 uppercase">Função / Instrumento</label>
                      <input
                        id="team-funcao"
                        type="text"
                        required
                        value={funcao}
                        onChange={(e) => setFuncao(e.target.value)}
                        placeholder="Ex: Teclado, Recepção 1"
                        className="w-full px-3 py-1.5 bg-white border border-gray-250 rounded-xl text-xs focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="team-obs" className="text-[10px] font-bold text-gray-400 uppercase">Anotação (Opcional)</label>
                      <input
                        id="team-obs"
                        type="text"
                        value={itemObs}
                        onChange={(e) => setItemObs(e.target.value)}
                        placeholder="Observação rápida..."
                        className="w-full px-3 py-1.5 bg-white border border-gray-250 rounded-xl text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end mt-3">
                    <button
                      type="submit"
                      disabled={!selectedMembroId || !funcao.trim() || isSavingItem}
                      className="px-4 py-1.5 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-2"
                    >
                      {isSavingItem && (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                      )}
                      {isSavingItem ? 'Adicionando...' : 'Adicionar à Escala'}
                    </button>
                  </div>
                </form>
              )}

              {/* Scheduled Members List */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                  Membros Escalados
                </span>

                {!selectedEscala.itens || selectedEscala.itens.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8 bg-gray-50/50 rounded-2xl">
                    Nenhum membro escalado ainda.
                  </p>
                ) : (
                  <div className="border border-gray-100 rounded-2xl divide-y divide-gray-100 overflow-hidden bg-white shadow-sm">
                    {selectedEscala.itens.map((item) => {
                      const colors: Record<string, string> = {
                        PENDENTE: 'text-amber-600 bg-amber-50 border-amber-200',
                        CONFIRMADO: 'text-emerald-600 bg-emerald-50 border-emerald-200',
                        RECUSADO: 'text-rose-600 bg-rose-50 border-rose-200',
                      };

                      return (
                        <div key={item.id} className="flex items-center justify-between p-4 hover:bg-gray-50/30 transition-colors">
                          <div className="flex-1 pr-4">
                            <p className="text-sm font-bold text-gray-800">{item.membro?.nome}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-0.5 text-xs text-gray-500">
                              <span><strong className="font-semibold text-gray-700">Função:</strong> {item.funcao}</span>
                              {item.observacoes && (
                                <span><strong className="font-semibold text-gray-700">Obs:</strong> {item.observacoes}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Confirmation display and override option */}
                            {canManage && selectedEscala.status !== 'ENCERRADA' ? (
                              <select
                                value={item.statusConfirmacao}
                                onChange={(e) => handleUpdateItemStatus(item.membroId, e.target.value as any)}
                                className={`px-2 py-1 border rounded-lg text-xs font-bold focus:outline-none ${
                                  item.statusConfirmacao === 'PENDENTE' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  item.statusConfirmacao === 'CONFIRMADO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                <option value="PENDENTE">⏳ Pendente</option>
                                <option value="CONFIRMADO">✅ Confirmado</option>
                                <option value="RECUSADO">❌ Recusado</option>
                              </select>
                            ) : (
                              <span className={`inline-flex px-2 py-0.5 text-xs font-bold border rounded-lg ${colors[item.statusConfirmacao]}`}>
                                {item.statusConfirmacao === 'PENDENTE' && '⏳ Pendente'}
                                {item.statusConfirmacao === 'CONFIRMADO' && '✅ Confirmado'}
                                {item.statusConfirmacao === 'RECUSADO' && '❌ Recusado'}
                              </span>
                            )}

                            {/* Remove item */}
                            {canManage && selectedEscala.status !== 'ENCERRADA' && (
                              <button
                                onClick={() => handleRemoveMemberItem(item.membroId)}
                                className="p-1 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
                                title="Remover da escala"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/20">
              <button
                type="button"
                onClick={() => {
                  setIsTeamModalOpen(false);
                  setSelectedEscala(null);
                }}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
