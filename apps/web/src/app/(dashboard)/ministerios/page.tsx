'use client';

import { useState, useEffect } from 'react';
import { useMinisterios } from '@/hooks/use-ministerios';
import { useTranslations } from 'next-intl';

import { PageHeader } from '@/components/app/page-header';
import { SkeletonList } from '@/components/app/skeleton';
import { EmptyState } from '@/components/app/empty-state';
import { EntityCard } from '@/components/app/entity-card';
import { MembroSearchCombobox, MembroOption } from '@/components/app/membro-search-combobox';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { ModalShell, ModalError, ModalFooter } from '@/components/app/modal-shell';
import { TabsShell, TabPanel } from '@/components/app/tabs-shell';
import { InputField, TextareaField } from '@/components/app/form-field';
import { api } from '@/lib/api';
import { Ministerio, Membro, AuthUser, MinistryRole } from '@/types';

type FeedbackMessage = {
  type: 'success' | 'error';
  message: string;
} | null;

export default function MinisteriosPage() {
  const t = useTranslations('ministries');
  const {
    ministerios,
    loading,
    error,
    refetch,
    createMinisterio,
    updateMinisterio,
    deleteMinisterio,
    addMembro,
    removeMembro,
    updateMembroRole,
  } = useMinisterios();

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [selectedMinisterio, setSelectedMinisterio] = useState<Ministerio | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackMessage>(null);
  const [pendingArchiveMinisterio, setPendingArchiveMinisterio] = useState<Ministerio | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    api.get<AuthUser>('/api/auth/me')
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'STAFF';
  const canManageSelectedMinisterio =
    canManage || (currentUser?.role === 'BASIC' && !!selectedMinisterio);

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [modalTab, setModalTab] = useState<'info' | 'membros' | 'funcoes'>('info');

  const [funcoes, setFuncoes] = useState<string[]>([]);
  const [novaFuncao, setNovaFuncao] = useState('');
  const [savingFuncoes, setSavingFuncoes] = useState(false);

  const [detailedInfo, setDetailedInfo] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [expandedMembro, setExpandedMembro] = useState<string | null>(null);
  const [funcoesPorMembro, setFuncoesPorMembro] = useState<Record<string, string[]>>({});
  const [savingFuncoesMembro, setSavingFuncoesMembro] = useState<string | null>(null);

  const [allMembros, setAllMembros] = useState<Membro[]>([]);
  const [selectedMembroToAdd, setSelectedMembroToAdd] = useState('');
  const [membroSearchToAdd, setMembroSearchToAdd] = useState('');
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState<MinistryRole>('MEMBER');

  async function fetchDetails(id: string) {
    setLoadingDetails(true);
    try {
      const data = await api.get<any>(`/api/ministerios/${id}`);
      setDetailedInfo(data);
    } catch (e) {
      console.error('Erro ao buscar detalhes:', e);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function loadOptions(ministerioId?: string) {
    if (!canManage && !ministerioId) {
      setAllMembros([]);
      return;
    }

    try {
      const url = canManage
        ? '/api/membros?status=ATIVO'
        : `/api/ministerios/${ministerioId}/membros-disponiveis`;
      const membrosData = await api.get<Membro[]>(url);
      setAllMembros(Array.isArray(membrosData) ? membrosData : []);
    } catch (e) {
      console.error('Erro ao carregar opções para ministérios:', e);
    }
  }

  useEffect(() => {
    if (isModalOpen) {
      if (canManage || (currentUser?.role === 'BASIC' && selectedMinisterio)) {
        loadOptions(selectedMinisterio?.id);
      } else {
        setAllMembros([]);
      }
      if (selectedMinisterio) {
        setNome(selectedMinisterio.nome);
        setDescricao(selectedMinisterio.descricao || '');
        setModalTab('info');
        fetchDetails(selectedMinisterio.id);
      } else {
        setNome('');
        setDescricao('');
        setFuncoes([]);
        setModalTab('info');
        setDetailedInfo(null);
      }
    }
  }, [isModalOpen, selectedMinisterio, currentUser]);

  useEffect(() => {
    if (detailedInfo?.funcoes) {
      setFuncoes(detailedInfo.funcoes.map((f: any) => f.nome));
    }
    if (detailedInfo?.membros) {
      const map: Record<string, string[]> = {};
      for (const m of detailedInfo.membros) {
        map[m.membroId] = (m.funcoesDisponiveis ?? []).map((fd: any) => fd.funcaoId);
      }
      setFuncoesPorMembro(map);
    }
  }, [detailedInfo]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setFeedback(null);
    try {
      if (selectedMinisterio) {
        await updateMinisterio(selectedMinisterio.id, { nome, descricao });
      } else {
        await createMinisterio({ nome, descricao, funcoes: funcoes.filter(Boolean) });
      }
      setIsModalOpen(false);
      setSelectedMinisterio(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || t('errorSave') });
    }
  }

  async function handleSaveFuncoes() {
    if (!selectedMinisterio) return;
    setSavingFuncoes(true);
    setFeedback(null);
    try {
      await updateMinisterio(selectedMinisterio.id, { funcoes: funcoes.filter(Boolean) });
      await fetchDetails(selectedMinisterio.id);
      setFeedback({ type: 'success', message: t('functions.saved') });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || t('functions.errorSave') });
    } finally {
      setSavingFuncoes(false);
    }
  }

  function handleAddFuncao() {
    const trimmed = novaFuncao.trim();
    if (!trimmed || funcoes.includes(trimmed)) return;
    setFuncoes([...funcoes, trimmed]);
    setNovaFuncao('');
  }

  function handleRemoveFuncao(nome: string) {
    setFuncoes(funcoes.filter((f) => f !== nome));
  }

  function handleDelete(m: Ministerio) {
    setPendingArchiveMinisterio(m);
  }

  async function confirmArchiveMinisterio() {
    if (!pendingArchiveMinisterio) return;
    setConfirmLoading(true);
    setFeedback(null);
    try {
      await deleteMinisterio(pendingArchiveMinisterio.id);
      setPendingArchiveMinisterio(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || t('errorArchive') });
    } finally {
      setConfirmLoading(false);
    }
  }

  async function handleAddMembro() {
    if (!selectedMembroToAdd || !selectedMinisterio) return;
    setFeedback(null);
    try {
      const roleToAdd = canManage || selectedRoleToAdd !== 'LEADER'
        ? selectedRoleToAdd
        : 'MEMBER';

      await addMembro(
        selectedMinisterio.id,
        selectedMembroToAdd,
        roleToAdd,
      );
      setSelectedMembroToAdd('');
      setMembroSearchToAdd('');
      setSelectedRoleToAdd('MEMBER');
      await fetchDetails(selectedMinisterio.id);
      await loadOptions(selectedMinisterio.id);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || t('members.errorAdd') });
    }
  }

  async function handleRemoveMembro(membroId: string) {
    if (!selectedMinisterio) return;
    setFeedback(null);
    try {
      await removeMembro(selectedMinisterio.id, membroId);
      fetchDetails(selectedMinisterio.id);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || t('members.errorRemove') });
    }
  }

  async function handleChangeRole(membroId: string, role: MinistryRole) {
    if (!selectedMinisterio) return;
    setFeedback(null);
    try {
      await updateMembroRole(selectedMinisterio.id, membroId, role, undefined);
      fetchDetails(selectedMinisterio.id);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || t('members.errorChangeRole') });
    }
  }

  async function handleSaveFuncoesMembro(membroId: string) {
    if (!selectedMinisterio) return;
    setSavingFuncoesMembro(membroId);
    setFeedback(null);
    try {
      await updateMembroRole(selectedMinisterio.id, membroId, undefined, funcoesPorMembro[membroId] ?? []);
      await fetchDetails(selectedMinisterio.id);
      setExpandedMembro(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || t('members.errorSaveFunctions') });
    } finally {
      setSavingFuncoesMembro(null);
    }
  }

  function toggleFuncaoMembro(membroId: string, funcaoId: string) {
    setFuncoesPorMembro((prev) => {
      const current = prev[membroId] ?? [];
      const has = current.includes(funcaoId);
      return { ...prev, [membroId]: has ? current.filter((id) => id !== funcaoId) : [...current, funcaoId] };
    });
  }

  const membersOptions = allMembros.filter(
    (m) => !detailedInfo?.membros?.some((dm: any) => dm.membroId === m.id)
  );
  const selectedMemberOptionToAdd =
    (membersOptions.find((m) => m.id === selectedMembroToAdd) as MembroOption | undefined) ?? null;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        stackActionsOnMobile
        action={
          canManage ? (
            <button
              onClick={() => { setSelectedMinisterio(null); setIsModalOpen(true); }}
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

      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between">
          <span>{t('errorLoading')}</span>
          <button onClick={() => refetch()} className="underline font-semibold hover:text-red-800">Recarregar</button>
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

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <EntityCard key={i} loading />
          ))}
        </div>
      ) : ministerios.length === 0 ? (
        <EmptyState title={t('noMinistries')} description={t('noMinistriesDesc')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ministerios.map((m) => {
            const numMembros = m._count?.membros ?? 0;
            const isAtivo = m.ativo;
            const cardLeaders = (m.membros ?? [])
              .filter((mm) => mm.role === 'LEADER' || mm.role === 'ASSISTANT_LEADER')
              .map((mm) => ({
                nome: mm.membro?.nome,
                role: mm.role,
              }))
              .filter((item): item is { nome: string; role: MinistryRole } => Boolean(item.nome))
              .sort((a, b) => {
                const roleOrder: Record<MinistryRole, number> = {
                  LEADER: 0,
                  ASSISTANT_LEADER: 1,
                  MEMBER: 2,
                };
                return roleOrder[a.role] - roleOrder[b.role] || a.nome.localeCompare(b.nome, 'pt-BR');
              });

            return (
              <EntityCard key={m.id} className={`flex flex-col p-5 justify-between relative overflow-hidden ${!isAtivo && 'opacity-65'}`}>
                <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${isAtivo ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                    {isAtivo ? t('status.active') : t('status.archived')}
                  </span>
                  <span className="inline-flex items-center rounded-lg border border-gray-100 bg-gray-50 px-2 py-1 text-[11px] font-semibold text-gray-600">
                    {numMembros === 1 ? t('card.members', { count: numMembros }) : t('card.members_plural', { count: numMembros })}
                  </span>
                </div>
                <div className="space-y-2 pr-28">
                  <h3 className="text-base font-bold text-gray-800 tracking-tight">{m.nome}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 h-10">{m.descricao || 'Sem descrição cadastrada.'}</p>
                </div>
                <div className="border-t border-gray-100 my-4 pt-3 text-xs text-gray-500 font-medium">
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-gray-600">{t('card.leadership')}</p>
                    {cardLeaders.length > 0 ? (
                      <div className="space-y-1">
                        {cardLeaders.map((leader) => (
                          <div
                            key={`${leader.role}-${leader.nome}`}
                            className="flex items-center justify-between gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1"
                            title={`${leader.nome} - ${t(`members.roles.${leader.role}` as any)}`}
                          >
                            <span className="min-w-0 flex-1 text-[11px] font-semibold leading-snug text-indigo-800">
                              {leader.nome}
                            </span>
                            <span className="shrink-0 rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                              {t(`members.roles.${leader.role}` as any)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">{t('card.noLeader')}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setSelectedMinisterio(m); setIsModalOpen(true); }} className="px-3 py-1.5 border border-gray-200 hover:border-gray-300 rounded-xl text-xs font-semibold text-gray-600 bg-white transition-all flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    {t('modal.titleEdit') === 'Editar ministério' ? 'Gerenciar' : 'Manage'}
                  </button>
                  {canManage && isAtivo && (
                    <button onClick={() => handleDelete(m)} className="p-1.5 border border-red-100 hover:bg-red-50 rounded-xl text-red-500 transition-colors" title={t('modal.archiveConfirm', { name: m.nome })}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              </EntityCard>
            );
          })}
        </div>
      )}

      {/* Modal Criação / Edição de Ministério */}
      <ModalShell
        isOpen={isModalOpen}
        title={selectedMinisterio ? selectedMinisterio.nome : t('modal.titleNew')}
        description={selectedMinisterio ? t('modal.subtitleEdit') : t('modal.subtitleNew')}
        onClose={() => { setIsModalOpen(false); setSelectedMinisterio(null); }}
        size="lg"
        bodyClassName="p-0"
      >
        {/* Feedback de erro global */}
        <ModalError message={feedback?.type === 'error' ? feedback.message : null} />

        {/* Abas — apenas quando editando */}
        {selectedMinisterio ? (
          <TabsShell
            tabs={[
              { id: 'info', label: t('modal.tabs.info') },
              { id: 'membros', label: t('modal.tabs.members') },
              { id: 'funcoes', label: t('modal.tabs.functions') },
            ]}
            activeTab={modalTab}
            onTabChange={(id) => setModalTab(id as 'info' | 'membros' | 'funcoes')}
          >
            {/* ─── Tab Info ─── */}
            <TabPanel id="info" activeId={modalTab}>
              <form id="ministerio-form" onSubmit={handleSave} className="space-y-4">
                <InputField
                  id="min-nome"
                  label={`${t('modal.fields.name')} *`}
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder={t('modal.fields.namePlaceholder')}
                />
                <TextareaField
                  id="min-descricao"
                  label={t('modal.fields.description')}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder={t('modal.fields.descriptionPlaceholder')}
                  rows={3}
                />
              </form>
            </TabPanel>

            {/* ─── Tab Membros ─── */}
            <TabPanel id="membros" activeId={modalTab}>
              <div className="space-y-5">
                {canManageSelectedMinisterio && (
                  <div className="bg-gray-50 border border-gray-150 p-4 rounded-2xl flex gap-3 items-end">
                    <div className="flex-1 space-y-1">
                      <MembroSearchCombobox
                        label={t('members.add')}
                        placeholder="Buscar membro pelo nome..."
                        loading={loadingDetails}
                        options={membersOptions}
                        selected={selectedMemberOptionToAdd}
                        search={membroSearchToAdd}
                        emptyMessage="Nenhum membro disponivel encontrado."
                        selectedPrefix="Selecionado"
                        onSearchChange={(value) => { setMembroSearchToAdd(value); setSelectedMembroToAdd(''); }}
                        onSelect={(membro) => { setSelectedMembroToAdd(membro.id); setMembroSearchToAdd(membro.nome); }}
                        onClear={() => { setSelectedMembroToAdd(''); setMembroSearchToAdd(''); }}
                      />
                    </div>
                    {canManageSelectedMinisterio && (
                      <div className="space-y-1">
                        <label htmlFor="add-role" className="text-xs font-bold text-gray-500 uppercase">{t('members.role')}</label>
                        <select
                          id="add-role"
                          value={selectedRoleToAdd}
                          onChange={(e) => setSelectedRoleToAdd(e.target.value as MinistryRole)}
                          className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                        >
                          <option value="MEMBER">{t('members.roles.MEMBER')}</option>
                          <option value="ASSISTANT_LEADER">{t('members.roles.ASSISTANT_LEADER')}</option>
                          {canManage && <option value="LEADER">{t('members.roles.LEADER')}</option>}
                        </select>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleAddMembro}
                      disabled={!selectedMembroToAdd}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm"
                    >
                      {t('functions.add')}
                    </button>
                  </div>
                )}
                {loadingDetails ? (
                  <SkeletonList count={3} className="h-12 rounded-xl" gap="space-y-2" />
                ) : !detailedInfo?.membros?.length ? (
                  <p className="text-sm text-gray-400 text-center py-6">{t('members.noMembers')}</p>
                ) : (
                  <div className="border border-gray-100 rounded-2xl divide-y divide-gray-100 overflow-hidden">
                    {detailedInfo.membros.map((item: any) => {
                      const isExpanded = expandedMembro === item.membroId;
                      const ministerioFuncoes: any[] = detailedInfo.funcoes ?? [];
                      const selectedFuncoes = funcoesPorMembro[item.membroId] ?? [];
                      const canChangeMemberRole =
                        canManage ||
                        (canManageSelectedMinisterio && item.role !== 'LEADER' && item.membroId !== currentUser?.memberId);
                      return (
                        <div key={item.membroId} className="divide-y divide-gray-50">
                          <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs uppercase">
                                {item.membro?.nome?.substring(0, 2) ?? '??'}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-800">{item.membro?.nome}</p>
                                <p className="text-xs text-gray-400">{t(`members.roles.${item.role}` as any) ?? item.role}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {canChangeMemberRole && (
                                <select
                                  value={item.role}
                                  onChange={(e) => handleChangeRole(item.membroId, e.target.value as MinistryRole)}
                                  className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500"
                                >
                                  <option value="MEMBER">{t('members.roles.MEMBER')}</option>
                                  <option value="ASSISTANT_LEADER">{t('members.roles.ASSISTANT_LEADER')}</option>
                                  {canManage && <option value="LEADER">{t('members.roles.LEADER')}</option>}
                                </select>
                              )}
                              {ministerioFuncoes.length > 0 && (
                                <button
                                  onClick={() => setExpandedMembro(isExpanded ? null : item.membroId)}
                                  className={`p-1 rounded-lg transition-colors ${isExpanded ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                                  title={t('members.availableFunctions')}
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveMembro(item.membroId)}
                                className="p-1 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                title="Remover"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="px-4 py-3 bg-indigo-50/40">
                              <p className="text-xs font-bold text-gray-500 uppercase mb-2">{t('members.availableFunctions')}</p>
                              <div className="flex flex-wrap gap-2 mb-3">
                                {ministerioFuncoes.map((f: any) => {
                                  const checked = selectedFuncoes.includes(f.id);
                                  return (
                                    <label key={f.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all select-none ${checked ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}>
                                      <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleFuncaoMembro(item.membroId, f.id)} disabled={!canManageSelectedMinisterio} />
                                      {checked && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                      {f.nome}
                                    </label>
                                  );
                                })}
                              </div>
                              {canManageSelectedMinisterio && (
                                <div className="flex justify-end">
                                  <button
                                    onClick={() => handleSaveFuncoesMembro(item.membroId)}
                                    disabled={savingFuncoesMembro === item.membroId}
                                    className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors"
                                  >
                                    {savingFuncoesMembro === item.membroId ? t('members.saving') : t('members.saveFunctions')}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabPanel>

            {/* ─── Tab Funções ─── */}
            <TabPanel id="funcoes" activeId={modalTab}>
              <div className="space-y-5">
                <p className="text-xs text-gray-500">{t('functions.description')}</p>
                {canManage && (
                  <div className="bg-gray-50 border border-gray-150 p-4 rounded-2xl flex gap-3 items-end">
                    <div className="flex-1 space-y-1">
                      <label htmlFor="nova-funcao" className="text-xs font-bold text-gray-500 uppercase">{t('functions.newFunction')}</label>
                      <input
                        id="nova-funcao"
                        type="text"
                        value={novaFuncao}
                        onChange={(e) => setNovaFuncao(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFuncao(); } }}
                        placeholder={t('functions.functionPlaceholder')}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                    <button type="button" onClick={handleAddFuncao} disabled={!novaFuncao.trim()} className="px-4 py-2.5 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-semibold rounded-xl text-sm">{t('functions.add')}</button>
                  </div>
                )}
                {funcoes.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">{t('functions.noFunctions')}</p>
                ) : (
                  <div className="border border-gray-100 rounded-2xl divide-y divide-gray-100 overflow-hidden">
                    {funcoes.map((f, idx) => (
                      <div key={f} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-gray-400 w-5 text-right">{idx + 1}</span>
                          <span className="text-sm font-semibold text-gray-800">{f}</span>
                        </div>
                        {canManage && (
                          <button onClick={() => handleRemoveFuncao(f)} className="p-1 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {canManage && (
                  <div className="flex justify-end">
                    <button onClick={handleSaveFuncoes} disabled={savingFuncoes} className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50">
                      {savingFuncoes ? t('functions.saving') : t('functions.save')}
                    </button>
                  </div>
                )}
              </div>
            </TabPanel>
          </TabsShell>
        ) : (
          /* ─── Modo Criação (sem abas) ─── */
          <form id="ministerio-form" onSubmit={handleSave}>
            <div className="space-y-4 p-6">
              <InputField
                id="min-nome"
                label={`${t('modal.fields.name')} *`}
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder={t('modal.fields.namePlaceholder')}
              />
              <TextareaField
                id="min-descricao"
                label={t('modal.fields.description')}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder={t('modal.fields.descriptionPlaceholder')}
                rows={3}
              />
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">{t('functions.newFunction')}</label>
                <p className="text-xs text-gray-400">{t('functions.description')}</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={novaFuncao}
                    onChange={(e) => setNovaFuncao(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFuncao(); } }}
                    placeholder={t('functions.functionPlaceholder')}
                    className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                  <button type="button" onClick={handleAddFuncao} className="px-3 py-2 bg-gray-800 text-white text-sm font-semibold rounded-xl hover:bg-gray-900">{t('functions.add')}</button>
                </div>
                {funcoes.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {funcoes.map((f) => (
                      <span key={f} className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-100">
                        {f}
                        <button type="button" onClick={() => handleRemoveFuncao(f)} className="hover:text-red-500">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </form>
        )}

        {/* Footer — shown on info tab or creation mode */}
        {(modalTab === 'info' || !selectedMinisterio) && canManage && (
          <ModalFooter
            form="ministerio-form"
            primaryLabel={selectedMinisterio ? t('modal.saveChanges') : t('modal.createMinistry')}
            onCancel={() => { setIsModalOpen(false); setSelectedMinisterio(null); }}
            secondaryAction={
              selectedMinisterio ? (
                <button
                  type="button"
                  onClick={() => { handleDelete(selectedMinisterio); }}
                  className="px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                >
                  {t('modal.archiveAction')}
                </button>
              ) : undefined
            }
          />
        )}
        {/* Footer for non-admin on info tab while editing */}
        {selectedMinisterio && modalTab === 'info' && !canManage && (
          <ModalFooter
            primaryLabel={t('modal.saveChanges')}
            onCancel={() => { setIsModalOpen(false); setSelectedMinisterio(null); }}
            form="ministerio-form"
          />
        )}
      </ModalShell>

      <ConfirmDialog
        isOpen={!!pendingArchiveMinisterio}
        title={t('modal.archiveTitle')}
        description={pendingArchiveMinisterio ? t('modal.archiveConfirm', { name: pendingArchiveMinisterio.nome }) : ''}
        confirmLabel={t('modal.archiveAction')}
        variant="warning"
        loading={confirmLoading}
        onConfirm={confirmArchiveMinisterio}
        onCancel={() => setPendingArchiveMinisterio(null)}
      />
    </div>
  );
}
