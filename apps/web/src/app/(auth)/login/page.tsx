'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api, HttpError } from '@/lib/api';
import { getPostLoginTarget, isSafeAppRedirect } from '@/lib/auth-redirect';
import { AuthUser } from '@/types';

interface LoginResponse {
  user: AuthUser;
}

function LoginForm() {
  const t = useTranslations('auth.login');
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post<LoginResponse>('/api/auth/login', { email, senha });
      const target = getPostLoginTarget(response.user, redirect);
      window.location.href = target;
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 401) {
          setError(t('errorInvalid'));
        } else if (err.status === 429) {
          setError(t('errorRateLimit'));
        } else {
          setError(t('errorServer'));
        }
      } else {
        setError(t('errorConnection'));
      }
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    const safeRedirect = isSafeAppRedirect(redirect) && redirect ? redirect : '/dashboard';
    window.location.href = `/api/auth/oauth/google/start?redirect=${encodeURIComponent(safeRedirect)}`;
  }

  return (
    <div className="w-full max-w-md px-6">
      {/* Logo e título */}
      <div className="text-center mb-8">
        <img
          src="/logo.jpg"
          alt="One Elo"
          className="w-16 h-16 rounded-2xl object-cover mb-4 shadow-lg shadow-indigo-500/30"
        />
        <h1 className="text-3xl font-bold text-white tracking-tight">{t('brand')}</h1>
        <p className="text-indigo-300 mt-1 text-sm">{t('company')}</p>
      </div>

      {/* Card do formulário */}
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 shadow-2xl">
        <h2 className="text-xl font-semibold text-white mb-6">{t('heading')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4" id="login-form">
          {/* E-mail */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-indigo-200 mb-1.5">
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
          </div>

          {/* Senha */}
          <div>
            <label htmlFor="senha" className="block text-sm font-medium text-indigo-200 mb-1.5">
              {t('password')}
            </label>
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
          </div>

          {/* Erro */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/20 border border-red-400/30 text-red-200 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {error}
            </div>
          )}

          {/* Botão */}
          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 mt-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('submitting')}
              </>
            ) : (
              t('submit')
            )}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/15" />
          <span className="text-xs font-semibold uppercase tracking-wide text-indigo-200/70">
            {t('or')}
          </span>
          <div className="h-px flex-1 bg-white/15" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
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
          {t('googleSubmit')}
        </button>
      </div>

      <p className="text-center text-indigo-400/60 text-xs mt-6">
        {t('copyright', { year: new Date().getFullYear() })}
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-md px-6 animate-pulse">
        <div className="h-64 bg-white/10 rounded-2xl" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
