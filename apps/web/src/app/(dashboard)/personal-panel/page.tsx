'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { addMonths, format, startOfMonth, endOfMonth } from 'date-fns';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { getMemberDisplayName } from '@/components/app/escala-shared';
import { api } from '@/lib/api';
import { compareCivilDates, formatDate, formatDateWithWeekday, getCivilDateKey, isCivilDateOnOrAfter } from '@/lib/utils';
import { useEventos } from '@/hooks/use-eventos';
import { useMinhasEscalas } from '@/hooks/use-escalas-visualizacao';
import type { AuthUser, Evento, MinhaEscalaItem } from '@/types';

type MinisteriosResumo = {
  ministerios: number;
  membros: number;
  aniversariantes: number;
};

type EscalaResumo = {
  ministerioId: string;
  status: string;
};

function getNextSchedule(items: MinhaEscalaItem[], referenceDate: string) {
  return [...items]
    .filter((item) => isCivilDateOnOrAfter(item.data, referenceDate))
    .sort((a, b) => compareCivilDates(a.data, b.data))[0] ?? null;
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

function MinistriesIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V7a2 2 0 00-2-2H7a2 2 0 00-2 2v14m14 0H5m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 6v-4a1 1 0 011-1h2a1 1 0 011 1v4m-4 0h4" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function BirthdayIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-1.5-.454M9 6l3-3 3 3M9 22V12h6v10" />
    </svg>
  );
}

const QUICK_ACCESS_ICONS = {
  mySchedules: '📝',
  scheduleFolder: '📋',
  agenda: '🗓️',
  profile: '👤',
  ministries: '⛪',
} as const;

