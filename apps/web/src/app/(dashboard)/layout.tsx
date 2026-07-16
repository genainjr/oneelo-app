'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/app/sidebar';
import { Header } from '@/components/app/header';
import { ChatbotButton } from '@/components/app/chatbot-button';
import { InstallAppPrompt } from '@/components/app/install-app-prompt';
import { api } from '@/lib/api';
import { AuthUser } from '@/types';
import { AuthUserProvider } from '@/contexts/auth-user-context';
import { isOnboardingEnabled } from '@/lib/auth-redirect';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    api.get<AuthUser>('/api/auth/me', { cache: 'no-store' })
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!isOnboardingEnabled() || !user || pathname === '/onboarding') return;
    if (!user.onboardingCompletedAt) {
      router.replace('/onboarding');
    }
  }, [pathname, router, user]);

  return (
    <AuthUserProvider value={{ user, setUser }}>
      <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Conteúdo principal */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main data-dashboard-scroll-container className="flex-1 overflow-y-auto p-4 md:p-6">
          <InstallAppPrompt />
          {children}
        </main>
      </div>

      <ChatbotButton />
      </div>
    </AuthUserProvider>
  );
}
