'use client';

import { usePathname } from 'next/navigation';
import { PushNotificationButton } from './push-notification-button';
import { useAuthUser } from '@/contexts/auth-user-context';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/personal-panel': 'Painel Pessoal',
  '/membros': 'Gerenciamento Membros',
  '/membros/exportacao': 'Exportação Membros',
  '/membros/visualizacao': 'Visualização Membros',
  '/ministerios': 'Gerenciamento Ministérios',
  '/ministerios/visualizacao': 'Visualização Ministérios',
  '/ministerios/exportacao': 'Exportação Ministérios',
  '/ministerios/infantil': 'Ministério Infantil',
  '/ministerios/louvor': 'Ministério Louvor',
  '/ministerios/midia': 'Ministério Mídia',
  '/escalas': 'Gerenciamento Escalas',
  '/escalas/exportacao': 'Exportação Escalas',
  '/escalas/visualizacao': 'Visualização Escalas',
  '/minhas-escalas': 'Minhas Escalas',
  '/agenda': 'Gerenciamento Agenda',
  '/agenda/exportacao': 'Exportação Agenda',
  '/agenda/visualizacao': 'Visualização Agenda',
  '/financeiro': 'Gerenciamento Financeiro',
  '/financeiro/exportacao': 'Exportação Financeira',
  '/financeiro/visualizacao': 'Visualização Financeira',
  '/grupos': 'Grupos',
  '/integracoes': 'Integrações',
  '/configuracoes': 'Configurações',
  '/meu-perfil': 'Meu Perfil',
  '/onboarding': 'Primeiros Passos',
};

interface HeaderProps {
  onMenuClick: () => void;
}

function fallbackPageTitle(pathname: string) {
  const segment = pathname.split('/').filter(Boolean).at(-1);
  if (!segment) return 'Dashboard';

  return decodeURIComponent(segment)
    .replace(/[-_]+/g, ' ')
    .replace(/^./u, (character) => character.toLocaleUpperCase('pt-BR'));
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const { user } = useAuthUser();

  const title =
    Object.entries(PAGE_TITLES)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([path]) => pathname === path || pathname.startsWith(path + '/'))?.[1] ??
    fallbackPageTitle(pathname);

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
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold leading-tight text-gray-900">{title}</h1>
        {user?.tenant?.nome && (
          <p className="truncate text-[11px] text-gray-500 lg:hidden">{user.tenant.nome}</p>
        )}
      </div>

      <PushNotificationButton />
    </header>
  );
}
