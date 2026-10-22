import type { Escala, Evento } from '@/types';

export interface WeeklyExportOption {
  page: number;
  weekStart: Date | null;
  weekEnd: Date | null;
  label: string;
  eventCount: number;
}

export type PngWeekSelection = number | 'todas';

const MONTH_LABELS_LOWER = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function startOfUtcWeek(date: Date): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (result.getUTCDay() + 6) % 7;
  result.setUTCDate(result.getUTCDate() - daysSinceMonday);
  return result;
}

export function endOfUtcWeek(weekStart: Date): Date {
  const result = new Date(weekStart);
  result.setUTCDate(result.getUTCDate() + 6);
  return result;
}

export function formatUtcDay(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
  }).format(date);
}

function getMesLabel(escala: Escala): string {
  const mesIndex = (escala.mes || 1) - 1;
  const mesNome = MONTH_LABELS_LOWER[mesIndex] ?? String(escala.mes);
  return `${mesNome[0].toUpperCase()}${mesNome.slice(1)} de ${escala.ano}`;
}

export function buildWeeklyExportOptionsForEscalas(escalas: Escala[]): WeeklyExportOption[] {
  const pagesByWeek = new Map<
    string,
    {
      weekStart: Date | null;
      weekEnd: Date | null;
      events: Array<{ escala: Escala; date: Date }>;
      emptySchedule?: Escala;
    }
  >();

  for (const escala of escalas) {
    for (const dia of escala.dias || []) {
      const date = new Date(dia.data);
      const weekStart = startOfUtcWeek(date);
      const key = `${escala.ano}-${escala.mes}-${weekStart.toISOString().slice(0, 10)}`;
      const page = pagesByWeek.get(key) ?? {
        weekStart,
        weekEnd: endOfUtcWeek(weekStart),
        events: [],
      };
      page.events.push({ escala, date });
      pagesByWeek.set(key, page);
    }
  }

  if (pagesByWeek.size === 0) {
    return escalas.map((escala, index) => ({
      page: index + 1,
      weekStart: null,
      weekEnd: null,
      label: getMesLabel(escala),
      eventCount: 0,
    }));
  }

  const sortedPages = Array.from(pagesByWeek.values())
    .map((page) => ({
      ...page,
      events: page.events.sort((a, b) => a.date.getTime() - b.date.getTime()),
    }))
    .sort((a, b) => {
      const scheduleA = a.events[0]?.escala ?? a.emptySchedule;
      const scheduleB = b.events[0]?.escala ?? b.emptySchedule;
      if (!scheduleA || !scheduleB) {
        return (a.weekStart?.getTime() ?? 0) - (b.weekStart?.getTime() ?? 0);
      }
      const monthOrder = scheduleA.ano - scheduleB.ano || scheduleA.mes - scheduleB.mes;
      return monthOrder || (a.weekStart?.getTime() ?? 0) - (b.weekStart?.getTime() ?? 0);
    });

  return sortedPages.map((page, index) => {
    const pageNumber = index + 1;
    const schedule = page.events[0]?.escala ?? page.emptySchedule;
    if (!page.weekStart || !page.weekEnd || !schedule) {
      return {
        page: pageNumber,
        weekStart: null,
        weekEnd: null,
        label: schedule ? getMesLabel(schedule) : `Semana ${pageNumber}`,
        eventCount: page.events.length,
      };
    }

    const monthStart = new Date(Date.UTC(schedule.ano, schedule.mes - 1, 1));
    const monthEnd = new Date(Date.UTC(schedule.ano, schedule.mes, 0));
    const visibleStart = page.weekStart < monthStart ? monthStart : page.weekStart;
    const visibleEnd = page.weekEnd > monthEnd ? monthEnd : page.weekEnd;
    const startDay = formatUtcDay(visibleStart);
    const endDay = formatUtcDay(visibleEnd);
    const monthLabel = MONTH_LABELS_LOWER[schedule.mes - 1] ?? '';

    return {
      page: pageNumber,
      weekStart: page.weekStart,
      weekEnd: page.weekEnd,
      label: `Semana de ${startDay} a ${endDay} de ${monthLabel}`,
      eventCount: page.events.length,
    };
  });
}

export function buildWeeklyExportOptionsForEventos(eventos: Evento[]): WeeklyExportOption[] {
  const pagesByWeek = new Map<
    string,
    {
      year: number;
      month: number;
      weekStart: Date | null;
      weekEnd: Date | null;
      events: Evento[];
    }
  >();

  for (const evento of eventos) {
    const date = new Date(evento.dataInicio);
    const weekStart = startOfUtcWeek(date);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const key = `${year}-${month}-${weekStart.toISOString().slice(0, 10)}`;
    const page = pagesByWeek.get(key) ?? {
      year,
      month,
      weekStart,
      weekEnd: endOfUtcWeek(weekStart),
      events: [],
    };
    page.events.push(evento);
    pagesByWeek.set(key, page);
  }

  if (pagesByWeek.size === 0) {
    return [
      {
        page: 1,
        weekStart: null,
        weekEnd: null,
        label: 'Semana atual',
        eventCount: 0,
      },
    ];
  }

  const sortedPages = Array.from(pagesByWeek.values())
    .map((page) => ({
      ...page,
      events: page.events.sort(
        (a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime(),
      ),
    }))
    .sort((a, b) => {
      const monthOrder = a.year - b.year || a.month - b.month;
      return monthOrder || (a.weekStart?.getTime() ?? 0) - (b.weekStart?.getTime() ?? 0);
    });

  return sortedPages.map((page, index) => {
    const pageNumber = index + 1;
    if (!page.weekStart || !page.weekEnd || !page.year || !page.month) {
      return {
        page: pageNumber,
        weekStart: null,
        weekEnd: null,
        label: `Semana ${pageNumber}`,
        eventCount: page.events.length,
      };
    }

    const monthStart = new Date(Date.UTC(page.year, page.month - 1, 1));
    const monthEnd = new Date(Date.UTC(page.year, page.month, 0));
    const visibleStart = page.weekStart < monthStart ? monthStart : page.weekStart;
    const visibleEnd = page.weekEnd > monthEnd ? monthEnd : page.weekEnd;
    const startDay = formatUtcDay(visibleStart);
    const endDay = formatUtcDay(visibleEnd);
    const monthLabel = MONTH_LABELS_LOWER[page.month - 1] ?? '';

    return {
      page: pageNumber,
      weekStart: page.weekStart,
      weekEnd: page.weekEnd,
      label: `Semana de ${startDay} a ${endDay} de ${monthLabel}`,
      eventCount: page.events.length,
    };
  });
}

export function getDefaultSelectedWeek(
  options: WeeklyExportOption[],
  referenceDate: Date = new Date(),
): number {
  if (options.length === 0) return 1;
  const todayUtc = new Date(
    Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()),
  );

  const currentWeek = options.find(
    (option) =>
      option.weekStart !== null &&
      option.weekEnd !== null &&
      option.weekStart.getTime() <= todayUtc.getTime() &&
      todayUtc.getTime() <= option.weekEnd.getTime(),
  );
  if (currentWeek) return currentWeek.page;

  const nextWeekWithEvents = options.find(
    (option) =>
      option.weekEnd !== null &&
      option.weekEnd.getTime() >= todayUtc.getTime() &&
      option.eventCount > 0,
  );
  if (nextWeekWithEvents) return nextWeekWithEvents.page;

  return options[0].page;
}
