'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMembros, FilterMembros } from '@/hooks/use-membros';
import { PageHeader } from '@/components/app/page-header';
import { DataTable, Column } from '@/components/app/data-table';
import { MembroModal } from '@/components/app/membro-modal';
import { Membro, Tag, StatusMembro } from '@/types';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function MembrosPage() {
  const {
    membros,
    loading,
    error,
    filter,
    applyFilter,
    createMembro,
    updateMembro,
    deleteMembro,
    bulkTag,
  } = useMembros();

  // Local States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMembro, setEditingMembro] = useState<Membro | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [tagsList, setTagsList] = useState<Tag[]>([]);
  const [selectedBulkTag, setSelectedBulkTag] = useState('');
  const [bulkAction, setBulkAction] = useState<'ADD' | 'REMOVE'>('ADD');
  
  // Tag creations inside the page for convenience
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#4f46e5');

  const itemsPerPage = 10;

  // Load tags
  async function fetchTags() {
    try {
      const data = await api.get<Tag[]>('/api/tags');
      setTagsList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Erro ao buscar tags:', e);
    }
  }

  useEffect(() => {
    fetchTags();
  }, []);

  // Sync selected filters
  const [searchName, setSearchName] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagOp, setTagOp] = useState<'AND' | 'OR'>('OR');

  // Trigger search filter
  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCurrentPage(1);
    applyFilter({
      nome: searchName || undefined,
      whatsapp: searchPhone || undefined,
      status: selectedStatus || undefined,
      tags: selectedTags.join(',') || undefined,
      operacao: tagOp,
    });
  }

  // Clear filters
  function handleClearFilters() {
    setSearchName('');
    setSearchPhone('');
    setSelectedStatus('');
    setSelectedTags([]);
    setTagOp('OR');
    setCurrentPage(1);
    applyFilter({
      nome: undefined,
      whatsapp: undefined,
      status: undefined,
      tags: undefined,
      operacao: 'OR',
    });
  }

  // Handle Tag toggle in filter
  function handleToggleTagFilter(tagNome: string) {
    setSelectedTags(prev => {
      const next = prev.includes(tagNome)
        ? prev.filter(t => t !== tagNome)
        : [...prev, tagNome];
      
      // Auto-apply filters when tag is clicked
      applyFilter({
        nome: searchName || undefined,
        whatsapp: searchPhone || undefined,
        status: selectedStatus || undefined,
        tags: next.join(',') || undefined,
        operacao: tagOp,
      });

      return next;
    });
  }

  // Pagination slice of data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return membros.slice(start, start + itemsPerPage);
  }, [membros, currentPage]);

  // Handle Save (Create or Update)
  async function handleSaveMembro(data: Partial<Membro>) {
    if (editingMembro) {
      await updateMembro(editingMembro.id, data);
    } else {
      await createMembro(data);
    }
    fetchTags(); // Refetch tags list in case there were changes
  }

  // Handle Delete
  async function handleDelete(membro: Membro) {
    if (confirm(`Tem certeza que deseja excluir ${membro.nome}?`)) {
      try {
        await deleteMembro(membro.id);
        setSelectedIds(prev => prev.filter(id => id !== membro.id));
      } catch (err: any) {
        alert(err.message || 'Erro ao deletar membro.');
      }
    }
  }

  // Create Tag
  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault();
    if (!newTagName.trim()) return;
    try {
      const newTag = await api.post<Tag>('/api/tags', {
        nome: newTagName.trim(),
        cor: newTagColor,
      });
      setTagsList(prev => [...prev, newTag]);
      setNewTagName('');
      setShowNewTagInput(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao criar tag.');
    }
  }

  // Execute Bulk Action
  async function handleBulkApply() {
    if (selectedIds.length === 0 || !selectedBulkTag) return;
    try {
      await bulkTag(selectedIds, [selectedBulkTag], bulkAction);
      setSelectedIds([]);
      setSelectedBulkTag('');
      alert('Ação em lote aplicada com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao aplicar ação em lote.');
    }
  }

  // Define columns
  const columns: Column<Membro>[] = [
    {
      key: 'nome',
      header: 'Nome',
      className: 'font-medium text-gray-900',
      render: (m) => (
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs uppercase">
            {m.nome.substring(0, 2)}
          </div>
          <div>
            <span className="font-semibold text-gray-800 hover:text-indigo-600 cursor-pointer block" onClick={() => { setEditingMembro(m); setIsModalOpen(true); }}>
              {m.nome}
            </span>
            {m.observacoes && (
              <span className="text-xs text-gray-400 block max-w-xs truncate">{m.observacoes}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'contato',
      header: 'Contato',
      render: (m) => (
        <div className="flex flex-col gap-0.5">
          {m.whatsapp && (
            <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.45L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.864.002-2.637-1.03-5.115-2.908-6.993-1.879-1.878-4.36-2.908-6.999-2.91-5.45 0-9.88 4.421-9.884 9.867-.001 1.73.457 3.419 1.32 4.933l-.994 3.634 3.782-.992zm10.963-7.534c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.669.149-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.15-.174.2-.298.3-.496.1-.198.05-.371-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.568-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              </svg>
              {m.whatsapp}
            </span>
          )}
          {m.email && <span className="text-xs text-gray-400">{m.email}</span>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (m) => {
        const colors = {
          ATIVO: 'bg-emerald-50 text-emerald-700 border-emerald-100',
          INATIVO: 'bg-gray-50 text-gray-600 border-gray-150',
          VISITANTE: 'bg-blue-50 text-blue-700 border-blue-100',
          TRANSFERIDO: 'bg-amber-50 text-amber-700 border-amber-100',
        };
        return (
          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${colors[m.status] || 'bg-gray-50'}`}>
            {m.status}
          </span>
        );
      },
    },
    {
      key: 'tags',
      header: 'Tags',
      render: (m) => (
        <div className="flex flex-wrap gap-1">
          {m.tags && m.tags.length > 0 ? (
            m.tags.map((mt) => (
              <span
                key={mt.tag.id}
                style={{ backgroundColor: `${mt.tag.cor}15`, color: mt.tag.cor, borderColor: `${mt.tag.cor}30` }}
                className="inline-flex px-2 py-0.5 text-xs font-semibold border rounded-lg"
              >
                {mt.tag.nome}
              </span>
            ))
          ) : (
            <span className="text-xs text-gray-300">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'dataNascimento',
      header: 'Nascimento',
      render: (m) => (
        <span className="text-xs text-gray-500">{formatDate(m.dataNascimento)}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Cadastro',
      render: (m) => (
        <span className="text-xs text-gray-500">{formatDate(m.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (m) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => {
              setEditingMembro(m);
              setIsModalOpen(true);
            }}
            className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
            title="Editar membro"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={() => handleDelete(m)}
            className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors"
            title="Excluir membro"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Membros"
        description="Gerencie a membresia da igreja, aplique tags em lote e filtre informações rapidamente."
        action={
          <button
            onClick={() => {
              setEditingMembro(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Novo Membro
          </button>
        }
      />

      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => window.location.reload()} className="underline font-semibold hover:text-red-800">
            Recarregar
          </button>
        </div>
      )}

      {/* Filters Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <label htmlFor="search-nome" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Nome do Membro
            </label>
            <input
              id="search-nome"
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Buscar por nome..."
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* WhatsApp */}
          <div className="space-y-1.5">
            <label htmlFor="search-whatsapp" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              WhatsApp
            </label>
            <input
              id="search-whatsapp"
              type="text"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              placeholder="Buscar por whatsapp..."
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label htmlFor="search-status" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Status
            </label>
            <select
              id="search-status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-gray-700"
            >
              <option value="">Todos os status</option>
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
              <option value="VISITANTE">Visitante</option>
              <option value="TRANSFERIDO">Transferido</option>
            </select>
          </div>

          {/* Ações Filtro */}
          <div className="flex items-end gap-3">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white font-semibold rounded-xl text-sm transition-all shadow-sm"
            >
              Filtrar
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl text-sm transition-all"
            >
              Limpar
            </button>
          </div>
        </form>

        {/* Tags filters and operations */}
        <div className="pt-2 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
              Filtro por Tags
            </span>
            <div className="flex flex-wrap gap-2">
              {tagsList.map((t) => {
                const active = selectedTags.includes(t.nome);
                return (
                  <button
                    key={t.id}
                    onClick={() => handleToggleTagFilter(t.nome)}
                    style={{
                      backgroundColor: active ? t.cor : 'transparent',
                      color: active ? '#ffffff' : t.cor,
                      borderColor: t.cor,
                    }}
                    className="px-2.5 py-1 text-xs font-semibold border rounded-lg transition-all shadow-2xs hover:shadow-xs"
                  >
                    {t.nome}
                  </button>
                );
              })}

              <button
                onClick={() => setShowNewTagInput(true)}
                className="px-2 py-1 text-xs font-medium border border-dashed border-gray-300 hover:border-indigo-500 rounded-lg text-gray-500 hover:text-indigo-600 transition-all flex items-center gap-1"
              >
                + Nova Tag
              </button>
            </div>
          </div>

          {/* Tag operator */}
          {selectedTags.length > 1 && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 p-1.5 rounded-xl self-start md:self-auto">
              <span className="text-xs font-medium text-gray-500 px-1">Filtro composto:</span>
              <button
                onClick={() => {
                  setTagOp('AND');
                  applyFilter({
                    nome: searchName || undefined,
                    whatsapp: searchPhone || undefined,
                    status: selectedStatus || undefined,
                    tags: selectedTags.join(',') || undefined,
                    operacao: 'AND',
                  });
                }}
                className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${tagOp === 'AND' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                AND (E)
              </button>
              <button
                onClick={() => {
                  setTagOp('OR');
                  applyFilter({
                    nome: searchName || undefined,
                    whatsapp: searchPhone || undefined,
                    status: selectedStatus || undefined,
                    tags: selectedTags.join(',') || undefined,
                    operacao: 'OR',
                  });
                }}
                className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${tagOp === 'OR' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                OR (OU)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Tag Input Inline Modal */}
      {showNewTagInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-200">
            <h3 className="font-bold text-gray-800 text-base mb-4">Criar Nova Tag</h3>
            <form onSubmit={handleCreateTag} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Nome da Tag</label>
                <input
                  type="text"
                  required
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Ex: Jovem, Som, Ministério"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Cor da Tag</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="w-10 h-9 p-0 border border-gray-200 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTagInput(false)}
                  className="px-4 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                >
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Members Data Table */}
      <DataTable
        columns={columns}
        data={paginatedData}
        loading={loading}
        selectedIds={selectedIds}
        onSelectChange={setSelectedIds}
        currentPage={currentPage}
        totalItems={membros.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        emptyTitle="Nenhum membro encontrado"
        emptyDescription="Tente alterar os filtros ou adicione um novo membro."
      />

      {/* Sticky Bulk Action Banner */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white rounded-2xl shadow-xl px-5 py-3.5 flex items-center gap-4 animate-in slide-in-from-bottom-6 duration-300 max-w-2xl w-full border border-gray-800">
          <div className="flex-shrink-0 text-sm font-medium">
            <span className="bg-indigo-500 text-white font-bold rounded-lg px-2.5 py-1 text-xs mr-2">
              {selectedIds.length}
            </span>
            membros selecionados
          </div>

          <div className="h-4 w-px bg-gray-700" />

          <div className="flex items-center gap-2 flex-1">
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value as 'ADD' | 'REMOVE')}
              className="bg-gray-800 text-white border border-gray-700 px-3 py-1.5 rounded-xl text-xs focus:outline-none"
            >
              <option value="ADD">Adicionar Tag</option>
              <option value="REMOVE">Remover Tag</option>
            </select>

            <select
              value={selectedBulkTag}
              onChange={(e) => setSelectedBulkTag(e.target.value)}
              className="bg-gray-800 text-white border border-gray-700 px-3 py-1.5 rounded-xl text-xs focus:outline-none flex-1 max-w-[160px] truncate"
            >
              <option value="">Selecione a Tag...</option>
              {tagsList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>

            <button
              onClick={handleBulkApply}
              disabled={!selectedBulkTag}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all flex-shrink-0"
            >
              Aplicar
            </button>
          </div>

          <button
            onClick={() => setSelectedIds([])}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            title="Cancelar seleção"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Member Edit/Create Modal */}
      <MembroModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMembro(null);
        }}
        onSave={handleSaveMembro}
        membro={editingMembro}
      />
    </div>
  );
}
