'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, HttpError } from '@/lib/api';
import { AuthUser } from '@/types';
import { ROLE_LABEL, getInitials, cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  comingSoon?: boolean;
  children?: NavItem[];
}

const ministeriosSubs: NavItem[] = [
  {
    href: '/ministerios/louvor',
    label: 'Louvor',
    comingSoon: true,
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
  },
  {
    href: '/ministerios/infantil',
    label: 'Infantil',
    comingSoon: true,
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    href: '/ministerios/midia',
    label: 'Mídia',
    comingSoon: true,
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

const navItems: NavItem[] = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/membros',
    label: 'Membros',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/ministerios',
    label: 'Ministérios',
    children: ministeriosSubs,
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    href: '/escalas',
    label: 'Escalas',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/agenda',
    label: 'Agenda',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/integracoes',
    label: 'Integrações',
    comingSoon: true,
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    href: '/configuracoes',
    label: 'Configurações',
    adminOnly: true,
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

interface SidebarProps {
  user: AuthUser | null;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ user, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [ministeriosOpen, setMinisteriosOpen] = useState(true);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/ministerios') return pathname === '/ministerios';
    return pathname.startsWith(href);
  };

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || user?.role === 'ADMIN',
  );

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.post('/api/auth/logout');
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex flex-col bg-indigo-950 transition-all duration-300 lg:translate-x-0 lg:static lg:z-auto overflow-hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* Logo + botão de collapse */}
        <div className={cn(
          'flex items-center border-b border-indigo-900 flex-shrink-0',
          collapsed ? 'justify-center px-0 py-5' : 'gap-3 px-5 py-5',
        )}>
          {!collapsed && (
            <>
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-500 flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-base leading-tight">Lookup</p>
                <p className="text-indigo-400 text-xs">Gestão de Igrejas</p>
              </div>
            </>
          )}

          {collapsed && (
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-500 flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          )}

          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              title="Recolher menu"
              className="flex-shrink-0 p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-900 hover:text-white transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Navegação */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {/* Botão expandir quando collapsed */}
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              title="Expandir menu"
              className="flex items-center justify-center w-full p-2.5 rounded-xl text-indigo-400 hover:bg-indigo-900 hover:text-white transition-all mb-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {visibleItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const active = isActive(item.href);

            if (hasChildren) {
              return (
                <div key={item.href}>
                  {/* Linha do item pai com link + chevron */}
                  <div className="flex items-center gap-1">
                    <Link
                      href={item.href}
                      onClick={onClose}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-xl text-sm font-medium transition-all min-w-0',
                        collapsed ? 'flex-1 justify-center px-0 py-2.5' : 'flex-1 px-3 py-2.5',
                        active
                          ? 'bg-indigo-500 text-white shadow-sm'
                          : 'text-indigo-300 hover:bg-indigo-900 hover:text-white',
                      )}
                    >
                      {item.icon}
                      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    </Link>

                    {/* Chevron: só aparece quando expandido */}
                    {!collapsed && (
                      <button
                        onClick={() => setMinisteriosOpen((v) => !v)}
                        title={ministeriosOpen ? 'Minimizar módulos' : 'Maximizar módulos'}
                        className="flex-shrink-0 p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-900 hover:text-white transition-all"
                      >
                        <svg
                          className={cn('w-3.5 h-3.5 transition-transform duration-200', ministeriosOpen ? 'rotate-180' : '')}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Sub-itens */}
                  {!collapsed && ministeriosOpen && (
                    <div className="mt-0.5 ml-3 pl-3 border-l border-indigo-900 space-y-0.5">
                      {item.children!.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onClose}
                          className={cn(
                            'flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all',
                            isActive(child.href)
                              ? 'bg-indigo-500 text-white shadow-sm'
                              : 'text-indigo-500 hover:bg-indigo-900 hover:text-indigo-300',
                          )}
                        >
                          {child.icon}
                          <span className="flex-1">{child.label}</span>
                          {child.comingSoon && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-900 text-indigo-400 leading-none">
                              Em breve
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-xl text-sm font-medium transition-all',
                  collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
                  active
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : item.comingSoon
                      ? 'text-indigo-500 hover:bg-indigo-900 hover:text-indigo-300'
                      : 'text-indigo-300 hover:bg-indigo-900 hover:text-white',
                )}
              >
                {item.icon}
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.comingSoon && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-900 text-indigo-400 leading-none">
                        Em breve
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Usuário e logout */}
        <div className={cn('p-2 border-t border-indigo-900 flex-shrink-0', collapsed && 'flex flex-col items-center')}>
          {user && !collapsed && (
            <div className="flex items-center gap-3 px-3 py-2 mb-1">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500 text-white text-xs font-semibold flex-shrink-0">
                {getInitials(user.nome)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{user.nome}</p>
                <p className="text-indigo-400 text-xs truncate">{ROLE_LABEL[user.role]}</p>
              </div>
            </div>
          )}

          {user && collapsed && (
            <div
              title={user.nome}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500 text-white text-xs font-semibold mb-2 mt-1"
            >
              {getInitials(user.nome)}
            </div>
          )}

          <button
            id="logout-button"
            onClick={handleLogout}
            disabled={loggingOut}
            title={collapsed ? 'Sair' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-xl text-indigo-300 hover:bg-indigo-900 hover:text-white text-sm transition-all disabled:opacity-60',
              collapsed ? 'justify-center w-10 h-10 p-0' : 'w-full px-3 py-2',
            )}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!collapsed && (loggingOut ? 'Saindo...' : 'Sair')}
          </button>
        </div>
      </aside>
    </>
  );
}