export default function PersonalPanelPage() {
  const t = useTranslations('dashboardPersonal');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [today, setToday] = useState('');
  const [ministeriosResumo, setMinisteriosResumo] = useState<MinisteriosResumo | null>(null);
  const [escalasProximoMes, setEscalasProximoMes] = useState<EscalaResumo[]>([]);
  const nextMonthDate = useMemo(() => addMonths(new Date(), 1), []);
  const nextMonthQuery = useMemo(() => ({
    mes: format(nextMonthDate, 'M'),
    ano: format(nextMonthDate, 'yyyy'),
  }), [nextMonthDate]);

  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
  const currentMonth = String(new Date().getMonth() + 1);

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
  const todayDateKey = getCivilDateKey(new Date()) ?? '';

  useEffect(() => {
    setToday(formatDate(new Date()));
    api.get<AuthUser>('/api/auth/me')
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (user?.role !== 'BASIC') {
      setMinisteriosResumo(null);
      setEscalasProximoMes([]);
      return;
    }

    api.get<MinisteriosResumo>('/api/ministerios/resumo')
      .then((data) => setMinisteriosResumo(data ?? null))
      .catch(() => setMinisteriosResumo(null));
  }, [user]);

  useEffect(() => {
    if (user?.role !== 'BASIC') {
      setEscalasProximoMes([]);
      return;
    }

    api.get<EscalaResumo[]>(`/api/escalas?mes=${nextMonthQuery.mes}&ano=${nextMonthQuery.ano}`)
      .then((data) => setEscalasProximoMes(Array.isArray(data) ? data : []))
      .catch(() => setEscalasProximoMes([]));
  }, [nextMonthQuery.ano, nextMonthQuery.mes, user]);

  const futureSchedules = useMemo(() => {
    return minhasEscalas.filter((item) => isCivilDateOnOrAfter(item.data, todayDateKey));
  }, [minhasEscalas, todayDateKey]);

  const nextSchedule = useMemo(() => getNextSchedule(futureSchedules, todayDateKey), [futureSchedules, todayDateKey]);
  const nextScheduleValue = nextSchedule
    ? formatDateWithWeekday(nextSchedule.data, 'dd/MM')
    : t('stats.nextScheduleNone');
  const pendingCount = useMemo(
    () => futureSchedules.filter((item) => (
      item.escala.status === 'PUBLICADA' &&
      item.statusConfirmacao === 'PENDENTE'
    )).length,
    [futureSchedules],
  );
  const futureEvents = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return eventos.filter((event) => new Date(event.dataInicio) >= now);
  }, [eventos]);
  const nextEvent = useMemo(() => getNextEvent(futureEvents), [futureEvents]);
  const nextEventDescription = nextEvent
    ? `${formatDateWithWeekday(nextEvent.dataInicio, 'dd/MM')}\n${nextEvent.titulo}`
    : t('stats.upcomingEventsEmpty');
  const leadershipMinisterios = useMemo(() => {
    const memberships = user?.role === 'BASIC'
      ? (user.membro?.ministerios ?? []).filter(
          (membership) => membership.role === 'LEADER' || membership.role === 'ASSISTANT_LEADER',
        )
      : [];

    return Array.from(
      new Map(
        memberships
          .filter((membership) => membership.ministerio?.id)
          .map((membership) => [membership.ministerio!.id, membership.ministerio!]),
      ).values(),
    );
  }, [user]);

  const hasLeadership = leadershipMinisterios.length > 0;
  const hasEscalas = minhasEscalas.length > 0;
  const nextMonthPendingCount = useMemo(() => {
    if (!hasLeadership) return 0;

    const publishedIds = new Set(
      escalasProximoMes
        .filter((escala) => escala.status === 'PUBLICADA')
        .map((escala) => escala.ministerioId),
    );

    return leadershipMinisterios.filter((ministerio) => !publishedIds.has(ministerio.id)).length;
  }, [escalasProximoMes, hasLeadership, leadershipMinisterios]);
  const leadershipTopCards = hasLeadership ? [
    {
      key: 'leadershipMinistries',
      title: t('leader.stats.ministries'),
      value: ministeriosResumo?.ministerios ?? leadershipMinisterios.length,
      description: t('leader.stats.ministriesDesc'),
      href: '/ministerios',
      color: 'amber' as const,
      icon: <MinistriesIcon />,
    },
    {
      key: 'leadershipMembers',
      title: t('leader.stats.members'),
      value: ministeriosResumo?.membros ?? 0,
      description: t('leader.stats.membersDesc'),
      href: '/membros/visualizacao',
      color: 'indigo' as const,
      icon: <UsersIcon />,
    },
    {
      key: 'leadershipBirthdays',
      title: t('leader.stats.birthdays'),
      value: ministeriosResumo?.aniversariantes ?? 0,
      description: t('leader.stats.birthdaysDesc'),
      href: `/membros/visualizacao?aniversarioMes=${currentMonth}&ordenacao=dataNascimento`,
      color: 'amber' as const,
      icon: <BirthdayIcon />,
    },
    {
      key: 'leadershipPendingSchedules',
      title: t('leader.stats.nextMonthPending'),
      value: nextMonthPendingCount,
      description: t('leader.stats.nextMonthPendingDesc'),
      href: '/escalas',
      color: 'rose' as const,
      icon: <CalendarIcon />,
    },
  ] : [];

  const cards = hasLeadership ? [
    {
      key: 'nextSchedule',
      title: t('stats.nextSchedule'),
      value: nextScheduleValue,
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
      description: nextEventDescription,
      href: '/agenda/visualizacao',
      color: 'emerald' as const,
      icon: <CalendarIcon />,
    },
  ] : hasEscalas ? [
    {
      key: 'nextSchedule',
      title: t('stats.nextSchedule'),
      value: nextScheduleValue,
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
      description: nextEventDescription,
      href: '/agenda/visualizacao',
      color: 'emerald' as const,
      icon: <CalendarIcon />,
    },
  ] : [
    {
      key: 'upcomingEvents',
      title: t('stats.upcomingEvents'),
      value: futureEvents.length,
      description: nextEventDescription,
      href: '/agenda/visualizacao',
      color: 'emerald' as const,
      icon: <CalendarIcon />,
    },
  ];

  const error = errorEscalas || errorEventos;
  const loading = loadingEscalas || loadingEventos;
  const quickAccessItems = hasLeadership
    ? [
        { href: '/ministerios', label: t('leader.quickLinks.ministries'), emoji: QUICK_ACCESS_ICONS.ministries },
        { href: '/escalas', label: t('leader.quickLinks.schedules'), emoji: QUICK_ACCESS_ICONS.scheduleFolder },
        ...(hasEscalas ? [{ href: '/minhas-escalas', label: t('leader.quickLinks.viewSchedules'), emoji: QUICK_ACCESS_ICONS.mySchedules }] : []),
        { href: '/agenda', label: t('leader.quickLinks.agenda'), emoji: QUICK_ACCESS_ICONS.agenda },
        { href: '/meu-perfil', label: t('leader.quickLinks.profile'), emoji: QUICK_ACCESS_ICONS.profile },
      ]
    : [
        ...(hasEscalas ? [{ href: '/minhas-escalas', label: t('quickLinks.viewSchedules'), emoji: QUICK_ACCESS_ICONS.mySchedules }] : []),
        { href: '/agenda/visualizacao', label: t('quickLinks.agenda'), emoji: QUICK_ACCESS_ICONS.agenda },
        { href: '/meu-perfil', label: t('quickLinks.profile'), emoji: QUICK_ACCESS_ICONS.profile },
      ];
  const memberDisplayName = getMemberDisplayName(user?.membro);
  const headerTitle = hasLeadership
    ? `${t('greeting', { name: memberDisplayName ? `, ${memberDisplayName}` : '' })} 👋`
    : hasEscalas
      ? `${t('greeting', { name: memberDisplayName ? `, ${memberDisplayName}` : '' })} 👋`
      : t('noMinistry.greeting', { name: memberDisplayName || user?.nome || '' });
  const headerSubtitle = hasLeadership
    ? t('leader.subtitle', { date: today })
    : hasEscalas
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

      {hasLeadership && (
        <div className="grid gap-4 mb-4 sm:grid-cols-2 lg:grid-cols-4">
          {leadershipTopCards.map((card) => (
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
      )}

      <div className={`grid grid-cols-1 gap-4 mb-8 ${hasLeadership ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
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

      <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-base font-semibold text-gray-800 mb-4">{t('quickAccess')}</h3>
        <div className={`grid grid-cols-1 gap-3 ${hasLeadership ? 'sm:grid-cols-2 lg:grid-cols-5' : hasEscalas ? 'sm:grid-cols-3' : 'md:grid-cols-2'}`}>
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
