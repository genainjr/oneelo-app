'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/app/sidebar';
import { Header } from '@/components/app/header';
import { ChatbotButton } from '@/components/app/chatbot-button';
import { api } from '@/lib/api';
import { AuthUser } from '@/types';
import { AuthUserProvider } from '@/contexts/auth-user-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    api.get<AuthUser>('/api/auth/me', { cache: 'no-store' })
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

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

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>

      <ChatbotButton />
      </div>
    </AuthUserProvider>
  );
}
