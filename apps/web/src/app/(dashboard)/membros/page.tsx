'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMembros } from '@/hooks/use-membros';
import { PageHeader } from '@/components/app/page-header';
import { DataTable, Column } from '@/components/app/data-table';
import { MembroModal } from '@/components/app/membro-modal';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { FilterShell, FilterActions } from '@/components/app/filter-shell';
import { FilterInput, FilterSelect } from '@/components/app/filter-field';
import { useFilterState } from '@/hooks/use-filter-state';
import { ModalShell, ModalFooter } from '@/components/app/modal-shell';
import { InputField } from '@/components/app/form-field';
import { StatCard } from '@/components/app/stat-card';
import { Membro, Tag, AuthUser } from '@/types';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Users, UserCheck, UserPlus, PhoneOff } from 'lucide-react';

type FeedbackMessage = {
  type: 'success' | 'error';
  message: string;
} | null;

export default function MembrosPage() {
  const t = useTranslations('members');
  const router = useRouter();

  useEffect(() => {
    api.get<AuthUser>('/api/auth/me').then((me) => {
      if (me.role === 'BASIC') router.replace('/dashboard');
    }).catch(() => {});
  }, [router]);

  const {
    membros,
    loading,
    error,
    applyFilter,
    createMembro,
    updateMembro,
    deleteMembro,
    bulkTag,
  } = useMembros();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMembro, setEditingMembro] = useState<Membro | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [tagsList, setTagsList] = useState<Tag[]>([]);
  const [selectedBulkTag, setSelectedBulkTag] = useState('');
  const [bulkAction, setBulkAction] = useState<'ADD' | 'REMOVE'>('ADD');

  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#4f46e5');
  const [feedback, setFeedback] = useState<FeedbackMessage>(null);
  const [pendingDeleteMembro, setPendingDeleteMembro] = useState<Membro | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const itemsPerPage = 10;

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

  const {
    formState: filterState,
    setField: setFilterField,
    handleClear: handleClearFilters,
    handleSubmit: handleFilterSubmit,
  } = useFilterState({
    initialState: {
      nome: '',
      whatsapp: '',
      status: '',
      tags: [] as string[],
      operacao: 'OR' as 'AND' | 'OR',
    },
    onApply: (filters) => {
      setCurrentPage(1);
      applyFilter({
        nome: filters.nome || undefined,
        whatsapp: filters.whatsapp || undefined,
        status: filters.status || undefined,
        tags: filters.tags.join(',') || undefined,
        operacao: filters.operacao,
      });
    },
  });

  function handleToggleTagFilter(tagNome: string) {
    const nextTags = filterState.tags.includes(tagNome)
      ? filterState.tags.filter(t => t !== tagNome)
      : [...filterState.tags, tagNome];
    
    setFilterField('tags', nextTags);
    applyFilter({
      nome: filterState.nome || undefined,
      whatsapp: filterState.whatsapp || undefined,
      status: filterState.status || undefined,
      tags: nextTags.join(',') || undefined,
      operacao: filterState.operacao,
    });
  }

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return membros.slice(start, start + itemsPerPage);
  }, [membros, currentPage]);

  const stats = useMemo(() => ({
    total: membros.length,
    ativos: membros.filter((m) => m.status === 'ATIVO').length,
    visitantes: membros.filter((m) => m.status === 'VISITANTE').length,
    semTelefone: membros.filter((m) => !m.whatsapp).length,
  }), [membros]);

  async function handleSaveMembro(data: Partial<Membro>) {
    if (editingMembro) {
      await updateMembro(editingMembro.id, data);
    } else {
      await createMembro(data);
    }
    fetchTags();
  }

  function handleDelete(membro: Membro) {
    setPendingDeleteMembro(membro);
  }

  async function confirmDeleteMembro() {
    if (!pendingDeleteMembro) return;
    setConfirmLoading(true);
    setFeedback(null);
    try {
      await deleteMembro(pendingDeleteMembro.id);
      setSelectedIds(prev => prev.filter(id => id !== pendingDeleteMembro.id));
      setPendingDeleteMembro(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || t('deleteError') });
    } finally {
      setConfirmLoading(false);
    }
  }

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
      setFeedback({ type: 'error', message: err.message || t('tag.error') });
    }
  }

  async function handleBulkApply() {
    if (selectedIds.length === 0 || !selectedBulkTag) return;
    try {
      await bulkTag(selectedIds, [selectedBulkTag], bulkAction);
      setSelectedIds([]);
      setSelectedBulkTag('');
      setFeedback({ type: 'success', message: t('bulk.success') });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || t('bulk.error') });
    }
  }

  const columns: Column<Membro>[] = [
    {
      key: 'nome',
      header: t('columns.name'),
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
      header: t('columns.contact'),
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
      header: t('columns.status'),
      render: (m) => {
        const colors = {
          ATIVO: 'bg-emerald-50 text-emerald-700 border-emerald-100',
          INATIVO: 'bg-gray-50 text-gray-600 border-gray-150',
          VISITANTE: 'bg-blue-50 text-blue-700 border-blue-100',
          TRANSFERIDO: 'bg-amber-50 text-amber-700 border-amber-100',
        };
        return (
          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${colors[m.status] || 'bg-gray-50'}`}>
            {t(`status.${m.status}` as any)}
          </span>
        );
      },
    },
    {
      key: 'tags',
      header: t('columns.tags'),
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
      header: t('columns.birthDate'),
      render: (m) => (
        <span className="text-xs text-gray-500">{formatDate(m.dataNascimento)}</span>
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
            title={t('editTooltip')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={() => handleDelete(m)}
            className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors"
            title={t('deleteTooltip')}
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
    <div className="p-6 space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
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
            {t('new')}
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={t('stats.total')} value={stats.total} icon={<Users className="w-5 h-5" />} color="indigo" />
        <StatCard title={t('stats.active')} value={stats.ativos} icon={<UserCheck className="w-5 h-5" />} color="emerald" />
        <StatCard title={t('stats.visitors')} value={stats.visitantes} icon={<UserPlus className="w-5 h-5" />} color="amber" />
        <StatCard title={t('stats.noPhone')} value={stats.semTelefone} icon={<PhoneOff className="w-5 h-5" />} color="rose" />
      </div>

      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => window.location.reload()} className="underline font-semibold hover:text-red-800">
            {t('reload')}
          </button>
        </div>
      )}

      {feedback && (
        <div className={`p-4 text-sm border rounded-lg flex items-center justify-between ${
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
          <FilterInput
            id="search-nome"
            type="text"
            label={t('filter.nameLabel')}
            value={filterState.nome}
            onChange={(e) => setFilterField('nome', e.target.value)}
            placeholder={t('filter.namePlaceholder')}
          />

          <FilterInput
            id="search-whatsapp"
            type="text"
            label={t('filter.whatsappLabel')}
            value={filterState.whatsapp}
            onChange={(e) => setFilterField('whatsapp', e.target.value)}
            placeholder={t('filter.whatsappPlaceholder')}
          />

          <FilterSelect
            id="search-status"
            label={t('filter.statusLabel')}
            value={filterState.status}
            onChange={(e) => setFilterField('status', e.target.value)}
          >
            <option value="">{t('filter.allStatuses')}</option>
            <option value="ATIVO">{t('status.ATIVO')}</option>
            <option value="INATIVO">{t('status.INATIVO')}</option>
            <option value="VISITANTE">{t('status.VISITANTE')}</option>
            <option value="TRANSFERIDO">{t('status.TRANSFERIDO')}</option>
          </FilterSelect>
        </div>

        {/* Tags filter */}
        <div className="pt-3 border-t border-gray-100 mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
              {t('filter.tagsLabel')}
            </span>
            <div className="flex flex-wrap gap-2">
              {tagsList.map((tag) => {
                const active = filterState.tags.includes(tag.nome);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleToggleTagFilter(tag.nome)}
                    style={{
                      backgroundColor: active ? tag.cor : 'transparent',
                      color: active ? '#ffffff' : tag.cor,
                      borderColor: tag.cor,
                    }}
                    className="px-2.5 py-1 text-xs font-semibold border rounded-lg transition-all shadow-2xs hover:shadow-xs"
                  >
                    {tag.nome}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setShowNewTagInput(true)}
                className="px-2 py-1 text-xs font-medium border border-dashed border-gray-300 hover:border-indigo-500 rounded-lg text-gray-500 hover:text-indigo-600 transition-all flex items-center gap-1"
              >
                {t('filter.newTag')}
              </button>
            </div>
          </div>

          {filterState.tags.length > 1 && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 p-1.5 rounded-xl self-start md:self-auto">
              <span className="text-xs font-medium text-gray-500 px-1">{t('filter.compositeFilter')}</span>
              <button
                type="button"
                onClick={() => {
                  setFilterField('operacao', 'AND');
                  applyFilter({
                    nome: filterState.nome || undefined,
                    whatsapp: filterState.whatsapp || undefined,
                    status: filterState.status || undefined,
                    tags: filterState.tags.join(',') || undefined,
                    operacao: 'AND',
                  });
                }}
                className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${filterState.operacao === 'AND' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                AND (E)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterField('operacao', 'OR');
                  applyFilter({
                    nome: filterState.nome || undefined,
                    whatsapp: filterState.whatsapp || undefined,
                    status: filterState.status || undefined,
                    tags: filterState.tags.join(',') || undefined,
                    operacao: 'OR',
                  });
                }}
                className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${filterState.operacao === 'OR' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                OR (OU)
              </button>
            </div>
          )}
        </div>
      </FilterShell>

      {/* New Tag Modal */}
      <ModalShell
        isOpen={showNewTagInput}
        title={t('tag.createTitle')}
        onClose={() => setShowNewTagInput(false)}
        size="sm"
      >
        <form id="new-tag-form" onSubmit={handleCreateTag}>
          <div className="space-y-4 p-6">
            <InputField
              label={t('tag.nameLabel')}
              type="text"
              required
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder={t('tag.namePlaceholder')}
            />
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{t('tag.colorLabel')}</label>
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
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>
          <ModalFooter
            form="new-tag-form"
            primaryLabel={t('tag.create')}
            cancelLabel={t('tag.cancel')}
            onCancel={() => setShowNewTagInput(false)}
          />
        </form>
      </ModalShell>

      {/* Members Table */}
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
        emptyTitle={t('empty.noResults')}
        emptyDescription={t('empty.noResultsDesc')}
      />

      {/* Bulk Action Banner */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white rounded-2xl shadow-xl px-5 py-3.5 flex items-center gap-4 animate-in slide-in-from-bottom-6 duration-300 max-w-2xl w-full border border-gray-800">
          <div className="flex-shrink-0 text-sm font-medium">
            <span className="bg-indigo-500 text-white font-bold rounded-lg px-2.5 py-1 text-xs mr-2">
              {selectedIds.length}
            </span>
            {t('bulk.selected', { count: selectedIds.length })}
          </div>

          <div className="h-4 w-px bg-gray-700" />

          <div className="flex items-center gap-2 flex-1">
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value as 'ADD' | 'REMOVE')}
              className="bg-gray-800 text-white border border-gray-700 px-3 py-1.5 rounded-xl text-xs focus:outline-none"
            >
              <option value="ADD">{t('bulk.addTag')}</option>
              <option value="REMOVE">{t('bulk.removeTag')}</option>
            </select>

            <select
              value={selectedBulkTag}
              onChange={(e) => setSelectedBulkTag(e.target.value)}
              className="bg-gray-800 text-white border border-gray-700 px-3 py-1.5 rounded-xl text-xs focus:outline-none flex-1 max-w-[160px] truncate"
            >
              <option value="">{t('bulk.selectTag')}</option>
              {tagsList.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.nome}
                </option>
              ))}
            </select>

            <button
              onClick={handleBulkApply}
              disabled={!selectedBulkTag}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all flex-shrink-0"
            >
              {t('bulk.apply')}
            </button>
          </div>

          <button
            onClick={() => setSelectedIds([])}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            title={t('bulk.cancelSelection')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <MembroModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMembro(null);
        }}
        onSave={handleSaveMembro}
        membro={editingMembro}
      />

      <ConfirmDialog
        isOpen={!!pendingDeleteMembro}
        title={t('deleteTooltip')}
        description={pendingDeleteMembro ? t('deleteConfirm', { name: pendingDeleteMembro.nome }) : ''}
        confirmLabel={t('deleteTooltip')}
        loading={confirmLoading}
        onConfirm={confirmDeleteMembro}
        onCancel={() => setPendingDeleteMembro(null)}
      />
    </div>
  );
}
