'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, HttpError } from '@/lib/api';
import { getPostLoginTarget } from '@/lib/auth-redirect';
import { AuthUser } from '@/types';

type ActivationDetails = {
  user: {
    id: string;
    nome: string;
    email: string;
  };
  tenant?: {
    nome: string;
    slug: string;
    logoUrl?: string | null;
  } | null;
  expiresAt: string;
};

type ActivationResponse = {
  user: AuthUser;
};

export default function ActivateAccountPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [details, setDetails] = useState<ActivationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadActivation() {
      setLoading(true);
      setError('');

      try {
        const data = await api.get<ActivationDetails>(`/api/auth/activation/${token}`);
        if (active) setDetails(data);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Este link expirou ou nao e mais valido.');
      } finally {
        if (active) setLoading(false);
      }
    }

    if (token) {
      loadActivation();
    }

    return () => {
      active = false;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (senha.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (senha !== confirmarSenha) {
      setError('A confirmacao nao confere com a senha.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.post<ActivationResponse>(
        `/api/auth/activation/${token}/password`,
        { senha, confirmarSenha },
      );
      window.location.href = getPostLoginTarget(response.user);
    } catch (err) {
      if (err instanceof HttpError) {
        setError(Array.isArray(err.data.message) ? err.data.message.join(' ') : err.data.message);
      } else {
        setError(err instanceof Error ? err.message : 'Nao foi possivel ativar sua conta.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoogleActivation() {
    window.location.href = `/api/auth/oauth/google/start?activationToken=${encodeURIComponent(token)}`;
  }

  const logoUrl = details?.tenant?.logoUrl || '/logo.jpg';

  return (
    <main className="w-full max-w-md px-6">
      <div className="mb-8 text-center">
        <img
          src={logoUrl}
          alt={details?.tenant?.nome || 'One Elo'}
          className="mx-auto mb-4 h-16 w-16 rounded-2xl object-cover shadow-lg shadow-indigo-500/30"
        />
        <h1 className="text-3xl font-bold tracking-tight text-white">Ativar conta</h1>
        <p className="mt-1 text-sm text-indigo-200">
          {details?.tenant?.nome || 'One Elo'}
        </p>
      </div>

      <section className="rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-sm">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-5 rounded bg-white/15" />
            <div className="h-10 rounded-xl bg-white/15" />
            <div className="h-10 rounded-xl bg-white/15" />
          </div>
        ) : details ? (
          <>
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-200">
                Bem-vindo
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">{details.user.nome}</h2>
              <p className="mt-1 text-sm text-indigo-200/80">{details.user.email}</p>
            </div>

            <div className="mb-6 space-y-4">
              <button
                type="button"
                onClick={handleGoogleActivation}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-lg shadow-black/10 transition hover:bg-gray-50"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                    <path fill="#4285F4" d="M21.805 10.023h-9.58v3.955h5.515c-.238 1.27-.96 2.348-2.044 3.066v2.55h3.31c1.937-1.784 3.054-4.414 3.054-7.524 0-.714-.064-1.402-.255-2.047z" />
                    <path fill="#34A853" d="M12.225 22c2.766 0 5.09-.916 6.786-2.486l-3.31-2.55c-.916.615-2.088.98-3.476.98-2.67 0-4.932-1.802-5.74-4.227H3.07v2.63C4.758 19.7 8.224 22 12.225 22z" />
                    <path fill="#FBBC05" d="M6.485 13.717a5.994 5.994 0 0 1 0-3.834v-2.63H3.07a10.004 10.004 0 0 0 0 9.094l3.415-2.63z" />
                    <path fill="#EA4335" d="M12.225 5.856c1.504 0 2.854.517 3.916 1.532l2.934-2.934C17.3 2.8 14.98 1.8 12.225 1.8c-4 0-7.467 2.3-9.155 5.453l3.415 2.63c.808-2.425 3.07-4.027 5.74-4.027z" />
                  </svg>
                </span>
                Continuar com Google
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/15" />
                <span className="text-xs font-semibold uppercase tracking-wide text-indigo-200/70">
                  ou crie uma senha
                </span>
                <div className="h-px flex-1 bg-white/15" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="senha" className="mb-1.5 block text-sm font-medium text-indigo-100">
                  Criar senha
                </label>
                <input
                  id="senha"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-indigo-200/60 outline-none transition focus:border-transparent focus:ring-2 focus:ring-indigo-400"
                  placeholder="Minimo 6 caracteres"
                />
              </div>

              <div>
                <label htmlFor="confirmar-senha" className="mb-1.5 block text-sm font-medium text-indigo-100">
                  Confirmar senha
                </label>
                <input
                  id="confirmar-senha"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirmarSenha}
                  onChange={(event) => setConfirmarSenha(event.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-indigo-200/60 outline-none transition focus:border-transparent focus:ring-2 focus:ring-indigo-400"
                  placeholder="Repita a senha"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-400/30 bg-red-500/20 p-3 text-sm text-red-100">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center rounded-xl bg-indigo-500 px-4 py-2.5 font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Ativando...' : 'Ativar conta'}
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Link indisponivel</h2>
            <p className="text-sm text-indigo-100">
              {error || 'Este link expirou ou nao e mais valido. Solicite um novo link ao administrador.'}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
