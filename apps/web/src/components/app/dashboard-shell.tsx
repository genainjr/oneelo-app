'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/app/sidebar';
import { Header } from '@/components/app/header';
import { ChatbotButton } from '@/components/app/chatbot-button';
import { InstallAppPrompt } from '@/components/app/install-app-prompt';
import { api } from '@/lib/api';
import type { AuthUser } from '@/types';
import { AuthUserProvider } from '@/contexts/auth-user-context';
import { isOnboardingEnabled } from '@/lib/auth-redirect';

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

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    try {
      setLoadingUser(true);
      const data = await api.get<AuthUser>('/api/auth/me', {
        cache: 'no-store',
      });
      setUser(data);
      return data;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
      setLoadingUser(false);
      return;
    }
    refreshUser();
  }, [initialUser, refreshUser]);

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
