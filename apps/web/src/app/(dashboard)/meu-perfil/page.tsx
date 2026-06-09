'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { api } from '@/lib/api';
import { formatDate, formatPhone, MINISTRY_ROLE_LABEL, ROLE_LABEL, STATUS_MEMBRO_COLOR, STATUS_MEMBRO_LABEL } from '@/lib/utils';
import { AuthUser } from '@/types';

export default function MeuPerfilPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<AuthUser>('/api/auth/me')
      .then(setUser)
      .catch(() => setError('Nao foi possivel carregar seu perfil.'))
      .finally(() => setLoading(false));
  }, []);

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
