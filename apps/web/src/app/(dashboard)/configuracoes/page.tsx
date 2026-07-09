'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/app/page-header';
import { Skeleton } from '@/components/app/skeleton';
import { DataTable, Column, SortState } from '@/components/app/data-table';
import { StatusBadge } from '@/components/app/status-badge';
import { UsuarioModal } from '@/components/app/usuario-modal';
import { api } from '@/lib/api';
import { User, AuditLog, AuthUser } from '@/types';
import { useDateFormatter } from '@/hooks/use-date-formatter';

export default function ConfiguracoesPage() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const { formatDateTime } = useDateFormatter();

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<'usuarios' | 'audit'>('usuarios');

  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [userPage, setUserPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [userSort, setUserSort] = useState<SortState>({ key: 'nome', direction: 'asc' });
  const itemsPerPage = 15;

  const sortedUsers = useMemo(() => {
    const arr = [...users];
    arr.sort((a, b) => {
      let cmp = 0;
      if (userSort.key === 'createdAt') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else {
        cmp = (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
      }
      return userSort.direction === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [users, userSort]);

  const pagedUsers = useMemo(
    () => sortedUsers.slice((userPage - 1) * itemsPerPage, userPage * itemsPerPage),
    [sortedUsers, userPage],
  );
  const pagedAudit = useMemo(
    () => auditLogs.slice((auditPage - 1) * itemsPerPage, auditPage * itemsPerPage),
    [auditLogs, auditPage],
  );

  useEffect(() => {
    api.get<AuthUser>('/api/auth/me')
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  const isAdmin = currentUser?.role === 'ADMIN';

  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'usuarios') {
        const data = await api.get<User[]>('/api/auth/users');
        setUsers(Array.isArray(data) ? data : []);
      } else {
        const data = await api.get<AuditLog[]>('/api/auth/audit-logs');
        setAuditLogs(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      setError(err?.message || t('errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, activeTab, t]);

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser, activeTab, loadData]);

  function openCreate() {
    setEditingUser(null);
    setModalOpen(true);
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setModalOpen(true);
  }

  async function handleSave(data: Partial<User> & { senha?: string }) {
    if (editingUser) {
      await api.patch(`/api/auth/users/${editingUser.id}`, data);
    } else {
      await api.post('/api/auth/users', data);
    }
    await loadData();
  }

  async function handleDelete() {
    if (!deletingUser) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/auth/users/${deletingUser.id}`);
      setDeletingUser(null);
      await loadData();
    } catch (err: any) {
      setError(err?.message || t('errorDeactivate'));
      setDeletingUser(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  if (!currentUser) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <Skeleton className="h-4 w-3/4 bg-gray-250" />
            <div className="space-y-2">
              <Skeleton className="h-4 bg-gray-250" />
              <Skeleton className="h-4 w-5/6 bg-gray-250" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-xl mx-auto mt-12 text-center bg-white border border-gray-150 shadow-sm rounded-2xl">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">{t('accessRestricted.title')}</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {t('accessRestricted.description')}
        </p>
        <button
          onClick={() => window.location.href = '/'}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm"
        >
          {t('accessRestricted.backToDashboard')}
        </button>
      </div>
    );
  }

  function renderUserRoleBadge(user: User) {
    const badges: Record<string, string> = {
      ADMIN: 'bg-red-50 text-red-700 border-red-100',
      STAFF: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      BASIC: 'bg-gray-50 text-gray-600 border-gray-200',
    };

    return (
      <StatusBadge
        label={tCommon(`roles.${user.role}` as any) || user.role}
        className={`rounded-lg border ${badges[user.role] || 'bg-gray-50'}`}
      />
    );
  }

  function renderUserStatusBadge(user: User) {
    return (
      <StatusBadge
        label={user.ativo ? t('users.status.active') : t('users.status.inactive')}
        className={`border ${user.ativo ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-250'}`}
      />
    );
  }

  function renderAuditOperationBadge(log: AuditLog) {
    const badges: Record<string, string> = {
      CRIAR: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      ATUALIZAR: 'bg-blue-50 text-blue-700 border-blue-100',
      DELETAR: 'bg-rose-50 text-rose-700 border-rose-100',
      LOGIN: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      LOGOUT: 'bg-gray-100 text-gray-600 border-gray-200',
    };

    return (
      <StatusBadge
        label={log.acao}
        className={`rounded-lg border font-bold ${badges[log.acao] || 'bg-gray-50'}`}
      />
    );
  }

  const userColumns: Column<User>[] = [
    {
      key: 'nome',
      header: t('users.columns.name'),
      className: 'font-semibold text-gray-800',
      sortable: true,
    },
    {
      key: 'email',
      header: t('users.columns.email'),
      hideOnMobile: true,
      render: (u) => <span className="text-gray-500">{u.email}</span>,
    },
    {
      key: 'role',
      header: t('users.columns.role'),
      render: renderUserRoleBadge,
    },
    {
      key: 'membro' as keyof User,
      header: t('users.columns.member'),
      hideOnMobile: true,
      render: (u) =>
        u.membro ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg font-medium">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {u.membro.nome}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
    {
      key: 'ativo',
      header: t('users.columns.status'),
      render: renderUserStatusBadge,
    },
    {
      key: 'createdAt',
      header: t('users.columns.registeredAt'),
      hideOnMobile: true,
      sortable: true,
      render: (u) => <span className="text-xs text-gray-400">{formatDateTime(u.createdAt)}</span>,
    },
    {
      key: 'id',
      header: t('users.columns.actions'),
      render: (u) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEdit(u)}
            title={t('users.editTooltip')}
            className="p-2 border border-gray-200 hover:border-gray-300 rounded-xl text-gray-600 bg-white transition-all hover:bg-gray-50 flex items-center justify-center"
          >
            <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          {u.id !== currentUser?.id && (
              <button
                onClick={() => setDeletingUser(u)}
                title={t('users.deactivateTooltip')}
                className="p-2 border border-red-100 hover:bg-red-50 rounded-xl text-red-500 transition-all flex items-center justify-center"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      ),
    },
  ];

  const auditColumns: Column<AuditLog>[] = [
    {
      key: 'createdAt',
      header: t('audit.columns.dateTime'),
      render: (log) => <span className="text-xs text-gray-500">{formatDateTime(log.createdAt)}</span>,
    },
    {
      key: 'user',
      header: t('audit.columns.operator'),
      render: (log) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-800 text-xs">{log.user?.nome || t('audit.system')}</span>
          {log.user?.email && <span className="text-[10px] text-gray-400">{log.user.email}</span>}
        </div>
      ),
    },
    {
      key: 'acao',
      header: t('audit.columns.operation'),
      render: renderAuditOperationBadge,
    },
    {
      key: 'entidade',
      header: t('audit.columns.resource'),
      hideOnMobile: true,
      render: (log) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-gray-700 uppercase tracking-wider">{log.entidade}</span>
          {log.entidadeId && <span className="text-[9px] text-gray-400 font-mono">ID: {log.entidadeId}</span>}
        </div>
      ),
    },
    {
      key: 'ipAddress',
      header: t('audit.columns.ipAddress'),
      hideOnMobile: true,
      render: (log) => <span className="text-[11px] text-gray-400 font-mono">{log.ipAddress || '—'}</span>,
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 px-4 py-4 sm:space-y-6 sm:p-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
      />

      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => loadData()} className="underline font-semibold hover:text-red-800">
            {t('retry')}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-col gap-3 border border-gray-100 bg-white rounded-t-2xl px-4 py-3 shadow-2xs sm:flex-row sm:items-center sm:px-5 sm:py-0">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-8">
          <button
            onClick={() => { setActiveTab('usuarios'); setUserPage(1); }}
            className={`min-h-11 justify-center rounded-xl px-3 text-sm font-semibold transition-all flex items-center gap-2 sm:min-h-0 sm:rounded-none sm:border-b-2 sm:px-1 sm:py-4 ${activeTab === 'usuarios' ? 'bg-indigo-50 text-indigo-700 sm:bg-transparent sm:border-indigo-600 sm:text-indigo-600' : 'text-gray-500 hover:text-gray-700 sm:border-transparent'}`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="truncate">{t('tabs.users')} ({users.length})</span>
          </button>
          <button
            onClick={() => { setActiveTab('audit'); setAuditPage(1); }}
            className={`min-h-11 justify-center rounded-xl px-3 text-sm font-semibold transition-all flex items-center gap-2 sm:min-h-0 sm:rounded-none sm:border-b-2 sm:px-1 sm:py-4 ${activeTab === 'audit' ? 'bg-indigo-50 text-indigo-700 sm:bg-transparent sm:border-indigo-600 sm:text-indigo-600' : 'text-gray-500 hover:text-gray-700 sm:border-transparent'}`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="truncate">{t('tabs.audit')} ({auditLogs.length})</span>
          </button>
        </div>

        {activeTab === 'usuarios' && (
          <div className="flex items-center sm:ml-auto">
            <button
              onClick={openCreate}
              className="flex w-full items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all sm:w-auto sm:my-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t('users.new')}
            </button>
          </div>
        )}
      </div>

      {activeTab === 'usuarios' ? (
        <DataTable
          columns={userColumns}
          data={pagedUsers}
          loading={loading}
          sort={userSort}
          onSortChange={(s) => { setUserSort(s); setUserPage(1); }}
          currentPage={userPage}
          totalItems={users.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setUserPage}
          emptyTitle={t('users.noUsers')}
          emptyDescription={t('users.noUsersDesc')}
          renderMobileCard={(user) => (
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-gray-800 truncate">{user.nome}</h3>
                  <p className="text-sm text-gray-500 truncate">{user.email}</p>
                </div>
                <div className="shrink-0">{renderUserStatusBadge(user)}</div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-400 font-medium">
                <div className="flex items-center gap-1.5">
                  <span>{t('users.columns.role')}:</span>
                  {renderUserRoleBadge(user)}
                </div>
                <span>{t('users.columns.registeredAt')}: {formatDateTime(user.createdAt)}</span>
                {user.membro && <span className="min-w-0 truncate">{t('users.columns.member')}: {user.membro.nome}</span>}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                <button
                  onClick={() => openEdit(user)}
                  title={t('users.editTooltip')}
                  className="p-2 border border-gray-200 hover:border-gray-300 rounded-xl text-gray-600 bg-white transition-all hover:bg-gray-50 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                {user.id !== currentUser?.id && (
                  <button
                    onClick={() => setDeletingUser(user)}
                    title={t('users.deactivateTooltip')}
                    className="p-2 border border-red-100 hover:bg-red-50 rounded-xl text-red-500 transition-all flex items-center justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
        />
      ) : (
        <DataTable
          columns={auditColumns}
          data={pagedAudit}
          loading={loading}
          currentPage={auditPage}
          totalItems={auditLogs.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setAuditPage}
          emptyTitle={t('audit.noLogs')}
          emptyDescription={t('audit.noLogsDesc')}
          renderMobileCard={(log) => (
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-gray-800 truncate">{log.user?.nome || t('audit.system')}</h3>
                  {log.user?.email && <p className="text-sm text-gray-500 truncate">{log.user.email}</p>}
                </div>
                <div className="shrink-0">{renderAuditOperationBadge(log)}</div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-400 font-medium">
                <span>{formatDateTime(log.createdAt)}</span>
                <span className="uppercase tracking-wider">{log.entidade}</span>
                {log.ipAddress && <span className="font-mono">{log.ipAddress}</span>}
              </div>
            </div>
          )}
        />
      )}

      <UsuarioModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        usuario={editingUser}
        currentUserId={currentUser?.id}
      />

      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-800">{t('deactivate.title')}</h3>
                <p className="text-xs text-gray-500">{t('deactivate.subtitle')}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              {t('deactivate.message', { name: deletingUser.nome })}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingUser(null)}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
              >
                {t('deactivate.cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all disabled:opacity-60 flex items-center gap-2"
              >
                {deleteLoading && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {deleteLoading ? t('deactivate.confirming') : t('deactivate.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
