'use client';

import { useState, FormEvent, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Eye, EyeOff, Loader2, LogIn, UserPlus } from 'lucide-react';
import { api, HttpError } from '@/lib/api';
import { getPostLoginTarget, isSafeAppRedirect } from '@/lib/auth-redirect';
import { saveCachedTenantPwa } from '@/lib/pwa-branding';
import { AuthUser } from '@/types';
import { InternationalPhoneInput } from '@/components/app/international-phone-input';
import { ChurchBrandMark } from '@/components/public-site/church-brand-mark';
import type { PublicTenantInfo } from '@/components/public-site/join/tenant-public';

interface LoginResponse {
  user: AuthUser;
}

type LoginMode = 'email' | 'phone';

interface LoginClientProps {
  initialChurch?: PublicTenantInfo | null;
  churchSlug?: string | null;
}

function LoginForm({ initialChurch = null, churchSlug = null }: LoginClientProps) {
  const t = useTranslations('auth.login');
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const isChurchBranded = Boolean(initialChurch);

  const [loginMode, setLoginMode] = useState<LoginMode>('email');
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post<LoginResponse>('/api/auth/login', {
        identificador,
        senha,
      });
      saveCachedTenantPwa(response.user?.tenant);
      const target = getPostLoginTarget(response.user, redirect);
      window.location.href = target;
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 403 && err.data.code === 'ACCOUNT_PENDING_ACTIVATION') {
          setError(
            typeof err.data.message === 'string'
              ? err.data.message
              : 'Sua conta ainda não foi ativada. Acesse o link de ativação enviado para você ou solicite um novo link ao administrador.',
          );
        } else if (err.status === 403 && err.data.code === 'ACCOUNT_DISABLED') {
          setError(
            typeof err.data.message === 'string'
              ? err.data.message
              : 'Sua conta está desativada. Entre em contato com o administrador para solicitar a reativação.',
          );
        } else if (err.status === 401) {
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

  function handleLoginModeChange(mode: LoginMode) {
    setLoginMode(mode);
    setIdentificador('');
    setError('');
  }

  const resolvedSlug = initialChurch?.slug || churchSlug;
  const siteHomeHref = resolvedSlug ? `/${resolvedSlug}` : '/';
  const siteJoinHref = resolvedSlug ? `/${resolvedSlug}/cadastro` : null;

  const formContent = (
    <div className="w-full max-w-md px-4 sm:px-0">
      {isChurchBranded && resolvedSlug && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
          <Link
            href={siteHomeHref}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/90 px-3.5 py-1.5 text-zinc-300 transition hover:border-amber-400/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-[var(--site-accent)]" aria-hidden="true" />
            <span>Voltar para o site</span>
          </Link>

          {siteJoinHref && (
            <Link
              href={siteJoinHref}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/90 px-3.5 py-1.5 text-zinc-300 transition hover:border-amber-400/50 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <UserPlus className="h-3.5 w-3.5 text-[var(--site-accent)]" aria-hidden="true" />
              <span>Cadastre-se</span>
            </Link>
          )}
        </div>
      )}

      {/* Logo e título */}
      <div className="mb-8 text-center">
        {isChurchBranded && initialChurch ? (
          <>
            <div className="mb-4 flex justify-center">
              <ChurchBrandMark
                logoUrl={initialChurch.logoUrl}
                churchName={initialChurch.nome}
                size="lg"
              />
            </div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--site-accent)]">
              Área de Membros
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl [text-wrap:balance]">
              {initialChurch.nome}
            </h1>
          </>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.jpg"
              alt="One Elo"
              className="mx-auto mb-4 h-16 w-16 rounded-2xl object-cover shadow-lg shadow-indigo-500/30"
            />
            <h1 className="text-3xl font-bold tracking-tight text-white">{t('brand')}</h1>
            <p className="mt-1 text-sm text-indigo-300">{t('company')}</p>
          </>
        )}
      </div>

      {/* Card do formulário */}
      <div
        className={
          isChurchBranded
            ? 'rounded-3xl border border-zinc-800 bg-[#121216] p-7 shadow-2xl sm:p-8'
            : 'rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-sm'
        }
      >
        <h2 className="mb-6 text-xl font-semibold text-white">{t('heading')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4" id="login-form">
          <div
            role="group"
            aria-label={t('loginMethod')}
            className={
              isChurchBranded
                ? 'grid grid-cols-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-1'
                : 'grid grid-cols-2 rounded-xl border border-white/15 bg-white/5 p-1'
            }
          >
            {(['email', 'phone'] as LoginMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={loginMode === mode}
                onClick={() => handleLoginModeChange(mode)}
                className={
                  isChurchBranded
                    ? `min-h-10 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        loginMode === mode
                          ? 'bg-[var(--site-accent)] text-[var(--site-accent-foreground)] shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`
                    : `min-h-10 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        loginMode === mode
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-indigo-200 hover:bg-white/10 hover:text-white'
                      }`
                }
              >
                {t(mode)}
              </button>
            ))}
          </div>

          {loginMode === 'email' ? (
            <div>
              <label
                htmlFor="identificador"
                className={
                  isChurchBranded
                    ? 'mb-1.5 block text-sm font-medium text-zinc-300'
                    : 'mb-1.5 block text-sm font-medium text-indigo-200'
                }
              >
                {t('email')}
              </label>
              <input
                id="identificador"
                name="email"
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="email"
                required
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder={t('emailPlaceholder')}
                className={
                  isChurchBranded
                    ? 'w-full rounded-xl border border-zinc-800 bg-zinc-900/90 px-4 py-2.5 text-white placeholder-zinc-500 transition focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30'
                    : 'w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-indigo-300/60 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-400'
                }
              />
            </div>
          ) : (
            <InternationalPhoneInput
              id="identificador"
              label={t('phone')}
              countryLabel={t('country')}
              value={identificador}
              onChange={setIdentificador}
              required
              variant={isChurchBranded ? 'site-dark' : 'auth'}
            />
          )}

          {/* Senha */}
          <div>
            <label
              htmlFor="senha"
              className={
                isChurchBranded
                  ? 'mb-1.5 block text-sm font-medium text-zinc-300'
                  : 'mb-1.5 block text-sm font-medium text-indigo-200'
              }
            >
              {t('password')}
            </label>
            <div className="relative">
              <input
                id="senha"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={t('passwordPlaceholder')}
                className={
                  isChurchBranded
                    ? 'w-full rounded-xl border border-zinc-800 bg-zinc-900/90 py-2.5 pl-4 pr-11 text-white placeholder-zinc-500 transition focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30'
                    : 'w-full rounded-xl border border-white/20 bg-white/10 py-2.5 pl-4 pr-11 text-white placeholder-indigo-300/60 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-400'
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword}
                className={
                  isChurchBranded
                    ? 'absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-amber-400'
                    : 'absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-indigo-200/80 transition hover:text-white focus-visible:outline-2 focus-visible:outline-white'
                }
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/20 p-3 text-sm text-red-200">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Botão */}
          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className={
              isChurchBranded
                ? 'mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--site-accent)] px-5 py-2.5 text-sm font-bold text-[var(--site-accent-foreground)] shadow-lg shadow-amber-500/15 transition hover:bg-[var(--site-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60'
                : 'mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60'
            }
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>{t('submitting')}</span>
              </>
            ) : (
              <>
                {isChurchBranded && <LogIn className="h-4 w-4" aria-hidden="true" />}
                <span>{t('submit')}</span>
              </>
            )}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className={isChurchBranded ? 'h-px flex-1 bg-zinc-800' : 'h-px flex-1 bg-white/15'} />
          <span
            className={
              isChurchBranded
                ? 'text-xs font-semibold uppercase tracking-wide text-zinc-500'
                : 'text-xs font-semibold uppercase tracking-wide text-indigo-200/70'
            }
          >
            {t('or')}
          </span>
          <div className={isChurchBranded ? 'h-px flex-1 bg-zinc-800' : 'h-px flex-1 bg-white/15'} />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className={
            isChurchBranded
              ? 'flex min-h-11 w-full items-center justify-center gap-3 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:border-amber-400/60 hover:bg-zinc-800'
              : 'flex min-h-11 w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-lg shadow-black/10 transition hover:bg-gray-50'
          }
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path fill="#4285F4" d="M21.805 10.023h-9.58v3.955h5.515c-.238 1.27-.96 2.348-2.044 3.066v2.55h3.31c1.937-1.784 3.054-4.414 3.054-7.524 0-.714-.064-1.402-.255-2.047z" />
              <path fill="#34A853" d="M12.225 22c2.766 0 5.09-.916 6.786-2.486l-3.31-2.55c-.916.615-2.088.98-3.476.98-2.67 0-4.932-1.802-5.74-4.227H3.07v2.63C4.758 19.7 8.224 22 12.225 22z" />
              <path fill="#FBBC05" d="M6.485 13.717a5.994 5.994 0 0 1 0-3.834v-2.63H3.07a10.004 10.004 0 0 0 0 9.094l3.415-2.63z" />
              <path fill="#EA4335" d="M12.225 5.856c1.504 0 2.854.517 3.916 1.532l2.934-2.934C17.3 2.8 14.98 1.8 12.225 1.8c-4 0-7.467 2.3-9.155 5.453l3.415 2.63c.808-2.425 3.07-4.027 5.74-4.027z" />
            </svg>
          </span>
          <span>{t('googleSubmit')}</span>
        </button>

        {isChurchBranded && siteJoinHref && (
          <p className="mt-5 text-center text-xs text-zinc-400">
            Ainda não faz parte?{' '}
            <Link
              href={siteJoinHref}
              className="font-semibold text-[var(--site-accent)] underline-offset-4 hover:underline"
            >
              Preencher cadastro
            </Link>
          </p>
        )}
      </div>

      {isChurchBranded ? (
        <p className="mt-6 text-center text-xs text-zinc-500">
          Tecnologia <span className="font-semibold text-zinc-300">One Elo</span>
        </p>
      ) : (
        <p className="mt-6 text-center text-xs text-indigo-400/60">
          {t('copyright', { year: new Date().getFullYear() })}
        </p>
      )}
    </div>
  );

  if (isChurchBranded) {
    return (
      <div className="public-site-root relative flex min-h-screen w-full items-center justify-center overflow-x-clip bg-zinc-950 px-4 py-10 text-zinc-100">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl"
        />
        <div className="relative z-10 flex w-full justify-center">{formContent}</div>
      </div>
    );
  }

  return <div className="px-4 py-8 w-full flex justify-center">{formContent}</div>;
}

export function LoginClient(props: LoginClientProps) {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md animate-pulse px-6">
          <div className="h-64 rounded-2xl bg-white/10" />
        </div>
      }
    >
      <LoginForm {...props} />
    </Suspense>
  );
}
