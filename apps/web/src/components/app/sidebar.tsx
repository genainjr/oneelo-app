'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { api, HttpError } from '@/lib/api';
import { AuthUser } from '@/types';
import { getInitials, cn } from '@/lib/utils';
import { locales, localeLabels, type Locale } from '@/i18n/config';
import { FlagIcon } from '@/components/app/locale-flags';

const ICONS = {
  dashboard: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  members: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  ministries: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  schedules: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  agenda: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  integrations: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  manage: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  export: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  louvor: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  ),
  infantil: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  midia: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  groups: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  ),
  finance: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  ),
  profile: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0" />
    </svg>
  ),
};

function readLocaleCookie(): Locale {
  if (typeof document === 'undefined') return 'pt-BR';
  const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  const val = match?.[1];
  return locales.includes(val as Locale) ? (val as Locale) : 'pt-BR';
}

interface NavChild {
  href: string;
  label: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
  divider?: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
  adminOnly?: boolean;
  staffOnly?: boolean;
  children?: NavChild[];
}

interface SidebarProps {
  user: AuthUser | null;
  isOpen: boolean;
  onClose: () => void;
}

// Roots where isActive must be an exact match (not startsWith)
const EXACT_ROOTS = ['/dashboard', '/membros', '/ministerios', '/escalas', '/agenda', '/minhas-escalas', '/meu-perfil'];

