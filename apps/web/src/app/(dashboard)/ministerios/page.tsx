'use client';

import { useState, useEffect } from 'react';
import { useMinisterios } from '@/hooks/use-ministerios';

import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { api } from '@/lib/api';
import { Ministerio, Membro, AuthUser, MinistryRole } from '@/types';
import { MINISTRY_ROLE_LABEL } from '@/lib/utils';

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
    updateMembroRole,
  } = useMinisterios();

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [selectedMinisterio, setSelectedMinisterio] = useState<Ministerio | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    api.get<AuthUser>('/api/auth/me')
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'STAFF';

  // Modal State
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [modalTab, setModalTab] = useState<'info' | 'membros' | 'funcoes'>('info');

  // Funções state
  const [funcoes, setFuncoes] = useState<string[]>([]);
  const [novaFuncao, setNovaFuncao] = useState('');
  const [savingFuncoes, setSavingFuncoes] = useState(false);

  // Detailed view
  const [detailedInfo, setDetailedInfo] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Dropdown options
  const [allMembros, setAllMembros] = useState<Membro[]>([]);
  const [selectedMembroToAdd, setSelectedMembroToAdd] = useState('');
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

  async function loadOptions() {
    try {
      const membrosData = await api.get<Membro[]>('/api/membros?status=ATIVO');
      setAllMembros(Array.isArray(membrosData) ? membrosData : []);
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
  }, [detailedInfo]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    try {
      if (selectedMinisterio) {
        await updateMinisterio(selectedMinisterio.id, { nome, descricao });
      } else {
        await createMinisterio({ nome, descricao, funcoes: funcoes.filter(Boolean) });
      }
      setIsModalOpen(false);
      setSelectedMinisterio(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar ministério.');
    }
  }

  async function handleSaveFuncoes() {
    if (!selectedMinisterio) return;
    setSavingFuncoes(true);
    try {
      await updateMinisterio(selectedMinisterio.id, { funcoes: funcoes.filter(Boolean) });
      await fetchDetails(selectedMinisterio.id);
      alert('Funções salvas com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar funções.');
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

  async function handleDelete(m: Ministerio) {
    if (confirm(`Tem certeza que deseja arquivar/inativar o ministério ${m.nome}?`)) {
      try {
        await deleteMinisterio(m.id);
      } catch (err: any) {
        alert(err.message || 'Erro ao arquivar ministério.');
      }
    }
  }

  async function handleAddMembro() {
    if (!selectedMembroToAdd || !selectedMinisterio) return;
    try {
      await addMembro(selectedMinisterio.id, selectedMembroToAdd, selectedRoleToAdd);
      setSelectedMembroToAdd('');
      setSelectedRoleToAdd('MEMBER');
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

  async function handleChangeRole(membroId: string, role: MinistryRole) {
    if (!selectedMinisterio) return;
    try {
      await updateMembroRole(selectedMinisterio.id, membroId, role);
      fetchDetails(selectedMinisterio.id);
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar função.');
    }
  }

  const membersOptions = allMembros.filter(
    (m) => !detailedInfo?.membros?.some((dm: any) => dm.membroId === m.id)
  );

  // Helpers para exibição
  const leaderNames = (detailedInfo?.membros ?? ministerios.find(m => m.id === selectedMinisterio?.id)?.membros ?? [])
    .filter((m: any) => m.role === 'LEADER' || m.role === 'ASSISTANT_LEADER')
    .map((m: any) => m.membro?.nome)
    .filter(Boolean);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Ministérios"
        description="Gerencie as equipes de serviço, departamentos da igreja, líderes e participantes."
        action={
          canManage ? (
            <button
              onClick={() => { setSelectedMinisterio(null); setIsModalOpen(true); }}
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
          <button onClick={() => refetch()} className="underline font-semibold hover:text-red-800">Recarregar</button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 bg-gray-100 rounded-2xl border border-gray-200" />
          ))}
        </div>
      ) : ministerios.length === 0 ? (
        <EmptyState title="Nenhum ministério cadastrado" description="Os ministérios organizam os membros e as escalas de serviço." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ministerios.map((m) => {
            const numMembros = m._count?.membros ?? 0;
            const isAtivo = m.ativo;
            const cardLeaders = m.membros?.filter((mm) => mm.role === 'LEADER' || mm.role === 'ASSISTANT_LEADER').map((mm) => mm.membro?.nome).filter(Boolean) || [];

            return (
              <div key={m.id} className={`bg-white rounded-2xl border border-gray-150 shadow-xs hover:shadow-md transition-all flex flex-col p-5 justify-between relative overflow-hidden ${!isAtivo && 'opacity-65'}`}>
                <div className="absolute top-4 right-4">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${isAtivo ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                    {isAtivo ? 'Ativo' : 'Arquivado'}
                  </span>
                </div>
                <div className="space-y-2 pr-12">
                  <h3 className="text-base font-bold text-gray-800 tracking-tight">{m.nome}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 h-10">{m.descricao || 'Sem descrição cadastrada.'}</p>
                </div>
                <div className="border-t border-gray-100 my-4 pt-3 flex items-center justify-between text-xs text-gray-500 font-medium">
                  <span>{numMembros} {numMembros === 1 ? 'membro' : 'membros'}</span>
                  <div className="truncate max-w-[150px] text-right">
                    <span className="font-semibold text-gray-700">Liderança: </span>
                    {cardLeaders.length > 0 ? cardLeaders.join(', ') : 'Sem líder'}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setSelectedMinisterio(m); setIsModalOpen(true); }} className="px-3 py-1.5 border border-gray-200 hover:border-gray-300 rounded-xl text-xs font-semibold text-gray-600 bg-white transition-all flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    Gerenciar
                  </button>
                  {canManage && isAtivo && (
                    <button onClick={() => handleDelete(m)} className="p-1.5 border border-red-100 hover:bg-red-50 rounded-xl text-red-500 transition-colors" title="Arquivar ministério">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Criação / Edição de Ministério */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-800">
                  {selectedMinisterio ? selectedMinisterio.nome : 'Novo Ministério'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedMinisterio ? 'Edite as informações do ministério' : 'Preencha os dados para criar um novo ministério'}
                </p>
              </div>
              <button
                onClick={() => { setIsModalOpen(false); setSelectedMinisterio(null); }}
                className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            {selectedMinisterio && (
              <div className="flex border-b border-gray-100 px-6">
                {(['info', 'membros', 'funcoes'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setModalTab(tab)}
                    className={`px-4 py-3 text-xs font-semibold border-b-2 -mb-px transition-colors ${
                      modalTab === tab
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {tab === 'info' ? 'Informações' : tab === 'membros' ? 'Membros' : 'Funções'}
                  </button>
                ))}
              </div>
            )}

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">

              {/* Tab: Info */}
              {modalTab === 'info' && (
                <form id="ministerio-form" onSubmit={handleSave} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="min-nome" className="text-xs font-bold text-gray-500 uppercase">Nome do Ministério *</label>
                    <input
                      id="min-nome"
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: Ministério de Louvor"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="min-descricao" className="text-xs font-bold text-gray-500 uppercase">Descrição</label>
                    <textarea
                      id="min-descricao"
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Descreva o propósito deste ministério..."
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none"
                    />
                  </div>
                  {!selectedMinisterio && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase">Funções / Cargos (opcional)</label>
                      <p className="text-xs text-gray-400">Defina os cargos do ministério. Eles serão as colunas da escala mensal.</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={novaFuncao}
                          onChange={(e) => setNovaFuncao(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFuncao(); } }}
                          placeholder="Ex: Ministro, Teclado..."
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                        />
                        <button type="button" onClick={handleAddFuncao} className="px-3 py-2 bg-gray-800 text-white text-sm font-semibold rounded-xl hover:bg-gray-900">Adicionar</button>
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
                  )}
                </form>
              )}

              {/* Tab: Membros */}
              {modalTab === 'membros' && selectedMinisterio && (
                <div className="space-y-5">
                  {canManage && (
                    <div className="bg-gray-50 border border-gray-150 p-4 rounded-2xl flex gap-3 items-end">
                      <div className="flex-1 space-y-1">
                        <label htmlFor="add-membro" className="text-xs font-bold text-gray-500 uppercase">Adicionar Membro</label>
                        <select
                          id="add-membro"
                          value={selectedMembroToAdd}
                          onChange={(e) => setSelectedMembroToAdd(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                        >
                          <option value="">Selecione um membro...</option>
                          {membersOptions.map((m) => (
                            <option key={m.id} value={m.id}>{m.nome}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="add-role" className="text-xs font-bold text-gray-500 uppercase">Papel</label>
                        <select
                          id="add-role"
                          value={selectedRoleToAdd}
                          onChange={(e) => setSelectedRoleToAdd(e.target.value as MinistryRole)}
                          className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                        >
                          <option value="MEMBER">Membro</option>
                          <option value="ASSISTANT_LEADER">Assistente</option>
                          <option value="LEADER">Líder</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddMembro}
                        disabled={!selectedMembroToAdd}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm"
                      >
                        Adicionar
                      </button>
                    </div>
                  )}
                  {loadingDetails ? (
                    <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
                  ) : !detailedInfo?.membros?.length ? (
                    <p className="text-sm text-gray-400 text-center py-6">Nenhum membro neste ministério.</p>
                  ) : (
                    <div className="border border-gray-100 rounded-2xl divide-y divide-gray-100 overflow-hidden">
                      {detailedInfo.membros.map((item: any) => (
                        <div key={item.membroId} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs uppercase">
                              {item.membro?.nome?.substring(0, 2) ?? '??'}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{item.membro?.nome}</p>
                              <p className="text-xs text-gray-400">{MINISTRY_ROLE_LABEL[item.role as MinistryRole] ?? item.role}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {canManage && (
                              <select
                                value={item.role}
                                onChange={(e) => handleChangeRole(item.membroId, e.target.value as MinistryRole)}
                                className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500"
                              >
                                <option value="MEMBER">Membro</option>
                                <option value="ASSISTANT_LEADER">Assistente</option>
                                <option value="LEADER">Líder</option>
                              </select>
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
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Funções */}
              {modalTab === 'funcoes' && selectedMinisterio && (
                <div className="space-y-5">
                  <p className="text-xs text-gray-500">Defina os cargos/funções fixos deste ministério. Eles serão as colunas da escala mensal.</p>
                  {canManage && (
                    <div className="bg-gray-50 border border-gray-150 p-4 rounded-2xl flex gap-3 items-end">
                      <div className="flex-1 space-y-1">
                        <label htmlFor="nova-funcao" className="text-xs font-bold text-gray-500 uppercase">Nova Função</label>
                        <input
                          id="nova-funcao"
                          type="text"
                          value={novaFuncao}
                          onChange={(e) => setNovaFuncao(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFuncao(); } }}
                          placeholder="Ex: Ministro, Teclado..."
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <button type="button" onClick={handleAddFuncao} disabled={!novaFuncao.trim()} className="px-4 py-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-semibold rounded-xl text-sm">Adicionar</button>
                    </div>
                  )}
                  {funcoes.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Nenhuma função cadastrada.</p>
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
                    <div className="flex justify-end pt-2 border-t border-gray-100">
                      <button onClick={handleSaveFuncoes} disabled={savingFuncoes} className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50">
                        {savingFuncoes ? 'Salvando...' : 'Salvar Funções'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {modalTab === 'info' && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                <div>
                  {selectedMinisterio && canManage && (
                    <button
                      type="button"
                      onClick={() => { handleDelete(selectedMinisterio); setIsModalOpen(false); setSelectedMinisterio(null); }}
                      className="px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      Arquivar
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsModalOpen(false); setSelectedMinisterio(null); }}
                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  {canManage && (
                    <button
                      type="submit"
                      form="ministerio-form"
                      className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all"
                    >
                      {selectedMinisterio ? 'Salvar Alterações' : 'Criar Ministério'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
