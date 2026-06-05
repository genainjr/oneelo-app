'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api, HttpError } from '@/lib/api';
import { AuthUser } from '@/types';

interface LoginResponse {
  user: AuthUser;
}

function LoginForm() {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post<LoginResponse>('/api/auth/login', { email, senha });
      window.location.href = redirect;
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 401) {
          setError(t('errorInvalid'));
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
