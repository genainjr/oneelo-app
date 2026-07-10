'use client';

import { useDashboard } from '@/hooks/use-dashboard';
import { StatCard } from '@/components/app/stat-card';
import { PageHeader } from '@/components/app/page-header';
import { api } from '@/lib/api';
import { AuthUser } from '@/types';
import { formatDate } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const { stats, loading, error } = useDashboard();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [today, setToday] = useState('');
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    setToday(formatDate(new Date()));
    api.get<AuthUser>('/api/auth/me')
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const statsConfig = [
    {
      key: 'totalMembrosAtivos' as const,
      title: t('stats.activeMembers'),
      description: t('stats.activeMembersDesc'),
      color: 'indigo' as const,
      href: '/membros/visualizacao',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      key: 'ministeriosAtivos' as const,
      title: t('stats.activeMinistries'),
      description: t('stats.activeMinistriesDesc'),
      color: 'emerald' as const,
      href: '/ministerios/visualizacao',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      key: 'eventosDoMes' as const,
      title: t('stats.monthlyEvents'),
      description: t('stats.monthlyEventsDesc'),
      color: 'blue' as const,
      href: '/agenda/visualizacao',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4m8-4v4M4 10h16M5 6h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1z" />
        </svg>
      ),
    },
    {
      key: 'escalasNaSemana' as const,
      title: t('stats.monthlySchedules'),
      description: t('stats.monthlySchedulesDesc'),
      color: 'blue' as const,
      href: '/escalas/visualizacao',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      key: 'aniversariantesDoMes' as const,
      title: t('stats.birthdays'),
      description: t('stats.birthdaysDesc'),
      color: 'amber' as const,
      href: `/membros/visualizacao?aniversarioMes=${currentMonth}`,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-1.5-.454M9 6l3-3 3 3M9 22V12h6v10" />
        </svg>
      ),
    },
    {
      key: 'pendenciasConfirmacao' as const,
      title: t('stats.pending'),
      description: t('stats.pendingDesc'),
      color: 'rose' as const,
      href: '/escalas/visualizacao?pendentesApenas=true',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={`${t('greeting', { name: user?.nome ? `, ${user.nome.split(' ')[0]}` : '' })} 👋`}
        description={t('subtitle', { date: today })}
      />

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {t('errorLoading')}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statsConfig.map((cfg) => (
          <StatCard
            key={cfg.key}
            title={cfg.title}
            value={stats?.[cfg.key] ?? 0}
            description={cfg.description}
            icon={cfg.icon}
            color={cfg.color}
            loading={loading}
            href={cfg.href}
          />
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-base font-semibold text-gray-800 mb-4">{t('quickAccess')}</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { href: '/membros', label: t('quickLinks.viewMembers'), emoji: '👥' },
            { href: '/escalas', label: t('quickLinks.viewSchedules'), emoji: '📋' },
            { href: '/ministerios', label: t('quickLinks.ministries'), emoji: '⛪' },
            { href: '/agenda', label: t('quickLinks.agenda'), emoji: '🗓️' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 hover:bg-indigo-50 hover:border-indigo-100 border border-transparent transition-all group"
            >
              <span className="text-2xl">{item.emoji}</span>
              <span className="text-xs font-medium text-gray-600 group-hover:text-indigo-700 text-center">
                {item.label}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
