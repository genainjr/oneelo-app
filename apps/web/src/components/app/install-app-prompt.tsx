'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useAuthUser } from '@/contexts/auth-user-context';
import {
  type BeforeInstallPromptEvent,
  detectInstallPlatform,
  isSafariOnIOS,
  isStandaloneMode,
} from '@/lib/pwa-install';
import { TENANT_MANIFEST_REVISION } from '@/lib/pwa-branding';

const DISMISSED_KEY = 'oneelo:pwa-install-dismissed';
const INSTALLED_BRANDING_KEY = 'oneelo:pwa-installed-branding';

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
  const t = useTranslations('settings.pwa');
  const { user } = useAuthUser();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(true);
  const [isStandalone, setIsStandalone] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [needsReinstall, setNeedsReinstall] = useState(false);

  const platform = useMemo(() => detectInstallPlatform(), []);
  const isIOSManualFlow = useMemo(() => isSafariOnIOS(), []);
  const tenantName = user?.tenant?.pwaShortName || user?.tenant?.nome || 'One Elo';
  const tenantIcon = user?.tenant?.pwaIconUrl;
  const dismissedKey = `${DISMISSED_KEY}:${user?.tenantId || 'oneelo'}:${user?.tenant?.pwaUpdatedAt || 'default'}`;
  const brandingVersion = user?.tenant?.pwaUpdatedAt
    ? `${user.tenant.pwaUpdatedAt}:${TENANT_MANIFEST_REVISION}`
    : null;
  const installedBrandingKey = `${INSTALLED_BRANDING_KEY}:${user?.tenantId || 'oneelo'}`;
  const hasCustomBranding = Boolean(
    brandingVersion && user?.tenant?.pwaShortName && user?.tenant?.pwaIconUrl && user?.tenant?.pwaIconKey,
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const standalone = isStandaloneMode();
      setIsDismissed(localStorage.getItem(dismissedKey) === 'true');
      setIsStandalone(standalone);

      if (hasCustomBranding && brandingVersion) {
        if (standalone) {
          setNeedsReinstall(localStorage.getItem(installedBrandingKey) !== brandingVersion);
        } else {
          setNeedsReinstall(false);
          if (isIOSManualFlow) localStorage.setItem(installedBrandingKey, brandingVersion);
        }
      } else {
        setNeedsReinstall(false);
      }
    });

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setIsDismissed(localStorage.getItem(dismissedKey) === 'true');
      setIsStandalone(isStandaloneMode());
    }

    function handleAppInstalled() {
      setDeferredPrompt(null);
      setIsStandalone(true);
      localStorage.setItem(dismissedKey, 'true');
      if (brandingVersion) localStorage.setItem(installedBrandingKey, brandingVersion);
      setNeedsReinstall(false);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [brandingVersion, dismissedKey, hasCustomBranding, installedBrandingKey, isIOSManualFlow]);

  function acknowledgeReinstallNotice() {
    setNeedsReinstall(false);
  }

  if (needsReinstall) {
    const instructions = platform === 'ios'
      ? t('reinstallNoticeIos')
      : platform === 'android'
        ? t('reinstallNoticeAndroid')
        : t('reinstallNoticeDesktop');

    return (
      <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-bold">{t('reinstallNoticeTitle')}</h2>
            <p className="mt-1 text-sm text-amber-900">{t('reinstallNoticeDescription', { name: tenantName })}</p>
            <p className="mt-2 text-sm font-medium text-amber-950">{instructions}</p>
          </div>
          <button type="button" onClick={acknowledgeReinstallNotice} className="shrink-0 self-end rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-900 transition hover:bg-amber-100 sm:self-auto">
            {t('reinstallNoticeAcknowledged')}
          </button>
        </div>
      </section>
    );
  }

  const canShowPrompt = !isStandalone && !isDismissed && (deferredPrompt || isIOSManualFlow);
  if (!canShowPrompt) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        localStorage.setItem(dismissedKey, 'true');
        if (brandingVersion) localStorage.setItem(installedBrandingKey, brandingVersion);
        setIsDismissed(true);
        setNeedsReinstall(false);
      }
      setDeferredPrompt(null);
    } finally {
      setInstalling(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(dismissedKey, 'true');
    setIsDismissed(true);
  }

  const title = isIOSManualFlow ? `Adicionar ${tenantName} à Tela de Início` : `Instalar app ${tenantName}`;
  const description = isIOSManualFlow
    ? 'No iPhone, toque em Compartilhar e escolha "Adicionar à Tela de Início".'
    : platform === 'android'
      ? `Acesse ${tenantName} como app, direto pela tela inicial do celular.`
      : `Instale ${tenantName} para abrir em uma janela própria, com experiência parecida com app.`;

  return (
    <section className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-indigo-950 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-indigo-600 shadow-sm">
            {tenantIcon ? <Image src={tenantIcon} alt="" width={36} height={36} unoptimized className="h-full w-full object-cover" /> : <PhoneIcon />}
          </div>
          <div>
            <h2 className="text-sm font-bold">{title}</h2>
            <p className="mt-0.5 text-sm text-indigo-800">{description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          {!isIOSManualFlow && (
            <button type="button" onClick={handleInstall} disabled={installing} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60">
              {installing ? 'Abrindo...' : 'Instalar'}
            </button>
          )}
          <button type="button" onClick={handleDismiss} className="rounded-lg p-2 text-indigo-500 transition hover:bg-white hover:text-indigo-700" aria-label="Ocultar instalação do app">
            <CloseIcon />
          </button>
        </div>
      </div>
    </section>
  );
}
