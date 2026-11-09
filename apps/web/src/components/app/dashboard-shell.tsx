'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/app/sidebar';
import { Header } from '@/components/app/header';
import { ChatbotButton } from '@/components/app/chatbot-button';
import { InstallAppPrompt } from '@/components/app/install-app-prompt';
import { api } from '@/lib/api';
import type { AuthUser } from '@/types';
import { AuthUserProvider } from '@/contexts/auth-user-context';
import { isOnboardingEnabled } from '@/lib/auth-redirect';
import { TENANT_MANIFEST_REVISION } from '@/lib/pwa-branding';

export function DashboardShell({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [loadingUser, setLoadingUser] = useState<boolean>(!initialUser);
  const hasLoadedUserRef = useRef<boolean>(Boolean(initialUser));
  const lastUserFetchAtRef = useRef<number>(initialUser ? Date.now() : 0);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    try {
      if (!hasLoadedUserRef.current) {
        setLoadingUser(true);
      }
      lastUserFetchAtRef.current = Date.now();
      const data = await api.get<AuthUser>('/api/auth/me', {
        cache: 'no-store',
      });
      hasLoadedUserRef.current = true;
      setUser(data);
      return data;
    } catch {
      if (!hasLoadedUserRef.current) {
        setUser(null);
      }
      return null;
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    if (initialUser) {
      hasLoadedUserRef.current = true;
      lastUserFetchAtRef.current = Date.now();
      setUser(initialUser);
      setLoadingUser(false);
      return;
    }
    void refreshUser();
  }, [initialUser, refreshUser]);

  // Revalidação silenciosa em background ao retornar o foco à aba (throttle de 60s)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastUserFetchAtRef.current >= 60_000) {
        void refreshUser();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshUser]);

  // Sincronização dinâmica da identidade PWA da igreja no <head> do cliente
  useEffect(() => {
    const tenant = user?.tenant;
    const hasCustomPwa = Boolean(
      tenant?.pwaShortName &&
        tenant.pwaIconUrl &&
        tenant.pwaIconKey &&
        tenant.pwaUpdatedAt,
    );

    if (!tenant || !hasCustomPwa) {
      return;
    }

    const version = encodeURIComponent(
      `${tenant.pwaUpdatedAt!}:${TENANT_MANIFEST_REVISION}`,
    );
    const manifestHref = `/api/pwa/${encodeURIComponent(tenant.slug)}/manifest.webmanifest?v=${version}`;
    const appleIconHref = tenant.pwaIconUrl!.replace(
      /icon-512\.png$/,
      'icon-180.png',
    );

    let manifestLink = document.head.querySelector<HTMLLinkElement>(
      'link[rel="manifest"]',
    );
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    if (manifestLink.getAttribute('href') !== manifestHref) {
      manifestLink.setAttribute('href', manifestHref);
    }

    let appleIconLink = document.head.querySelector<HTMLLinkElement>(
      'link[rel="apple-touch-icon"]',
    );
    if (!appleIconLink) {
      appleIconLink = document.createElement('link');
      appleIconLink.rel = 'apple-touch-icon';
      appleIconLink.sizes = '180x180';
      appleIconLink.type = 'image/png';
      document.head.appendChild(appleIconLink);
    }
    if (appleIconLink.getAttribute('href') !== appleIconHref) {
      appleIconLink.setAttribute('href', appleIconHref);
    }

    let appleTitleMeta = document.head.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]',
    );
    if (!appleTitleMeta) {
      appleTitleMeta = document.createElement('meta');
      appleTitleMeta.name = 'apple-mobile-web-app-title';
      document.head.appendChild(appleTitleMeta);
    }
    if (appleTitleMeta.content !== tenant.pwaShortName!) {
      appleTitleMeta.content = tenant.pwaShortName!;
    }

    let appNameMeta = document.head.querySelector<HTMLMetaElement>(
      'meta[name="application-name"]',
    );
    if (!appNameMeta) {
      appNameMeta = document.createElement('meta');
      appNameMeta.name = 'application-name';
      document.head.appendChild(appNameMeta);
    }
    if (appNameMeta.content !== tenant.pwaShortName!) {
      appNameMeta.content = tenant.pwaShortName!;
    }

    if (tenant.nome && !document.title.includes(tenant.nome)) {
      document.title = `${tenant.nome} | One Elo`;
    }
  }, [user?.tenant]);

  useEffect(() => {
    if (!isOnboardingEnabled() || !user || pathname === '/onboarding') return;
    if (!user.onboardingCompletedAt) router.replace('/onboarding');
  }, [pathname, router, user]);

  return (
    <AuthUserProvider value={{ user, setUser, loadingUser, refreshUser }}>
      <div className="flex h-screen h-[100dvh] overflow-hidden bg-gray-50">
        <Sidebar
          user={user}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main
            data-dashboard-scroll-container
            className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6"
          >
            <InstallAppPrompt />
            {children}
          </main>
        </div>
        <ChatbotButton />
      </div>
    </AuthUserProvider>
  );
}