export function Sidebar({ user, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    '/membros': false,
    '/ministerios': false,
    '/escalas': false,
    '/agenda': false,
  });
  const [currentLocale, setCurrentLocale] = useState<Locale>('pt-BR');
  const [localeOpen, setLocaleOpen] = useState(false);
  const [collapsedSectionOpen, setCollapsedSectionOpen] = useState<{
    href: string;
    top: number;
    left: number;
  } | null>(null);
  const [basicHasLeadership, setBasicHasLeadership] = useState(false);
  const localeDropdownRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setCurrentLocale(readLocaleCookie());
  }, []);

  useEffect(() => {
    if (user?.role !== 'BASIC') {
      setBasicHasLeadership(false);
      return;
    }

    api.get<unknown[]>('/api/ministerios')
      .then((data) => setBasicHasLeadership(Array.isArray(data) && data.length > 0))
      .catch(() => setBasicHasLeadership(false));
  }, [user?.role]);

  useEffect(() => {
    if (!localeOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (localeDropdownRef.current && !localeDropdownRef.current.contains(e.target as Node)) {
        setLocaleOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [localeOpen]);

  useEffect(() => {
    if (!collapsedSectionOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setCollapsedSectionOpen(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [collapsedSectionOpen]);

  const isActive = (href: string) => {
    if (EXACT_ROOTS.includes(href)) return pathname === href;
    return pathname.startsWith(href);
  };

  const toggleSection = (href: string) =>
    setOpenSections((prev) => ({ ...prev, [href]: !prev[href] }));

  const navItems: NavItem[] = [
    { href: '/dashboard', label: t('dashboard'), icon: ICONS.dashboard },
    {
      href: '/membros',
      label: t('members'),
      icon: ICONS.members,
      staffOnly: true,
      children: [
        { href: '/membros', label: t('manage'), icon: ICONS.manage },
        { href: '/membros/exportacao', label: t('export'), icon: ICONS.export },
      ],
    },
    {
      href: '/ministerios',
      label: t('ministries'),
      icon: ICONS.ministries,
      children: [
        { href: '/ministerios', label: t('manage'), icon: ICONS.manage },
        { href: '/ministerios/exportacao', label: t('export'), icon: ICONS.export },
        { href: '/ministerios/louvor', label: 'Louvor', comingSoon: true, divider: true, icon: ICONS.louvor },
        { href: '/ministerios/infantil', label: 'Infantil', comingSoon: true, icon: ICONS.infantil },
        { href: '/ministerios/midia', label: 'Mídia', comingSoon: true, icon: ICONS.midia },
      ],
    },
    {
      href: '/escalas',
      label: t('schedules'),
      icon: ICONS.schedules,
      children: [
        { href: '/escalas', label: t('manage'), icon: ICONS.manage },
        { href: '/escalas/exportacao', label: t('export'), icon: ICONS.export },
      ],
    },
    {
      href: '/agenda',
      label: t('agenda'),
      icon: ICONS.agenda,
      children: [
        { href: '/agenda', label: t('manage'), icon: ICONS.manage },
        { href: '/agenda/exportacao', label: t('export'), icon: ICONS.export },
      ],
    },
    { href: '/grupos', label: t('groups'), icon: ICONS.groups, comingSoon: true },
    { href: '/financeiro', label: t('finance'), icon: ICONS.finance, comingSoon: true },
    { href: '/integracoes', label: t('integrations'), icon: ICONS.integrations, comingSoon: true },
    { href: '/meu-perfil', label: 'Meu Perfil', icon: ICONS.profile },
    { href: '/configuracoes', label: t('settings'), icon: ICONS.settings, adminOnly: true },
  ];

  const basicNavItems: NavItem[] = [
    { href: '/minhas-escalas', label: 'Minhas Escalas', icon: ICONS.schedules },
    ...(basicHasLeadership ? [
      {
        href: '/ministerios',
        label: t('ministries'),
        icon: ICONS.ministries,
        children: [
          { href: '/ministerios', label: t('manage'), icon: ICONS.manage },
        ],
      },
      {
        href: '/escalas',
        label: t('schedules'),
        icon: ICONS.schedules,
        children: [
          { href: '/escalas', label: t('manage'), icon: ICONS.manage },
        ],
      },
    ] satisfies NavItem[] : []),
    { href: '/agenda', label: t('agenda'), icon: ICONS.agenda },
    { href: '/meu-perfil', label: 'Meu Perfil', icon: ICONS.profile },
  ];

  const baseItems = user?.role === 'BASIC' ? basicNavItems : navItems;
  const visibleItems = baseItems.filter((item) => {
    if (item.adminOnly && user?.role !== 'ADMIN') return false;
    if (item.staffOnly && user?.role === 'BASIC') return false;
    return true;
  });

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

  async function handleLocaleChange(locale: Locale) {
    await fetch('/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale }),
    });
    setCurrentLocale(locale);
    router.refresh();
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

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex flex-col bg-indigo-950 transition-all duration-300 lg:translate-x-0 lg:static lg:z-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* Logo + collapse button */}
        <div className={cn(
          'flex items-center border-b border-indigo-900 flex-shrink-0',
          collapsed ? 'justify-center px-0 py-5' : 'gap-3 px-5 py-5',
        )}>
          {!collapsed && (
            <>
              <img src="/logo.jpg" alt="One Elo" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-base leading-tight">One Elo</p>
                <p className="text-indigo-400 text-xs">Lookup Labs</p>
              </div>
            </>
          )}

          {collapsed && (
            <img src="/logo.jpg" alt="One Elo" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
          )}

          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              title={t('collapse')}
              className="flex-shrink-0 p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-900 hover:text-white transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav ref={navRef} className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-visible">
          {collapsed && (
            <button
              onClick={() => {
                setCollapsedSectionOpen(null);
                setCollapsed(false);
              }}
              title={t('expand')}
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
            const sectionOpen = openSections[item.href] ?? true;
            const sectionActive = pathname.startsWith(item.href) && item.href !== '/dashboard';

            if (hasChildren) {
              return (
                <div key={item.href}>
                  {!collapsed && (
                    <button
                      onClick={() => toggleSection(item.href)}
                      title={sectionOpen ? t('collapseModules') : t('expandModules')}
                      className={cn(
                        'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                        sectionActive
                          ? 'text-white bg-indigo-900/60'
                          : 'text-indigo-300 hover:bg-indigo-900 hover:text-white',
                      )}
                    >
                      {item.icon}
                      <span className="flex-1 truncate text-left">{item.label}</span>
                      <svg
                        className={cn('w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200', sectionOpen ? 'rotate-180' : '')}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}

                  {collapsed && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setCollapsedSectionOpen((current) =>
                            current?.href === item.href
                              ? null
                              : {
                                  href: item.href,
                                  top: rect.top,
                                  left: rect.right + 8,
                                },
                          );
                        }}
                        title={item.label}
                        className={cn(
                          'flex items-center justify-center w-full px-0 py-2.5 rounded-xl text-sm font-medium transition-all',
                          sectionActive || collapsedSectionOpen?.href === item.href
                            ? 'bg-indigo-500 text-white shadow-sm'
                            : 'text-indigo-300 hover:bg-indigo-900 hover:text-white',
                        )}
                      >
                        {item.icon}
                      </button>

                      {collapsedSectionOpen?.href === item.href && (
                        <div
                          className="fixed z-50 w-56 rounded-xl bg-indigo-900 border border-indigo-800 shadow-xl overflow-hidden"
                          style={{
                            top: collapsedSectionOpen.top,
                            left: collapsedSectionOpen.left,
                            maxHeight: 'calc(100vh - 16px)',
                          }}
                        >
                          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-indigo-300 border-b border-indigo-800">
                            {item.label}
                          </div>
                          <div className="py-1">
                            {item.children!.map((child) => (
                              <div key={child.href}>
                                {child.divider && (
                                  <div className="my-1 border-t border-indigo-800/80" />
                                )}
                                <Link
                                  href={child.href}
                                  onClick={() => {
                                    setCollapsedSectionOpen(null);
                                    onClose();
                                  }}
                                  className={cn(
                                    'flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors',
                                    isActive(child.href)
                                      ? 'bg-indigo-800 text-white'
                                      : 'text-indigo-300 hover:bg-indigo-800 hover:text-white',
                                  )}
                                >
                                  {child.icon}
                                  <span className="flex-1">{child.label}</span>
                                  {child.comingSoon && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-950 text-indigo-400 leading-none">
                                      {t('comingSoon')}
                                    </span>
                                  )}
                                </Link>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!collapsed && sectionOpen && (
                    <div className="mt-0.5 ml-3 pl-3 border-l border-indigo-900 space-y-0.5">
                      {item.children!.map((child) => (
                        <div key={child.href}>
                          {child.divider && (
                            <div className="my-1 border-t border-indigo-900/60" />
                          )}
                          <Link
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
                                {t('comingSoon')}
                              </span>
                            )}
                          </Link>
                        </div>
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
                onClick={() => {
                  setCollapsedSectionOpen(null);
                  onClose();
                }}
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
                        {t('comingSoon')}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Language switcher */}
        <div
          ref={localeDropdownRef}
          className={cn('relative px-2 pb-2 flex-shrink-0', collapsed && 'flex justify-center')}
        >
          {collapsed ? (
            <button
              onClick={() => {
                setCollapsedSectionOpen(null);
                setLocaleOpen((o) => !o);
              }}
              title={localeLabels[currentLocale]}
              className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-indigo-900 transition-all"
            >
              <FlagIcon locale={currentLocale} className="w-6 h-4 rounded-sm" />
            </button>
          ) : (
            <button
              onClick={() => setLocaleOpen((o) => !o)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-indigo-300 hover:bg-indigo-900 hover:text-white text-xs transition-all"
            >
              <FlagIcon locale={currentLocale} className="w-5 h-3.5 rounded-sm flex-shrink-0" />
              <span className="flex-1 text-left truncate">{localeLabels[currentLocale]}</span>
              <svg
                className={cn('w-3.5 h-3.5 flex-shrink-0 transition-transform', localeOpen && 'rotate-180')}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}

          {localeOpen && (
            <div className={cn(
              'absolute z-50 rounded-xl bg-indigo-900 border border-indigo-800 shadow-xl overflow-hidden',
              collapsed
                ? 'bottom-0 left-full ml-2 w-52'
                : 'bottom-full left-0 right-0 mb-1',
            )}>
              {locales.map((locale) => (
                <button
                  key={locale}
                  onClick={() => { handleLocaleChange(locale); setLocaleOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors',
                    locale === currentLocale
                      ? 'bg-indigo-800 text-white'
                      : 'text-indigo-300 hover:bg-indigo-800 hover:text-white',
                  )}
                >
                  <FlagIcon locale={locale} className="w-5 h-3.5 rounded-sm flex-shrink-0" />
                  <span className="flex-1 text-left">{localeLabels[locale]}</span>
                  {locale === currentLocale && (
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User info + logout */}
        <div className={cn('p-2 border-t border-indigo-900 flex-shrink-0', collapsed && 'flex flex-col items-center')}>
          {user && !collapsed && (
            <div className="flex items-center gap-3 px-3 py-2 mb-1">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500 text-white text-xs font-semibold flex-shrink-0">
                {getInitials(user.nome)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{user.nome}</p>
                <p className="text-indigo-400 text-xs truncate">{tCommon(`roles.${user.role}` as any)}</p>
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
            title={collapsed ? t('logout') : undefined}
            className={cn(
              'flex items-center gap-2 rounded-xl text-indigo-300 hover:bg-indigo-900 hover:text-white text-sm transition-all disabled:opacity-60',
              collapsed ? 'justify-center w-10 h-10 p-0' : 'w-full px-3 py-2',
            )}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!collapsed && (loggingOut ? t('loggingOut') : t('logout'))}
          </button>
        </div>
      </aside>
    </>
  );
}
