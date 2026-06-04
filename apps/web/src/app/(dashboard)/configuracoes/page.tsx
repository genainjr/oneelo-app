'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { DataTable, Column } from '@/components/app/data-table';
import { api } from '@/lib/api';
import { User, AuditLog, AuthUser } from '@/types';
import { formatDateTime, ROLE_LABEL } from '@/lib/utils';

export default function ConfiguracoesPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<'usuarios' | 'audit'>('usuarios');

  // Lists
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<AuthUser>('/api/auth/me')
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  const isAdmin = currentUser?.role === 'ADMIN';

  async function loadData() {
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
      setError(err?.message || 'Erro ao carregar dados de configurações.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser, activeTab]);

  if (!currentUser) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-250 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-250 rounded"></div>
              <div className="h-4 bg-gray-250 rounded w-5/6"></div>
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
        <h2 className="text-lg font-bold text-gray-800 mb-2">Acesso Restrito</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Esta página está disponível apenas para administradores gerais do sistema. Caso necessite de acesso, entre em contato com o suporte ou gestor de TI da igreja.
        </p>
        <button
          onClick={() => window.location.href = '/'}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm"
        >
          Voltar ao Dashboard
        </button>
      </div>
    );
  }

  // Users Columns
  const userColumns: Column<User>[] = [
    {
      key: 'nome',
      header: 'Nome',
      className: 'font-semibold text-gray-800',
    },
    {
      key: 'email',
      header: 'E-mail',
      render: (u) => <span className="text-gray-500">{u.email}</span>,
    },
    {
      key: 'role',
      header: 'Perfil / Permissão',
      render: (u) => {
        const badges: any = {
          ADMIN: 'bg-red-50 text-red-700 border-red-100',
          STAFF: 'bg-indigo-50 text-indigo-700 border-indigo-100',
          BASIC: 'bg-gray-50 text-gray-600 border-gray-200',
        };
        return (
          <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-lg border ${badges[u.role] || 'bg-gray-50'}`}>
            {ROLE_LABEL[u.role] || u.role}
          </span>
        );
      },
    },
    {
      key: 'ativo',
      header: 'Status',
      render: (u) => (
        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${u.ativo ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-250'}`}>
          {u.ativo ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Cadastro',
      render: (u) => <span className="text-xs text-gray-400">{formatDateTime(u.createdAt)}</span>,
    },
  ];

  // Audit Logs Columns
  const auditColumns: Column<AuditLog>[] = [
    {
      key: 'createdAt',
      header: 'Data / Hora',
      render: (log) => <span className="text-xs text-gray-500">{formatDateTime(log.createdAt)}</span>,
    },
    {
      key: 'user',
      header: 'Operador',
      render: (log) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-800 text-xs">{log.user?.nome || 'Sistema'}</span>
          {log.user?.email && <span className="text-[10px] text-gray-400">{log.user.email}</span>}
        </div>
      ),
    },
    {
      key: 'acao',
      header: 'Operação',
      render: (log) => {
        const badges: any = {
          CRIAR: 'bg-emerald-50 text-emerald-700 border-emerald-100',
          ATUALIZAR: 'bg-blue-50 text-blue-700 border-blue-100',
          DELETAR: 'bg-rose-50 text-rose-700 border-rose-100',
          LOGIN: 'bg-indigo-50 text-indigo-700 border-indigo-100',
          LOGOUT: 'bg-gray-100 text-gray-600 border-gray-200',
        };
        return (
          <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-lg border ${badges[log.acao] || 'bg-gray-50'}`}>
            {log.acao}
          </span>
        );
      },
    },
    {
      key: 'entidade',
      header: 'Recurso',
      render: (log) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-gray-700 uppercase tracking-wider">{log.entidade}</span>
          {log.entidadeId && <span className="text-[9px] text-gray-400 font-mono">ID: {log.entidadeId}</span>}
        </div>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP Address',
      render: (log) => <span className="text-[11px] text-gray-400 font-mono">{log.ipAddress || '—'}</span>,
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Painel de Configurações"
        description="Controle os perfis de acesso dos usuários e confira os relatórios de auditoria."
      />

      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => loadData()} className="underline font-semibold hover:text-red-800">
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex border-b border-gray-100 bg-white rounded-t-2xl px-5 border-t border-x shadow-2xs">
        <button
          onClick={() => setActiveTab('usuarios')}
          className={`py-4 text-sm font-semibold border-b-2 px-1 transition-all mr-8 flex items-center gap-2 ${activeTab === 'usuarios' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Usuários do Sistema ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`py-4 text-sm font-semibold border-b-2 px-1 transition-all flex items-center gap-2 ${activeTab === 'audit' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Log de Auditoria ({auditLogs.length})
        </button>
      </div>

      {/* Tables display */}
      {activeTab === 'usuarios' ? (
        <DataTable
          columns={userColumns}
          data={users}
          loading={loading}
          itemsPerPage={15}
          emptyTitle="Nenhum usuário cadastrado"
          emptyDescription="Os usuários têm login e senha para gerenciar o sistema."
        />
      ) : (
        <DataTable
          columns={auditColumns}
          data={auditLogs}
          loading={loading}
          itemsPerPage={15}
          emptyTitle="Nenhum registro de auditoria"
          emptyDescription="Ações de mutação em membros, ministérios e escalas aparecerão aqui."
        />
      )}
    </div>
  );
}
