'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { api } from '@/lib/api';
import { formatDate, formatPhone, MINISTRY_ROLE_LABEL, ROLE_LABEL, STATUS_MEMBRO_COLOR, STATUS_MEMBRO_LABEL } from '@/lib/utils';
import { AuthUser } from '@/types';

export default function MeuPerfilPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    api.get<AuthUser>('/api/auth/me')
      .then(setUser)
      .catch(() => setError('Nao foi possivel carregar seu perfil.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!senhaAtual.trim() || !novaSenha.trim() || !confirmarSenha.trim()) {
      setPasswordError('Preencha todos os campos de senha.');
      return;
    }

    if (novaSenha.length < 6) {
      setPasswordError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setPasswordError('A confirmacao nao confere com a nova senha.');
      return;
    }

    setPasswordLoading(true);
    try {
      await api.patch('/api/auth/me/password', { senhaAtual, novaSenha });
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
      setPasswordSuccess('Senha alterada com sucesso.');
    } catch (err: any) {
      setPasswordError(err?.message || 'Nao foi possivel alterar a senha.');
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Meu Perfil"
        description="Consulte seus dados de acesso, cadastro e participacao em ministerios."
      />

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-40 rounded-2xl bg-gray-100" />
          <div className="h-40 rounded-2xl bg-gray-100" />
        </div>
      ) : error ? (
        <EmptyState title="Erro ao carregar perfil" description={error} />
      ) : user ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-lg font-bold text-indigo-700">
                {user.nome.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{user.nome}</h2>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Info label="Perfil de acesso" value={ROLE_LABEL[user.role]} />
              <Info label="Igreja" value={user.tenant?.nome || '-'} />
              <Info label="Plano" value={user.tenant?.plano || '-'} />
              <Info label="Criado em" value={formatDate(user.createdAt, 'dd/MM/yyyy')} />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-gray-900">Seguranca</h2>
              <p className="text-sm text-gray-500">Altere sua senha de acesso informando a senha atual.</p>
            </div>

            <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <PasswordField
                  id="senha-atual"
                  label="Senha atual"
                  value={senhaAtual}
                  autoComplete="current-password"
                  onChange={setSenhaAtual}
                />
                <PasswordField
                  id="nova-senha"
                  label="Nova senha"
                  value={novaSenha}
                  autoComplete="new-password"
                  onChange={setNovaSenha}
                />
                <PasswordField
                  id="confirmar-senha"
                  label="Confirmar nova senha"
                  value={confirmarSenha}
                  autoComplete="new-password"
                  onChange={setConfirmarSenha}
                />
              </div>

              {passwordError && (
                <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {passwordError}
                </p>
              )}
              {passwordSuccess && (
                <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  {passwordSuccess}
                </p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {passwordLoading ? 'Salvando...' : 'Alterar senha'}
                </button>
              </div>
            </form>
          </section>

          {user.membro ? (
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Cadastro de membro</h2>
                  <p className="text-sm text-gray-500">Dados vinculados ao seu usuario.</p>
                </div>
                <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${STATUS_MEMBRO_COLOR[user.membro.status]}`}>
                  {STATUS_MEMBRO_LABEL[user.membro.status]}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Info label="Nome" value={user.membro.nome} />
                <Info label="E-mail" value={user.membro.email || '-'} />
                <Info label="WhatsApp" value={formatPhone(user.membro.whatsapp)} />
                <Info label="Nascimento" value={formatDate(user.membro.dataNascimento, 'dd/MM/yyyy')} />
              </div>

              <div className="mt-5">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Ministerios</h3>
                {user.membro.ministerios?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {user.membro.ministerios.map((item) => (
                      <span key={item.ministerio.id} className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
                        {item.ministerio.nome} - {MINISTRY_ROLE_LABEL[item.role] || item.role}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Nenhum ministerio vinculado.</p>
                )}
              </div>
            </section>
          ) : (
            <EmptyState title="Sem membro vinculado" description="Seu usuario ainda nao esta vinculado a um cadastro de membro." />
          )}
        </div>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  autoComplete,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  autoComplete: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </label>
      <input
        id={id}
        type="password"
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}
