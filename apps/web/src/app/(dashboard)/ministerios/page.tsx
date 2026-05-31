'use client';

import { useState, useEffect } from 'react';
import { useMinisterios } from '@/hooks/use-ministerios';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { api } from '@/lib/api';
import { Ministerio, Membro, User, AuthUser } from '@/types';

export default function MinisteriosPage() {
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
    addLider,
    removeLider,
  } = useMinisterios();

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [selectedMinisterio, setSelectedMinisterio] = useState<Ministerio | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Carrega o usuário atual via API (cookie HTTP-only não é acessível via JS)
  useEffect(() => {
    api.get<AuthUser>('/api/auth/me')
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  const canManage = currentUser?.role === 'ADMIN_GERAL' || currentUser?.role === 'PASTOR';

  // Modal State for Creation/Edit
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [modalTab, setModalTab] = useState<'info' | 'membros' | 'lideres'>('info');

  // Detailed view of selected ministry
  const [detailedInfo, setDetailedInfo] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Dropdown options
  const [allMembros, setAllMembros] = useState<Membro[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedMembroToAdd, setSelectedMembroToAdd] = useState('');
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');

  // Fetch full ministry details when modal opens on edit
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

  // Load options for adding members and leaders
  async function loadOptions() {
    try {
      const membrosData = await api.get<Membro[]>('/api/membros?status=ATIVO');
      setAllMembros(Array.isArray(membrosData) ? membrosData : []);

      if (canManage) {
        const usersData = await api.get<User[]>('/api/auth/users');
        setAllUsers(Array.isArray(usersData) ? usersData : []);
      }
    } catch (e) {
      console.error('Erro ao carregar opções para ministérios:', e);
    }
  }

  useEffect(() => {
    if (isModalOpen) {
      loadOptions();
      if (selectedMinisterio) {
        setNome(selectedMinisterio.nome);
        setDescricao(selectedMinisterio.descricao || '');
        setModalTab('info');
        fetchDetails(selectedMinisterio.id);
      } else {
        setNome('');
        setDescricao('');
        setModalTab('info');
        setDetailedInfo(null);
      }
    }
  }, [isModalOpen, selectedMinisterio, currentUser]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;

    try {
      if (selectedMinisterio) {
        await updateMinisterio(selectedMinisterio.id, { nome, descricao });
      } else {
        await createMinisterio({ nome, descricao });
      }
      setIsModalOpen(false);
      setSelectedMinisterio(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar ministério.');
    }
  }

  async function handleDelete(m: Ministerio) {
    if (confirm(`Tem certeza que deseja arquivar/inativar o ministério ${m.nome}?`)) {
      try {
        await deleteMinisterio(m.id);
      } catch (err: any) {
        alert(err.message || 'Erro ao arquivar ministério.');
      }
    }
  }

  // Member management handlers
  async function handleAddMembro() {
    if (!selectedMembroToAdd || !selectedMinisterio) return;
    try {
      await addMembro(selectedMinisterio.id, selectedMembroToAdd);
      setSelectedMembroToAdd('');
      fetchDetails(selectedMinisterio.id);
    } catch (err: any) {
      alert(err.message || 'Erro ao adicionar membro.');
    }
  }

  async function handleRemoveMembro(membroId: string) {
    if (!selectedMinisterio) return;
    try {
      await removeMembro(selectedMinisterio.id, membroId);
      fetchDetails(selectedMinisterio.id);
    } catch (err: any) {
      alert(err.message || 'Erro ao remover membro.');
    }
  }

  // Leader management handlers
  async function handleAddLider() {
    if (!selectedUserToAdd || !selectedMinisterio) return;
    try {
      await addLider(selectedMinisterio.id, selectedUserToAdd);
      setSelectedUserToAdd('');
      fetchDetails(selectedMinisterio.id);
    } catch (err: any) {
      alert(err.message || 'Erro ao adicionar líder.');
    }
  }

  async function handleRemoveLider(userId: string) {
    if (!selectedMinisterio) return;
    try {
      await removeLider(selectedMinisterio.id, userId);
      fetchDetails(selectedMinisterio.id);
    } catch (err: any) {
      alert(err.message || 'Erro ao remover líder.');
    }
  }

  // Filter out members/users already added
  const membersOptions = allMembros.filter(
    (m) => !detailedInfo?.membros?.some((dm: any) => dm.membroId === m.id)
  );

  const usersOptions = allUsers.filter(
    (u) => !detailedInfo?.lideres?.some((dl: any) => dl.userId === u.id)
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Ministérios"
        description="Gerencie as equipes de serviço, departamentos da igreja, líderes e participantes."
        action={
          canManage ? (
            <button
              onClick={() => {
                setSelectedMinisterio(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Novo Ministério
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

      {/* Grid of Ministries */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 bg-gray-100 rounded-2xl border border-gray-200" />
          ))}
        </div>
      ) : ministerios.length === 0 ? (
        <EmptyState
          title="Nenhum ministério cadastrado"
          description="Os ministérios organizam os membros e as escalas de serviço."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ministerios.map((m) => {
            const numMembros = m._count?.membros ?? 0;
            const isAtivo = m.ativo;

            return (
              <div
                key={m.id}
                className={`bg-white rounded-2xl border border-gray-150 shadow-xs hover:shadow-md transition-all flex flex-col p-5 justify-between relative overflow-hidden ${!isAtivo && 'opacity-65'}`}
              >
                {/* Ativo Status badge */}
                <div className="absolute top-4 right-4">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${isAtivo ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                    {isAtivo ? 'Ativo' : 'Arquivado'}
                  </span>
                </div>

                <div className="space-y-2 pr-12">
                  <h3 className="text-base font-bold text-gray-800 tracking-tight">{m.nome}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 h-10">
                    {m.descricao || 'Sem descrição cadastrada.'}
                  </p>
                </div>

                <div className="border-t border-gray-100 my-4 pt-3 flex items-center justify-between text-xs text-gray-500 font-medium">
                  <span>{numMembros} {numMembros === 1 ? 'membro' : 'membros'}</span>
                  <div className="truncate max-w-[150px] text-right">
                    <span className="font-semibold text-gray-700">Liderança: </span>
                    {m.lideres && m.lideres.length > 0
                      ? m.lideres.map((l) => l.user.nome).join(', ')
                      : 'Sem líder'}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setSelectedMinisterio(m);
                      setIsModalOpen(true);
                    }}
                    className="px-3 py-1.5 border border-gray-200 hover:border-gray-300 rounded-xl text-xs font-semibold text-gray-600 bg-white transition-all flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Gerenciar
                  </button>

                  {canManage && isAtivo && (
                    <button
                      onClick={() => handleDelete(m)}
                      className="p-1.5 border border-red-100 hover:bg-red-50 rounded-xl text-red-500 transition-colors"
                      title="Arquivar ministério"
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

      {/* Ministry Create / Manage Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/20">
              <h2 className="text-lg font-bold text-gray-800">
                {selectedMinisterio ? `Gerenciar: ${selectedMinisterio.nome}` : 'Novo Ministério'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedMinisterio(null);
                }}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Navigation Tabs (Only in Edit mode) */}
            {selectedMinisterio && (
              <div className="flex border-b border-gray-100 px-6 bg-gray-50/50">
                <button
                  onClick={() => setModalTab('info')}
                  className={`py-3 text-sm font-semibold border-b-2 px-1 transition-all mr-6 ${modalTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Informações Gerais
                </button>
                <button
                  onClick={() => setModalTab('membros')}
                  className={`py-3 text-sm font-semibold border-b-2 px-1 transition-all mr-6 ${modalTab === 'membros' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Membros ({detailedInfo?.membros?.length ?? 0})
                </button>
                <button
                  onClick={() => setModalTab('lideres')}
                  className={`py-3 text-sm font-semibold border-b-2 px-1 transition-all ${modalTab === 'lideres' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Líderes ({detailedInfo?.lideres?.length ?? 0})
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {/* Tab 1: Info (Standard Form) */}
              {modalTab === 'info' && (
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="min-nome" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Nome do Ministério *
                    </label>
                    <input
                      id="min-nome"
                      type="text"
                      required
                      disabled={!canManage}
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: Louvor, Recepção, Infantil"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all disabled:opacity-65"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="min-desc" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Descrição / Objetivos
                    </label>
                    <textarea
                      id="min-desc"
                      rows={4}
                      disabled={!canManage}
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Breve descrição sobre a atuação deste ministério na igreja..."
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all resize-none disabled:opacity-65"
                    />
                  </div>

                  {canManage && (
                    <div className="flex justify-end pt-4 border-t border-gray-100">
                      <button
                        type="submit"
                        className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all"
                      >
                        {selectedMinisterio ? 'Salvar Alterações' : 'Criar Ministério'}
                      </button>
                    </div>
                  )}
                </form>
              )}

              {/* Tab 2: Membros (Manage participants) */}
              {modalTab === 'membros' && selectedMinisterio && (
                <div className="space-y-6">
                  {/* Add Member form */}
                  <div className="bg-gray-50 border border-gray-150 p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1 space-y-1">
                      <label htmlFor="add-membro-select" className="text-xs font-bold text-gray-500 uppercase">
                        Vincular Membro
                      </label>
                      <select
                        id="add-membro-select"
                        value={selectedMembroToAdd}
                        onChange={(e) => setSelectedMembroToAdd(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-gray-700"
                      >
                        <option value="">Selecione um membro...</option>
                        {membersOptions.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddMembro}
                      disabled={!selectedMembroToAdd}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all"
                    >
                      Adicionar
                    </button>
                  </div>

                  {/* Members List */}
                  {loadingDetails ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-10 bg-gray-100 rounded-xl" />
                      <div className="h-10 bg-gray-100 rounded-xl" />
                    </div>
                  ) : !detailedInfo?.membros || detailedInfo.membros.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Nenhum membro vinculado a este ministério.</p>
                  ) : (
                    <div className="border border-gray-100 rounded-2xl divide-y divide-gray-100 overflow-hidden">
                      {detailedInfo.membros.map((item: any) => (
                        <div key={item.membro.id} className="flex items-center justify-between p-3.5 hover:bg-gray-50/50 transition-colors">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{item.membro.nome}</p>
                            <p className="text-xs text-gray-400">{item.membro.email || 'Sem email'} • {item.membro.whatsapp || 'Sem whatsapp'}</p>
                          </div>
                          <button
                            onClick={() => handleRemoveMembro(item.membro.id)}
                            className="p-1 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
                            title="Remover do ministério"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Lideres (Manage leaders) */}
              {modalTab === 'lideres' && selectedMinisterio && (
                <div className="space-y-6">
                  {/* Add Leader form */}
                  {canManage && (
                    <div className="bg-gray-50 border border-gray-150 p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-end">
                      <div className="flex-1 space-y-1">
                        <label htmlFor="add-lider-select" className="text-xs font-bold text-gray-500 uppercase">
                          Designar Novo Líder
                        </label>
                        <select
                          id="add-lider-select"
                          value={selectedUserToAdd}
                          onChange={(e) => setSelectedUserToAdd(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-gray-700"
                        >
                          <option value="">Selecione um usuário...</option>
                          {usersOptions.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.nome} ({u.email})
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddLider}
                        disabled={!selectedUserToAdd}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all"
                      >
                        Adicionar
                      </button>
                    </div>
                  )}

                  {/* Leaders List */}
                  {loadingDetails ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-10 bg-gray-100 rounded-xl" />
                    </div>
                  ) : !detailedInfo?.lideres || detailedInfo.lideres.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Este ministério não possui nenhum líder definido.</p>
                  ) : (
                    <div className="border border-gray-100 rounded-2xl divide-y divide-gray-100 overflow-hidden">
                      {detailedInfo.lideres.map((item: any) => (
                        <div key={item.user.id} className="flex items-center justify-between p-3.5 hover:bg-gray-50/50 transition-colors">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{item.user.nome}</p>
                            <p className="text-xs text-gray-400">{item.user.email}</p>
                          </div>
                          {canManage && (
                            <button
                              onClick={() => handleRemoveLider(item.user.id)}
                              className="p-1 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
                              title="Remover liderança"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Close footer for tabs which don't have separate submit */}
            {selectedMinisterio && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/30">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedMinisterio(null);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-150 rounded-xl transition-all"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
