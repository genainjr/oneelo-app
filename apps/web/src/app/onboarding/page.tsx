'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Loader2,
  Smartphone,
  UserRound,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import { api } from '@/lib/api';
import { getPostLoginTarget, isOnboardingEnabled } from '@/lib/auth-redirect';
import {
  type BeforeInstallPromptEvent,
  detectInstallPlatform,
  isSafariOnIOS,
  isStandaloneMode,
} from '@/lib/pwa-install';
import {
  enablePushNotifications,
  getPushStatus,
  type PushSupportStatus,
} from '@/lib/push-notifications';
import type { AuthUser } from '@/types';

type Step = 'install' | 'notifications' | 'profile';
type StepState = 'pending' | 'done' | 'skipped';

const STEPS: { id: Step; label: string; icon: ReactNode }[] = [
  { id: 'install', label: 'App', icon: <Smartphone className="h-4 w-4" /> },
  { id: 'notifications', label: 'Avisos', icon: <Bell className="h-4 w-4" /> },
  { id: 'profile', label: 'Cadastro', icon: <UserRound className="h-4 w-4" /> },
];

const PUSH_BLOCKED_STATUS: PushSupportStatus[] = [
  'unsupported',
  'insecure',
  'missing-key',
  'denied',
];

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [step, setStep] = useState<Step>('install');
  const [stepState, setStepState] = useState<Record<Step, StepState>>({
    install: 'pending',
    notifications: 'pending',
    profile: 'pending',
  });
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushSupportStatus>('unsupported');
  const [pushLoading, setPushLoading] = useState(true);
  const [pushMessage, setPushMessage] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState('');

  const platform = useMemo(() => detectInstallPlatform(), []);
  const iosManualFlow = useMemo(() => isSafariOnIOS(), []);
  const currentStepIndex = STEPS.findIndex((item) => item.id === step);

  useEffect(() => {
    api.get<AuthUser>('/api/auth/me', { cache: 'no-store' })
      .then((currentUser) => {
        if (!isOnboardingEnabled() || currentUser.onboardingCompletedAt) {
          router.replace(getPostLoginTarget(currentUser));
          return;
        }

        setUser(currentUser);
      })
      .catch(() => {
        router.replace('/login?redirect=/onboarding');
      })
      .finally(() => setLoadingUser(false));
  }, [router]);

  useEffect(() => {
    const currentStandalone = isStandaloneMode();
    setStandalone(currentStandalone);

    if (platform === 'ios' && currentStandalone) {
      markStep('install', 'done');
      setStep('notifications');
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setStandalone(isStandaloneMode());
    }

    function handleAppInstalled() {
      setDeferredPrompt(null);
      setStandalone(true);
      markStep('install', 'done');
      goNext('install');
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [platform]);

  useEffect(() => {
    getPushStatus()
      .then((status) => {
        setPushStatus(status);
        if (status === 'enabled') {
          markStep('notifications', 'done');
        }
      })
      .catch(() => setPushStatus('unsupported'))
      .finally(() => setPushLoading(false));
  }, []);

  function markStep(target: Step, state: StepState) {
    setStepState((current) => ({ ...current, [target]: state }));
  }

  function goNext(from: Step = step) {
    const index = STEPS.findIndex((item) => item.id === from);
    const next = STEPS[index + 1]?.id;
    if (next) setStep(next);
  }

  function leaveCompletedInstallStep() {
    markStep('install', 'done');
    goNext('install');
  }

  async function handleInstall() {
    if (standalone) {
      markStep('install', 'done');
      goNext('install');
      return;
    }

    if (!deferredPrompt) return;

    setInstalling(true);

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      const accepted = choice.outcome === 'accepted';
      markStep('install', accepted ? 'done' : 'skipped');
      setDeferredPrompt(null);
      goNext('install');
    } finally {
      setInstalling(false);
    }
  }

  function skipInstall() {
    markStep('install', standalone ? 'done' : 'skipped');
    goNext('install');
  }

  async function handleEnablePush() {
    setPushLoading(true);
    setPushMessage('');

    try {
      await enablePushNotifications();
      setPushStatus('enabled');
      setPushMessage('Notificações ativadas neste dispositivo.');
      markStep('notifications', 'done');
      goNext('notifications');
    } catch (err) {
      setPushMessage(err instanceof Error ? err.message : 'Não foi possível ativar notificações.');
      getPushStatus().then(setPushStatus).catch(() => undefined);
    } finally {
      setPushLoading(false);
    }
  }

  function skipNotifications() {
    markStep('notifications', pushStatus === 'enabled' ? 'done' : 'skipped');
    goNext('notifications');
  }

  async function completeOnboarding(target?: string) {
    setFinishing(true);
    setFinishError('');
    markStep('profile', 'done');

    try {
      const updated = await api.patch<AuthUser>('/api/auth/me/onboarding');
      router.replace(target || getPostLoginTarget(updated));
    } catch (err) {
      setFinishError(err instanceof Error ? err.message : 'Nao foi possivel concluir o onboarding.');
      setFinishing(false);
    }
  }

  const canInstall = standalone || Boolean(deferredPrompt);
  const canEnablePush =
    !pushLoading &&
    (pushStatus === 'default' || pushStatus === 'disabled');
  const iosNeedsInstalledAppForPush = platform === 'ios' && !standalone;
  const pushBlocked = PUSH_BLOCKED_STATUS.includes(pushStatus) || iosNeedsInstalledAppForPush;

  if (loadingUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="flex items-center gap-3 text-sm font-medium text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          Carregando primeiro acesso...
        </div>
      </main>
    );
  }

  if (iosManualFlow && !standalone) {
    return <IOSInstallGuide userName={user?.nome} />;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
        <PageHeader
          title="Configuracao inicial"
          description={`Oi, ${user?.nome || 'usuario'}. Conclua estes passos para preparar seu primeiro acesso.`}
          action={(
            <div className="flex items-center gap-3">
              <StatusBadge
                label={`Passo ${currentStepIndex + 1} de ${STEPS.length}`}
                className="border-indigo-100 bg-indigo-50 px-2.5 py-1 font-bold text-indigo-700"
              />
              <img src="/logo.jpg" alt="One Elo" className="h-9 w-9 rounded-lg object-cover" />
            </div>
          )}
          stackActionsOnMobile
        />

        <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <ol className="grid gap-2 sm:grid-cols-3">
            {STEPS.map((item, index) => {
              const active = item.id === step;
              const done = stepState[item.id] === 'done';
              const skipped = stepState[item.id] === 'skipped';
              const available = index <= currentStepIndex;

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (available) setStep(item.id);
                    }}
                    disabled={!available}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
                      active
                        ? 'border-indigo-100 bg-indigo-50 text-indigo-900'
                        : available
                          ? 'border-gray-100 bg-white text-gray-700 hover:bg-gray-50'
                          : 'border-gray-100 bg-gray-50 text-gray-400'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        done
                          ? 'bg-emerald-100 text-emerald-700'
                          : active
                            ? 'bg-white text-indigo-700'
                            : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {done ? <Check className="h-4 w-4" /> : item.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{item.label}</span>
                      <span className="block truncate text-xs text-gray-500">
                        {done ? 'Concluido' : skipped ? 'Pulou por enquanto' : active ? 'Em andamento' : 'Pendente'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm md:p-6">
            {step === 'install' && (
              <StepContent
                eyebrow="App no celular"
                title={iosManualFlow && !standalone ? 'Adicione o One Elo à Tela de Início' : 'Quer abrir o One Elo como aplicativo?'}
                description={iosManualFlow && !standalone
                  ? 'No iPhone, o próximo passo acontece pelo ícone do app.'
                  : 'Instalar cria um atalho na tela inicial e deixa o acesso mais rápido. Não é obrigatório para continuar.'}
                icon={<Smartphone className="h-7 w-7" />}
              >
                {standalone && (
                  <Notice tone="success">Este dispositivo já está usando o One Elo como app.</Notice>
                )}

                {iosManualFlow && !standalone && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <ol className="grid gap-3 text-sm text-gray-700 sm:grid-cols-3">
                      <li className="rounded-lg bg-white p-3">
                        <span className="block text-xs font-bold uppercase text-indigo-600">1</span>
                        <span className="mt-1 block font-semibold">Compartilhar</span>
                      </li>
                      <li className="rounded-lg bg-white p-3">
                        <span className="block text-xs font-bold uppercase text-indigo-600">2</span>
                        <span className="mt-1 block font-semibold">Adicionar a Tela de Inicio</span>
                      </li>
                      <li className="rounded-lg bg-white p-3">
                        <span className="block text-xs font-bold uppercase text-indigo-600">3</span>
                        <span className="mt-1 block font-semibold">Abrir pelo icone</span>
                      </li>
                    </ol>
                  </div>
                )}

                {!iosManualFlow && !standalone && !deferredPrompt && (
                  <Notice>
                    Não foi possível confirmar a instalação. Se o ícone do One Elo já está na tela inicial, toque em Continuar.
                  </Notice>
                )}

                <ActionRow>
                  {standalone ? (
                    <button
                      type="button"
                      onClick={leaveCompletedInstallStep}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                      Continuar
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : iosManualFlow ? (
                    <Notice>
                      Abra pelo ícone do One Elo para continuar.
                    </Notice>
                  ) : deferredPrompt ? (
                    <button
                      type="button"
                      onClick={handleInstall}
                      disabled={!canInstall || installing}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                    >
                      {installing && <Loader2 className="h-4 w-4 animate-spin" />}
                      Instalar agora
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={skipInstall}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                      Continuar
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                  {!standalone && !iosManualFlow && deferredPrompt && (
                    <button
                      type="button"
                      onClick={skipInstall}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      Continuar sem instalar
                    </button>
                  )}
                </ActionRow>
              </StepContent>
            )}

            {step === 'notifications' && (
              <StepContent
                eyebrow="Avisos importantes"
                title="Deseja receber notificações neste dispositivo?"
                description="O One Elo pode avisar sobre escalas, eventos e lembretes. Você pode ativar agora ou deixar para depois."
                icon={<Bell className="h-7 w-7" />}
              >
                {iosNeedsInstalledAppForPush ? (
                  <Notice>
                    No iPhone, volte ao passo App e abra o One Elo pelo ícone da Tela de Início para liberar notificações.
                  </Notice>
                ) : pushLoading ? (
                  <Notice>Verificando suporte a notificações...</Notice>
                ) : pushStatus === 'enabled' ? (
                  <Notice tone="success">Notificações já estão ativas neste dispositivo.</Notice>
                ) : pushBlocked ? (
                  <Notice>{getPushBlockedMessage(pushStatus)}</Notice>
                ) : (
                  <Notice>Ao clicar em ativar, o navegador vai pedir permissão.</Notice>
                )}

                {pushMessage && <Notice>{pushMessage}</Notice>}

                <ActionRow>
                  {pushStatus === 'enabled' && !pushLoading ? (
                    <button
                      type="button"
                      onClick={() => goNext('notifications')}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                      Continuar
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleEnablePush}
                        disabled={!canEnablePush || pushLoading || iosNeedsInstalledAppForPush}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                      >
                        {pushLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                        Ativar notificações
                      </button>
                      {iosNeedsInstalledAppForPush && (
                        <button
                          type="button"
                          onClick={() => setStep('install')}
                          className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                        >
                          Voltar para instalar app
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={skipNotifications}
                        disabled={pushLoading}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Agora não
                      </button>
                    </>
                  )}
                </ActionRow>
              </StepContent>
            )}

            {step === 'profile' && (
              <StepContent
                eyebrow="Seu cadastro"
                title="Pronto. Agora falta conferir seus dados."
                description="Ao concluir, seu primeiro acesso sera marcado como finalizado. Depois voce pode revisar telefone, foto e dados pessoais em Meu Perfil."
                icon={<UserRound className="h-7 w-7" />}
              >
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-950">{user?.nome}</p>
                  <p className="mt-1 text-sm text-gray-600">{user?.email}</p>
                </div>

                {finishError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {finishError}
                  </p>
                )}

                <ActionRow>
                  <button
                    type="button"
                    onClick={() => completeOnboarding('/meu-perfil')}
                    disabled={finishing}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {finishing && <Loader2 className="h-4 w-4 animate-spin" />}
                    Concluir e revisar perfil
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </ActionRow>
              </StepContent>
            )}

          </section>

          <aside className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800">Resumo</h2>
            <div className="mt-4 space-y-3">
              {STEPS.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
                      {item.icon}
                    </span>
                    <span className="truncate text-sm font-medium text-gray-600">{item.label}</span>
                  </div>
                  <StatusBadge
                    label={stepState[item.id] === 'done' ? 'OK' : stepState[item.id] === 'skipped' ? 'Depois' : 'Pendente'}
                    className={`px-2 py-0.5 font-bold ${
                      stepState[item.id] === 'done'
                        ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                        : stepState[item.id] === 'skipped'
                          ? 'border-amber-100 bg-amber-50 text-amber-700'
                          : 'border-gray-100 bg-gray-50 text-gray-500'
                    }`}
                  />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function StepContent({
  eyebrow,
  title,
  description,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">{eyebrow}</p>
        <h2 className="mt-2 text-xl font-bold leading-tight text-gray-900">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-gray-600">{description}</p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

function Notice({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success';
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm leading-6 ${
        tone === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-gray-200 bg-gray-50 text-gray-600'
      }`}
    >
      {tone === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

function ActionRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row">{children}</div>;
}

function IOSInstallGuide({ userName }: { userName?: string }) {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-3xl p-4 pb-8 md:p-6">
        <PageHeader
          title="Primeiro acesso"
          description={`Olá, ${userName || 'usuário'}. Vamos colocar o One Elo no seu iPhone.`}
          action={(
            <div className="flex items-center gap-3">
              <StatusBadge
                label="Passo 1 de 3"
                className="border-indigo-100 bg-indigo-50 px-2.5 py-1 font-bold text-indigo-700"
              />
              <img src="/logo.jpg" alt="One Elo" className="h-9 w-9 rounded-lg object-cover" />
            </div>
          )}
          stackActionsOnMobile
        />

        <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm md:p-7">
          <div className="mx-auto max-w-2xl">
            <div className="text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Smartphone className="h-7 w-7" />
              </span>
              <h1 className="mt-4 text-xl font-bold text-gray-900">
                Coloque o One Elo na tela inicial
              </h1>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Siga as três imagens abaixo. É rápido.
              </p>
            </div>

            <ol className="mt-7 space-y-6">
              <IOSGuideStep
                number="1"
                title="Toque em Compartilhar"
                description="É o botão com uma seta na parte de baixo do Safari."
              >
                <IOSGuideImage
                  src="/onboarding/ios/step-1-share-crop.png"
                  alt="Barra inferior do Safari com o botão Compartilhar destacado"
                  position="bottom"
                />
              </IOSGuideStep>

              <IOSGuideStep
                number="2"
                title="Toque em Adicionar à Tela de Início"
                description="Role o menu para baixo se essa opção não aparecer de imediato."
              >
                <IOSGuideImage
                  src="/onboarding/ios/step-2-add-home-crop.png"
                  alt="Menu do Safari com a opção Adicionar à Tela de Início destacada"
                  position="center"
                />
              </IOSGuideStep>

              <IOSGuideStep
                number="3"
                title="Toque em Adicionar"
                description="Depois, feche o Safari e abra o One Elo pelo novo ícone."
              >
                <IOSGuideImage
                  src="/onboarding/ios/step-3-confirm-crop.png"
                  alt="Tela de confirmação com o botão Adicionar destacado"
                  position="top"
                />
              </IOSGuideStep>
            </ol>

            <div className="mt-10 flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-4 text-indigo-900">
              <img src="/apple-touch-icon.png" alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
              <div>
                <p className="text-sm font-bold">Para continuar</p>
                <p className="mt-1 text-sm leading-5">
                  Feche o Safari e toque no ícone do One Elo que apareceu na tela inicial.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function IOSGuideStep({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <li>
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          {number}
        </span>
        <div>
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-gray-600">{description}</p>
        </div>
      </div>
      {children}
    </li>
  );
}

function IOSGuideImage({
  src,
  alt,
  position,
}: {
  src: string;
  alt: string;
  position: 'top' | 'center' | 'bottom';
}) {
  if (position !== 'top') {
    return (
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <img
          src={src}
          alt={alt}
          loading="eager"
          decoding="async"
          className="block h-auto w-full"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <img
        src={src}
        alt={alt}
        loading="eager"
        decoding="async"
        className="block h-auto w-full"
      />
    </div>
  );
}

function getPushBlockedMessage(status: PushSupportStatus) {
  if (status === 'denied') {
    return 'As notificacoes foram bloqueadas no navegador. Voce pode alterar isso nas configuracoes do site.';
  }

  if (status === 'insecure') {
    return 'Este dispositivo exige acesso seguro por HTTPS para ativar notificacoes.';
  }

  if (status === 'missing-key') {
    return 'As notificacoes ainda nao estao configuradas no servidor.';
  }

  return 'Este navegador ainda nao suporta notificacoes push neste contexto.';
}
