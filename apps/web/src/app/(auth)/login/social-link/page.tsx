'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getPostLoginTarget } from '@/lib/auth-redirect';
import type { AuthUser } from '@/types';

interface PendingLink {
  provider: 'GOOGLE' | 'APPLE';
  email: string;
  displayName?: string;
  avatarUrl?: string;
  userId: string;
  userEmail: string;
  userName: string;
  redirectPath: string;
  expiresInMs: number;
}

interface ConfirmLinkResponse {
  user: AuthUser;
  redirectPath: string;
}

function providerLabel(provider: PendingLink['provider']) {
  if (provider === 'GOOGLE') return 'Google';
  if (provider === 'APPLE') return 'Apple';
  return provider;
}

export default function SocialLinkPage() {
  const searchParams = useSearchParams();
  const oauthErrorMessage = searchParams.get('message');
  const oauthErrorProvider = searchParams.get('provider') === 'APPLE' ? 'APPLE' : 'GOOGLE';
  const [pending, setPending] = useState<PendingLink | null>(null);
  const [loading, setLoading] = useState(!oauthErrorMessage);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState(oauthErrorMessage || '');

  useEffect(() => {
    if (oauthErrorMessage) {
      setError(oauthErrorMessage);
      setLoading(false);
      return;
    }

    api.get<PendingLink>('/api/auth/oauth/google/pending-link')
      .then(setPending)
      .catch((err: any) => {
        setError(err?.message || 'Nao foi possivel carregar a confirmacao de vinculo.');
      })
      .finally(() => setLoading(false));
  }, [oauthErrorMessage]);

  async function confirmLink() {
    setError('');
    setConfirming(true);

    try {
      const response = await api.post<ConfirmLinkResponse>('/api/auth/oauth/google/confirm-link');
      window.location.href = getPostLoginTarget(response.user, response.redirectPath);
    } catch (err: any) {
      const label = pending ? providerLabel(pending.provider) : 'o provedor';
      setError(err?.message || `Nao foi possivel confirmar o vinculo com ${label}.`);
      setConfirming(false);
    }
  }

  async function cancelLink() {
    setCancelling(true);

    try {
      await api.post('/api/auth/oauth/google/cancel-link');
    } finally {
      window.location.href = '/login';
    }
  }

  return (
    <div className="w-full max-w-lg px-6">
      <div className="mb-8 text-center">
        <img
          src="/logo.jpg"
          alt="One Elo"
          className="mx-auto mb-4 h-16 w-16 rounded-2xl object-cover shadow-lg shadow-indigo-500/30"
        />
        <h1 className="text-3xl font-bold tracking-tight text-white">One Elo</h1>
        <p className="mt-1 text-sm text-indigo-300">Lookup Labs</p>
      </div>

      <div className="rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-sm">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-6 w-2/3 rounded bg-white/15" />
            <div className="h-20 rounded-xl bg-white/10" />
            <div className="h-10 rounded-xl bg-white/10" />
          </div>
        ) : oauthErrorMessage ? (
          <>
            <h2 className="text-xl font-semibold text-white">Nao foi possivel entrar com {providerLabel(oauthErrorProvider)}</h2>
            <p className="mt-2 text-sm leading-6 text-indigo-100/80">
              A conta escolhida nao pode ser usada para acessar o One Elo neste momento.
            </p>
            {error && (
              <p className="mt-5 rounded-xl border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm font-medium text-red-100">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => { window.location.href = '/login'; }}
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400"
            >
              Voltar para login
            </button>
          </>
        ) : pending ? (
          <>
            <h2 className="text-xl font-semibold text-white">Confirmar login com {providerLabel(pending.provider)}</h2>
            <p className="mt-2 text-sm leading-6 text-indigo-100/80">
              Encontramos um usuario do One Elo com o mesmo e-mail da sua conta {providerLabel(pending.provider)}.
              Confirme abaixo para vincular esta conta e entrar no sistema.
            </p>

            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-200/70">Conta {providerLabel(pending.provider)}</p>
                <div className="mt-3 flex items-center gap-3">
                  {pending.avatarUrl ? (
                    <img
                      src={pending.avatarUrl}
                      alt={pending.displayName || pending.email}
                      className="h-11 w-11 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-bold text-indigo-700">
                      {pending.email.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{pending.displayName || pending.email}</p>
                    <p className="truncate text-xs text-indigo-200/80">{pending.email}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-200/70">Usuario One Elo</p>
                <p className="mt-2 text-sm font-semibold text-white">{pending.userName}</p>
                <p className="text-xs text-indigo-200/80">{pending.userEmail}</p>
              </div>
            </div>

            {error && (
              <p className="mt-5 rounded-xl border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm font-medium text-red-100">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={confirmLink}
                disabled={confirming || cancelling}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {confirming ? 'Confirmando...' : 'Confirmar e entrar'}
              </button>
              <button
                type="button"
                onClick={cancelLink}
                disabled={confirming || cancelling}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancelling ? 'Cancelando...' : 'Cancelar'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-white">Confirmacao indisponivel</h2>
            <p className="mt-2 text-sm leading-6 text-indigo-100/80">
              Nao encontramos uma confirmacao pendente de vinculo. Inicie o login social novamente.
            </p>
            {error && (
              <p className="mt-5 rounded-xl border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm font-medium text-red-100">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => { window.location.href = '/login'; }}
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400"
            >
              Voltar para login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
