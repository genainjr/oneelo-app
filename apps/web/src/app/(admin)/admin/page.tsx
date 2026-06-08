'use client';

import { useEffect, useState } from 'react';
import { useAdmin, CreateTenantPayload, UpdateTenantPayload, CreateTenantUserPayload } from '@/hooks/use-admin';
import { Tenant, Plano } from '@/types';
import { HttpError } from '@/lib/api';

const PLANO_LABELS: Record<Plano, string> = {
  GRATUITO: 'Gratuito',
  BASICO: 'Básico',
  PROFISSIONAL: 'Profissional',
};

const PLANO_COLORS: Record<Plano, string> = {
  GRATUITO: 'bg-gray-100 text-gray-600',
  BASICO: 'bg-blue-100 text-blue-700',
  PROFISSIONAL: 'bg-purple-100 text-purple-700',
};

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>{label}</span>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition';
const selectCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition';

// ─── Modal Criar Tenant ────────────────────────────────────────────────────────

function CreateTenantModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { createTenant } = useAdmin();
  const [form, setForm] = useState<CreateTenantPayload>({
    nome: '', slug: '', plano: 'GRATUITO',
    email: '', telefone: '', idioma: 'pt-BR',
    adminNome: '', adminEmail: '', adminSenha: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(key: keyof CreateTenantPayload, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleNomeChange(v: string) {
    set('nome', v);
    if (!form.slug || form.slug === slugify(form.nome)) {
      set('slug', slugify(v));
    }
  }

  function slugify(str: string) {
    return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createTenant(form);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Erro ao criar tenant.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Novo Tenant" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Nome da Igreja">
            <input className={inputCls} required value={form.nome} onChange={(e) => handleNomeChange(e.target.value)} placeholder="Igreja Exemplo" />
          </FieldGroup>
          <FieldGroup label="Slug (URL)">
            <input className={inputCls} required value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="igreja-exemplo" pattern="[a-z0-9-]+" />
          </FieldGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Plano">
            <select className={selectCls} value={form.plano} onChange={(e) => set('plano', e.target.value as Plano)}>
              <option value="GRATUITO">Gratuito</option>
              <option value="BASICO">Básico</option>
              <option value="PROFISSIONAL">Profissional</option>
            </select>
          </FieldGroup>
          <FieldGroup label="Idioma padrão">
            <select className={selectCls} value={form.idioma} onChange={(e) => set('idioma', e.target.value)}>
              <option value="pt-BR">Português (Brasil)</option>
              <option value="pt-PT">Português (Portugal)</option>
              <option value="en-US">English (US)</option>
            </select>
          </FieldGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="E-mail de contato">
            <input className={inputCls} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="pastor@igreja.com" />
          </FieldGroup>
          <FieldGroup label="Telefone">
            <input className={inputCls} value={form.telefone} onChange={(e) => set('telefone', e.target.value)} placeholder="(11) 99999-9999" />
          </FieldGroup>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Usuário Administrador</p>
          <div className="space-y-3">
            <FieldGroup label="Nome">
              <input className={inputCls} required value={form.adminNome} onChange={(e) => set('adminNome', e.target.value)} placeholder="Pastor João" />
            </FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="E-mail">
                <input className={inputCls} type="email" required value={form.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} placeholder="admin@igreja.com" />
              </FieldGroup>
              <FieldGroup label="Senha">
                <input className={inputCls} type="password" required minLength={6} value={form.adminSenha} onChange={(e) => set('adminSenha', e.target.value)} placeholder="••••••••" />
              </FieldGroup>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition">Cancelar</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition disabled:opacity-60">
            {loading ? 'Criando...' : 'Criar Tenant'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal Editar Tenant ──────────────────────────────────────────────────────

function EditTenantModal({ tenant, onClose, onSuccess }: { tenant: Tenant; onClose: () => void; onSuccess: () => void }) {
  const { updateTenant } = useAdmin();
  const [form, setForm] = useState<UpdateTenantPayload>({
    nome: tenant.nome,
    plano: tenant.plano,
    ativo: tenant.ativo,
    email: tenant.email ?? '',
    telefone: tenant.telefone ?? '',
    idioma: tenant.idioma ?? 'pt-BR',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(key: keyof UpdateTenantPayload, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await updateTenant(tenant.id, form);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Erro ao atualizar tenant.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={`Editar — ${tenant.nome}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FieldGroup label="Nome da Igreja">
          <input className={inputCls} required value={form.nome} onChange={(e) => set('nome', e.target.value)} />
        </FieldGroup>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Plano">
            <select className={selectCls} value={form.plano} onChange={(e) => set('plano', e.target.value as Plano)}>
              <option value="GRATUITO">Gratuito</option>
              <option value="BASICO">Básico</option>
              <option value="PROFISSIONAL">Profissional</option>
            </select>
          </FieldGroup>
          <FieldGroup label="Idioma padrão">
            <select className={selectCls} value={form.idioma} onChange={(e) => set('idioma', e.target.value)}>
              <option value="pt-BR">Português (Brasil)</option>
              <option value="pt-PT">Português (Portugal)</option>
              <option value="en-US">English (US)</option>
            </select>
          </FieldGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="E-mail de contato">
            <input className={inputCls} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Telefone">
            <input className={inputCls} value={form.telefone} onChange={(e) => set('telefone', e.target.value)} />
          </FieldGroup>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => set('ativo', !form.ativo)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${form.ativo ? 'bg-indigo-600' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition ${form.ativo ? 'translate-x-4' : 'translate-x-1'}`} />
          </button>
          <span className="text-sm text-gray-700">{form.ativo ? 'Ativo' : 'Inativo'}</span>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition">Cancelar</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition disabled:opacity-60">
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal Novo Usuário ────────────────────────────────────────────────────────

function CreateUserModal({ tenant, onClose, onSuccess }: { tenant: Tenant; onClose: () => void; onSuccess: () => void }) {
  const { createTenantUser } = useAdmin();
  const [form, setForm] = useState<CreateTenantUserPayload>({ nome: '', email: '', senha: '', role: 'ADMIN' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(key: keyof CreateTenantUserPayload, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createTenantUser(tenant.id, form);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Erro ao criar usuário.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={`Novo Usuário — ${tenant.nome}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FieldGroup label="Nome">
          <input className={inputCls} required value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="João da Silva" />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="E-mail">
            <input className={inputCls} type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="joao@igreja.com" />
          </FieldGroup>
          <FieldGroup label="Senha">
            <input className={inputCls} type="password" required minLength={6} value={form.senha} onChange={(e) => set('senha', e.target.value)} placeholder="••••••••" />
          </FieldGroup>
        </div>
        <FieldGroup label="Perfil">
          <select className={selectCls} value={form.role} onChange={(e) => set('role', e.target.value)}>
            <option value="ADMIN">Administrador</option>
            <option value="STAFF">Colaborador</option>
            <option value="BASIC">Membro</option>
          </select>
        </FieldGroup>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition">Cancelar</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition disabled:opacity-60">
            {loading ? 'Criando...' : 'Criar Usuário'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────

export default function AdminTenantsPage() {
  const { listTenants } = useAdmin();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Tenant | null>(null);
  const [userTarget, setUserTarget] = useState<Tenant | null>(null);

  async function fetchTenants() {
    setLoading(true);
    setError('');
    try {
      const data = await listTenants();
      setTenants(data);
    } catch {
      setError('Erro ao carregar tenants.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchTenants(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tenants</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tenants.length} igrejas cadastradas</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Novo Tenant
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Igreja</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Plano</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuários</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Criado em</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">
                    Nenhum tenant cadastrado
                  </td>
                </tr>
              )}
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{t.nome}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{t.slug}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge label={PLANO_LABELS[t.plano]} color={PLANO_COLORS[t.plano]} />
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      label={t.ativo ? 'Ativo' : 'Inativo'}
                      color={t.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}
                    />
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{t._count?.users ?? 0}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">
                    {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setUserTarget(t)}
                        className="px-2.5 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg transition font-medium"
                      >
                        + Usuário
                      </button>
                      <button
                        onClick={() => setEditTarget(t)}
                        className="px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition font-medium"
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateTenantModal onClose={() => setShowCreate(false)} onSuccess={fetchTenants} />
      )}
      {editTarget && (
        <EditTenantModal tenant={editTarget} onClose={() => setEditTarget(null)} onSuccess={fetchTenants} />
      )}
      {userTarget && (
        <CreateUserModal tenant={userTarget} onClose={() => setUserTarget(null)} onSuccess={fetchTenants} />
      )}
    </div>
  );
}
