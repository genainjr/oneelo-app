'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
import { StatusBadge } from '@/components/app/status-badge';
import { ContactCell } from '@/components/app/contact-cell';
import { EntityCard } from '@/components/app/entity-card';
import { InitialsAvatar } from '@/components/app/initials-avatar';
import { getMemberDisplayName } from '@/components/app/escala-shared';
import { Membro, Tag, AuthUser } from '@/types';
import { api } from '@/lib/api';
import { formatDate, formatPhone, MINISTRY_ROLE_LABEL, STATUS_MEMBRO_COLOR, STATUS_MEMBRO_LABEL } from '@/lib/utils';
import { useAuthUser } from '@/contexts/auth-user-context';

type FeedbackMessage = {
  type: 'success' | 'error';
  message: string;
} | null;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getReadableTextColor(hexColor?: string | null) {
  const hex = (hexColor || '').replace('#', '').trim();
  if (hex.length !== 6) return '#111827';

  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) return '#111827';

  const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
  return luminance > 170 ? '#111827' : '#ffffff';
}

export default function MembrosPage() {
  const t = useTranslations('members');
  const router = useRouter();
  const { setUser: setAuthUser } = useAuthUser();

  function syncAuthenticatedMemberPhoto(memberId: string, member: Membro) {
    setAuthUser((current) => {
      if (!current?.membro || current.memberId !== memberId) return current;

      return {
        ...current,
        membro: {
          ...current.membro,
          fotoUrl: member.fotoUrl ?? null,
          fotoKey: member.fotoKey ?? null,
        },
      };
    });
  }

  useEffect(() => {
    api.get<AuthUser>('/api/auth/me').then((me) => {
      if (me.role === 'BASIC') router.replace('/personal-panel');
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
    uploadMembroFoto,
    removeMembroFoto,
    bulkTag,
  } = useMembros();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMembro, setEditingMembro] = useState<Membro | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [tagsList, setTagsList] = useState<Tag[]>([]);
  const [selectedBulkTags, setSelectedBulkTags] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<'ADD' | 'REMOVE'>('ADD');

  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#4f46e5');
  const [feedback, setFeedback] = useState<FeedbackMessage>(null);
  const [pendingDeleteMembro, setPendingDeleteMembro] = useState<Membro | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const membersListTopRef = useRef<HTMLDivElement | null>(null);

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
    let mounted = true;

    api.get<Tag[]>('/api/tags')
      .then((data) => {
        if (mounted) setTagsList(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        console.error('Erro ao buscar tags:', e);
      });

    return () => {
      mounted = false;
    };
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

  function scrollMembersListToTop() {
    if (typeof window === 'undefined') return;

    window.requestAnimationFrame(() => {
      const target = membersListTopRef.current;
      if (!target) return;

      const dashboardScrollContainer = target.closest<HTMLElement>('[data-dashboard-scroll-container]');

      if (dashboardScrollContainer) {
        const containerRect = dashboardScrollContainer.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const top = dashboardScrollContainer.scrollTop + targetRect.top - containerRect.top - 16;

        dashboardScrollContainer.scrollTo({
          top: Math.max(top, 0),
          behavior: 'auto',
        });
        return;
      }

      target.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
  }

  function handleMembersPageChange(page: number) {
    setCurrentPage(page);
    scrollMembersListToTop();
  }

  async function handleSaveMembro(data: Partial<Membro>) {
    let saved: Membro;
    if (editingMembro) {
      saved = await updateMembro(editingMembro.id, data);
    } else {
      saved = await createMembro(data);
    }
    fetchTags();
    return saved;
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
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: getErrorMessage(err, t('deleteError')) });
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
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: getErrorMessage(err, t('tag.error')) });
    }
  }

  async function handleBulkApply() {
    if (selectedIds.length === 0 || selectedBulkTags.length === 0) return;
    try {
      await bulkTag(selectedIds, selectedBulkTags, bulkAction);
      setSelectedIds([]);
      setSelectedBulkTags([]);
      setFeedback({ type: 'success', message: t('bulk.success') });
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: getErrorMessage(err, t('bulk.error')) });
    }
  }

  const columns: Column<Membro>[] = [
    {
      key: 'nome',
      header: t('columns.name'),
      className: 'font-medium text-gray-900',
      render: (m) => (
        <div className="flex items-center gap-3">
          <InitialsAvatar name={m.nome} src={m.fotoUrl} alt={m.nome} />
          <span className="font-bold text-gray-900 hover:text-indigo-600 cursor-pointer" onClick={() => { setEditingMembro(m); setIsModalOpen(true); }}>
            {m.nome}
          </span>
        </div>
      ),
    },
    {
      key: 'contato',
      header: t('columns.contact'),
      render: (m) => <ContactCell whatsapp={m.whatsapp} email={m.email} />,
    },
    {
      key: 'status',
      header: t('columns.status'),
      render: (m) => (
        <StatusBadge
          label={STATUS_MEMBRO_LABEL[m.status]}
          className={`font-bold ${STATUS_MEMBRO_COLOR[m.status]}`}
        />
      ),
    },
    {
      key: 'dataNascimento',
      header: t('columns.birthDate'),
      render: (m) => (
        <span className="text-gray-600">{formatDate(m.dataNascimento)}</span>
      ),
    },
    {
      key: 'tags',
      header: t('columns.tags'),
      render: (m) => (
        <div className="space-y-1">
          {m.tags && m.tags.length > 0 ? (
            m.tags.slice(0, 3).map((mt) => (
              <p key={mt.tag.id} className="text-xs font-semibold" style={{ color: mt.tag.cor }}>
                {mt.tag.nome}
              </p>
            ))
          ) : (
            <span className="text-xs text-gray-300">-</span>
          )}
        </div>
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
            className="p-2 border border-gray-200 hover:border-gray-300 rounded-xl text-gray-600 bg-white transition-all hover:bg-gray-50 flex items-center justify-center"
            title={t('editTooltip')}
          >
            <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={() => handleDelete(m)}
            className="p-2 border border-red-100 hover:bg-red-50 rounded-xl text-red-500 transition-all flex items-center justify-center"
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
        stackActionsOnMobile
        action={
          <button
            onClick={() => {
              setEditingMembro(null);
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 max-sm:w-full"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t('new')}
          </button>
        }
      />

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

      <div ref={membersListTopRef}>
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
                  const activeTextColor = getReadableTextColor(tag.cor);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleToggleTagFilter(tag.nome)}
                      style={{
                        backgroundColor: active ? tag.cor : 'transparent',
                        color: active ? activeTextColor : tag.cor,
                        borderColor: active ? tag.cor : `${tag.cor}99`,
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border rounded-lg transition-all shadow-2xs hover:shadow-xs ${
                        active ? 'ring-2 ring-offset-1 ring-indigo-200' : 'opacity-90'
                      }`}
                    >
                      {active && (
                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
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
      </div>

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
        onPageChange={handleMembersPageChange}
        scrollOnPageChange={false}
        emptyTitle={t('empty.noResults')}
        emptyDescription={t('empty.noResultsDesc')}
        renderMobileCard={(membro) => (
          <EntityCard
            leadingVisual={<InitialsAvatar name={membro.nome} src={membro.fotoUrl} alt={membro.nome} />}
            title={getMemberDisplayName(membro)}
            subtitle={[formatPhone(membro.whatsapp), formatDate(membro.dataNascimento)].filter((value) => value !== '—').join(' • ')}
            badge={
              <StatusBadge
                label={STATUS_MEMBRO_LABEL[membro.status]}
                className={`font-bold ${STATUS_MEMBRO_COLOR[membro.status]}`}
              />
            }
            className={selectedIds.includes(membro.id) ? 'ring-2 ring-indigo-200 border-indigo-200' : ''}
            meta={(membro.ministerios || [])
              .map((ministerio) => ministerio.ministerio?.nome)
              .filter(Boolean)
              .join(', ') || 'Sem ministério'}
            footer={
              <button
                type="button"
                onClick={() => {
                  if (selectedIds.includes(membro.id)) {
                    setSelectedIds(selectedIds.filter((id) => id !== membro.id));
                  } else {
                    setSelectedIds([...selectedIds, membro.id]);
                  }
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-xs font-semibold transition-all ${
                  selectedIds.includes(membro.id)
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
                aria-pressed={selectedIds.includes(membro.id)}
              >
                <span>{selectedIds.includes(membro.id) ? 'Selecionado' : 'Selecionar para tags'}</span>
                <svg
                  className={`h-4 w-4 ${selectedIds.includes(membro.id) ? 'text-indigo-600' : 'text-gray-400'}`}
                  fill={selectedIds.includes(membro.id) ? 'currentColor' : 'none'}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  {selectedIds.includes(membro.id) ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            }
            actions={
              <>
                <button
                  onClick={() => {
                    setEditingMembro(membro);
                    setIsModalOpen(true);
                  }}
                  className="p-2 border border-gray-200 hover:border-gray-300 rounded-xl text-gray-600 bg-white transition-all hover:bg-gray-50 flex items-center justify-center"
                  title={t('editTooltip')}
                >
                  <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(membro)}
                  className="p-2 border border-red-100 hover:bg-red-50 rounded-xl text-red-500 transition-all flex items-center justify-center"
                  title={t('deleteTooltip')}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            }
          />
        )}
      />

      {/* Bulk Action Banner */}
      {selectedIds.length > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl animate-in slide-in-from-bottom-6 duration-300 sm:bottom-6 sm:px-5 sm:py-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-shrink-0 text-sm font-medium text-gray-700">
                <span className="mr-2 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white">
                  {selectedIds.length}
                </span>
                {t('bulk.selected', { count: selectedIds.length })}
              </div>

              <button
                onClick={() => setSelectedIds([])}
                className="p-1 text-gray-400 transition-colors hover:text-gray-700"
                title={t('bulk.cancelSelection')}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value as 'ADD' | 'REMOVE')}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none sm:w-40"
              >
                <option value="ADD">{t('bulk.addTag')}</option>
                <option value="REMOVE">{t('bulk.removeTag')}</option>
              </select>

              <div className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  {t('bulk.selectTag')}
                </div>
                <div className="max-h-36 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {tagsList.map((tag) => {
                      const active = selectedBulkTags.includes(tag.id);
                      const activeTextColor = getReadableTextColor(tag.cor);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            setSelectedBulkTags((prev) =>
                              prev.includes(tag.id) ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                            );
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                            active ? 'ring-2 ring-offset-1 ring-indigo-200' : 'opacity-90'
                          }`}
                          style={{
                            backgroundColor: active ? tag.cor : 'transparent',
                            color: active ? activeTextColor : tag.cor,
                            borderColor: active ? tag.cor : `${tag.cor}99`,
                          }}
                        >
                          {active && (
                            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {tag.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                onClick={handleBulkApply}
                disabled={selectedBulkTags.length === 0}
                className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {t('bulk.apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      <MembroModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMembro(null);
        }}
        onSave={handleSaveMembro}
        onUploadPhoto={async (id, file) => {
          const updated = await uploadMembroFoto(id, file);
          setEditingMembro(updated);
          syncAuthenticatedMemberPhoto(id, updated);
          return updated;
        }}
        onRemovePhoto={async (id) => {
          const updated = await removeMembroFoto(id);
          setEditingMembro(updated);
          syncAuthenticatedMemberPhoto(id, updated);
          return updated;
        }}
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
