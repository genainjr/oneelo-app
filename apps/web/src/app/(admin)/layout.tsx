'use client';

import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await api.post('/api/auth/logout', {});
    } finally {
      router.push('/admin/login');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-indigo-950 border-b border-indigo-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-lg tracking-tight">OneElo</span>
          <span className="text-indigo-400 text-xs font-medium px-2 py-0.5 bg-indigo-900 rounded-full border border-indigo-700">
            Super Admin
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="text-indigo-300 hover:text-white text-sm transition"
        >
          Sair
        </button>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
