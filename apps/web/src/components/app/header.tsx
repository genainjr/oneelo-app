'use client';

import { usePathname } from 'next/navigation';
import { PushNotificationButton } from './push-notification-button';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/membros': 'Membros',
  '/ministerios': 'Ministérios',
  '/ministerios/visualizacao': 'Visualização de Ministérios',
  '/escalas': 'Escalas',
  '/agenda': 'Agenda',
  '/agenda/visualizacao': 'Visualização de Agenda',
  '/configuracoes': 'Configurações',
};

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();

  const title =
    Object.entries(PAGE_TITLES)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([path]) => pathname === path || pathname.startsWith(path + '/'))?.[1] ??
    'One Elo';

  return (
    <header className="sticky top-0 z-10 flex items-center gap-4 h-14 px-4 md:px-6 bg-white border-b border-gray-200">
      {/* Hamburguer (mobile) */}
      <button
        id="sidebar-toggle"
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition"
        aria-label="Abrir menu"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Título */}
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-gray-900">{title}</h1>

      <PushNotificationButton />
    </header>
  );
}
