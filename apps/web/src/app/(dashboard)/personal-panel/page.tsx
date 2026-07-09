'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { EmptyState } from '@/components/app/empty-state';
import { getMemberDisplayName } from '@/components/app/escala-shared';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useEventos } from '@/hooks/use-eventos';
import { useMinhasEscalas } from '@/hooks/use-escalas-visualizacao';
import type { AuthUser, Evento, MinhaEscalaItem } from '@/types';

function getNextSchedule(items: MinhaEscalaItem[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return [...items]
    .filter((item) => new Date(item.data) >= today)
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())[0] ?? null;
}

function getNextEvent(events: Evento[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return [...events]
    .filter((event) => new Date(event.dataInicio) >= today)
    .sort((a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime())[0] ?? null;
}

function DashboardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4m8-4v4M4 10h16M5 6h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.944 23.944 0 01-4.014 0M15 18.25a2.25 2.25 0 11-6 0m11.25-5.25a9 9 0 10-18 0c0 5.385 4.243 7.5 4.243 7.5h9.514S21.75 18.385 21.75 13z" />
    </svg>
  );
}

export default function PersonalPanelPage() {
  const t = useTranslations('dashboardPersonal');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [today, setToday] = useState('');

  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const {
    items: minhasEscalas,
    loading: loadingEscalas,
    error: errorEscalas,
  } = useMinhasEscalas();

  const {
    eventos,
    loading: loadingEventos,
    error: errorEventos,
  } = useEventos({ dataInicio: monthStart, dataFim: monthEnd });

  useEffect(() => {
    setToday(formatDate(new Date()));
    api.get<AuthUser>('/api/auth/me')
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const futureSchedules = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return minhasEscalas.filter((item) => new Date(item.data) >= now);
  }, [minhasEscalas]);

  const nextSchedule = useMemo(() => getNextSchedule(futureSchedules), [futureSchedules]);
  const pendingCount = useMemo(
    () => futureSchedules.filter((item) => item.statusConfirmacao === 'PENDENTE').length,
    [futureSchedules],
  );
  const futureEvents = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return eventos.filter((event) => new Date(event.dataInicio) >= now);
  }, [eventos]);
  const nextEvent = useMemo(() => getNextEvent(futureEvents), [futureEvents]);
  const hasMinisterio = (user?.membro?.ministerios?.length ?? 0) > 0;

  const cards = hasMinisterio ? [
    {
      key: 'nextSchedule',
      title: t('stats.nextSchedule'),
      value: nextSchedule ? formatDate(nextSchedule.data, 'dd/MM') : t('stats.nextScheduleNone'),
      description: nextSchedule
        ? `${nextSchedule.escala.ministerio?.nome ?? 'Ministério'} · ${nextSchedule.funcao?.nome ?? 'Função'}`
        : t('stats.nextScheduleEmpty'),
      href: '/minhas-escalas',
      color: 'blue' as const,
      icon: <DashboardIcon />,
    },
    {
      key: 'pending',
      title: t('stats.pending'),
      value: pendingCount,
      description: t('stats.pendingDesc'),
      href: '/minhas-escalas',
      color: 'rose' as const,
      icon: <BellIcon />,
    },
    {
      key: 'upcomingEvents',
      title: t('stats.upcomingEvents'),
      value: futureEvents.length,
      description: nextEvent
        ? `${formatDate(nextEvent.dataInicio, 'dd/MM')} · ${nextEvent.titulo}`
        : t('stats.upcomingEventsEmpty'),
      href: '/agenda/visualizacao',
      color: 'emerald' as const,
      icon: <CalendarIcon />,
    },
  ] : [
    {
      key: 'upcomingEvents',
      title: t('stats.upcomingEvents'),
      value: futureEvents.length,
      description: nextEvent
        ? `${formatDate(nextEvent.dataInicio, 'dd/MM')} · ${nextEvent.titulo}`
        : t('stats.upcomingEventsEmpty'),
      href: '/agenda/visualizacao',
      color: 'emerald' as const,
      icon: <CalendarIcon />,
    },
  ];

  const error = errorEscalas || errorEventos;
  const loading = loadingEscalas || loadingEventos;
  const quickAccessItems = [
    ...(hasMinisterio ? [{ href: '/minhas-escalas', label: t('quickLinks.viewSchedules'), emoji: '📋' }] : []),
    { href: '/agenda/visualizacao', label: t('quickLinks.agenda'), emoji: '🗓️' },
    { href: '/meu-perfil', label: t('quickLinks.profile'), emoji: '👤' },
  ];
  const memberDisplayName = getMemberDisplayName(user?.membro);
  const headerTitle = hasMinisterio
    ? `${t('greeting', { name: memberDisplayName ? `, ${memberDisplayName}` : '' })} 👋`
    : t('noMinistry.greeting', { name: memberDisplayName || user?.nome || '' });
  const headerSubtitle = hasMinisterio
    ? t('subtitle', { date: today })
    : t('noMinistry.subtitle', { date: today });

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={headerTitle}
        description={headerSubtitle}
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
        {cards.map((card) => (
          <StatCard
            key={card.key}
            title={card.title}
            value={card.value}
            description={card.description}
            icon={card.icon}
            color={card.color}
            loading={loading}
            href={card.href}
          />
        ))}
      </div>

      {!hasMinisterio && (
        <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <EmptyState
            title={t('noMinistry.title')}
            description={t('noMinistry.description')}
            action={(
              <Link
                href="/meu-perfil"
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-indigo-700"
              >
                {t('noMinistry.action')}
              </Link>
            )}
          />
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-base font-semibold text-gray-800 mb-4">{t('quickAccess')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickAccessItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 hover:bg-indigo-50 hover:border-indigo-100 border border-transparent transition-all group"
            >
              <span className="text-2xl">{item.emoji}</span>
              <span className="text-xs font-medium text-gray-600 group-hover:text-indigo-700 text-center">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
