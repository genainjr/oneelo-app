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
import {
  readCachedTenantPwa,
  saveCachedTenantPwa,
  syncTenantPwaHead,
} from '@/lib/pwa-branding';

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
    if (user?.tenant) {
      saveCachedTenantPwa(user.tenant);
      syncTenantPwaHead(user.tenant);
      return;
    }

    const cachedTenant = readCachedTenantPwa();
    if (cachedTenant) {
      syncTenantPwaHead(cachedTenant);
      return;
    }

    if (!loadingUser) {
      syncTenantPwaHead(null);
    }
  }, [user?.tenant, loadingUser]);

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
