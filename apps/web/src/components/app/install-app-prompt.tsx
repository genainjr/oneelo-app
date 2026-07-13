'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  type BeforeInstallPromptEvent,
  detectInstallPlatform,
  isSafariOnIOS,
  isStandaloneMode,
} from '@/lib/pwa-install';

const DISMISSED_KEY = 'oneelo:pwa-install-dismissed';

function PhoneIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5h3M7.5 3.75h9A1.5 1.5 0 0118 5.25v13.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 18.75V5.25a1.5 1.5 0 011.5-1.5zM12 17.25h.008v.008H12v-.008z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(true);
  const [isStandalone, setIsStandalone] = useState(true);
  const [installing, setInstalling] = useState(false);

  const platform = useMemo(() => detectInstallPlatform(), []);
  const isIOSManualFlow = useMemo(() => isSafariOnIOS(), []);

  useEffect(() => {
    setIsDismissed(localStorage.getItem(DISMISSED_KEY) === 'true');
    setIsStandalone(isStandaloneMode());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setIsDismissed(localStorage.getItem(DISMISSED_KEY) === 'true');
      setIsStandalone(isStandaloneMode());
    }

    function handleAppInstalled() {
      setDeferredPrompt(null);
      setIsStandalone(true);
      localStorage.setItem(DISMISSED_KEY, 'true');
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const canShowPrompt = !isStandalone && !isDismissed && (deferredPrompt || isIOSManualFlow);

  if (!canShowPrompt) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;

    setInstalling(true);

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice.outcome === 'accepted') {
        localStorage.setItem(DISMISSED_KEY, 'true');
        setIsDismissed(true);
      }

      setDeferredPrompt(null);
    } finally {
      setInstalling(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setIsDismissed(true);
  }

  const title = isIOSManualFlow ? 'Adicionar o One Elo à tela inicial' : 'Instalar app One Elo';
  const description = isIOSManualFlow
    ? 'No iPhone, toque em Compartilhar e escolha "Adicionar à Tela de Início".'
    : platform === 'android'
      ? 'Acesse o One Elo como app, direto pela tela inicial do celular.'
      : 'Instale o One Elo para abrir em uma janela própria, com experiência parecida com app.';

  return (
    <section className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-indigo-950 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
            <PhoneIcon />
          </div>
          <div>
            <h2 className="text-sm font-bold">{title}</h2>
            <p className="mt-0.5 text-sm text-indigo-800">{description}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          {!isIOSManualFlow && (
            <button
              type="button"
              onClick={handleInstall}
              disabled={installing}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {installing ? 'Abrindo...' : 'Instalar'}
            </button>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg p-2 text-indigo-500 transition hover:bg-white hover:text-indigo-700"
            aria-label="Ocultar instalacao do app"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    </section>
  );
}

