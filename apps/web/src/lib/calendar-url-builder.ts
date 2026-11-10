import type { Evento, MinhaEscalaItem } from '../types';

export interface CalendarEventParams {
  uid?: string;
  title: string;
  description?: string;
  location?: string;
  startDate: string | Date;
  endDate?: string | Date | null;
  isAllDay?: boolean;
}

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000; // 2 horas

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Formata um Date em string UTC no padrão Google Calendar / RFC 5545: YYYYMMDDTHHmmssZ
 */
export function formatUtcTimestamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  const hours = pad2(date.getUTCHours());
  const minutes = pad2(date.getUTCMinutes());
  const seconds = pad2(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Extrai a chave civil (YYYY, MM, DD) de uma string ou Date sem sofrer deslocamento
 * para o dia anterior em fusos negativos (ex: UTC-3 quando o banco persiste 00:00:00.000Z).
 */
export function extractCivilYmd(value: string | Date): { year: number; month: number; day: number } {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      };
    }
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const now = new Date();
    return {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      day: now.getUTCDate(),
    };
  }

  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  };
}

/**
 * Detecta se o valor passado representa apenas uma data civil sem horário explícito
 * (ex: '2026-11-15' ou '2026-11-15T00:00:00.000Z').
 */
export function isCivilDateOnly(value: string | Date): boolean {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return true;
    }
    if (/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/i.test(trimmed)) {
      return true;
    }
  }
  return false;
}

/**
 * Resolve o par de datas para Google Calendar e iCalendar:
 * - Quando for evento de dia inteiro (All-Day): retorna YYYYMMDD/YYYYMMDD (com fim no dia seguinte exclusivo).
 * - Quando tiver horário explícito: retorna YYYYMMDDTHHmmssZ/YYYYMMDDTHHmmssZ (com fallback de +2h quando sem fim).
 */
export function resolveCalendarDateRange(params: CalendarEventParams): {
  isAllDay: boolean;
  startFormatted: string;
  endFormatted: string;
  googleDatesParam: string;
} {
  const treatAsAllDay = params.isAllDay ?? isCivilDateOnly(params.startDate);

  if (treatAsAllDay) {
    const startYmd = extractCivilYmd(params.startDate);
    const startUtc = new Date(Date.UTC(startYmd.year, startYmd.month - 1, startYmd.day));

    let endUtc: Date;
    if (params.endDate) {
      const endYmd = extractCivilYmd(params.endDate);
      const candidateEnd = new Date(Date.UTC(endYmd.year, endYmd.month - 1, endYmd.day));
      if (candidateEnd.getTime() > startUtc.getTime()) {
        // No padrão Google/iCalendar, a data final de eventos All-Day é exclusiva (+1 dia após o último dia)
        endUtc = new Date(candidateEnd.getTime() + 24 * 60 * 60 * 1000);
      } else {
        endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
      }
    } else {
      endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
    }

    const startFormatted = `${startUtc.getUTCFullYear()}${pad2(startUtc.getUTCMonth() + 1)}${pad2(startUtc.getUTCDate())}`;
    const endFormatted = `${endUtc.getUTCFullYear()}${pad2(endUtc.getUTCMonth() + 1)}${pad2(endUtc.getUTCDate())}`;

    return {
      isAllDay: true,
      startFormatted,
      endFormatted,
      googleDatesParam: `${startFormatted}/${endFormatted}`,
    };
  }

  const startDateObj = params.startDate instanceof Date ? params.startDate : new Date(params.startDate);
  const safeStart = Number.isNaN(startDateObj.getTime()) ? new Date() : startDateObj;

  let safeEnd: Date;
  if (params.endDate) {
    const endDateObj = params.endDate instanceof Date ? params.endDate : new Date(params.endDate);
    if (!Number.isNaN(endDateObj.getTime()) && endDateObj.getTime() > safeStart.getTime()) {
      safeEnd = endDateObj;
    } else {
      safeEnd = new Date(safeStart.getTime() + DEFAULT_DURATION_MS);
    }
  } else {
    safeEnd = new Date(safeStart.getTime() + DEFAULT_DURATION_MS);
  }

  const startFormatted = formatUtcTimestamp(safeStart);
  const endFormatted = formatUtcTimestamp(safeEnd);

  return {
    isAllDay: false,
    startFormatted,
    endFormatted,
    googleDatesParam: `${startFormatted}/${endFormatted}`,
  };
}

function getAppOrigin(explicitOrigin?: string): string {
  if (explicitOrigin) return explicitOrigin.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return '';
}

/**
 * Mapeia um item de escala do voluntário para CalendarEventParams.
 */
export function mapEscalaToCalendarEvent(
  item: MinhaEscalaItem,
  appOrigin?: string,
): CalendarEventParams {
  const ministerioNome = item.escala?.ministerio?.nome || 'Ministério';
  const eventoTitulo = item.titulo || item.evento?.titulo || 'Escala';
  const funcaoNome = item.funcao?.nome || 'Voluntário';

  const hasTimedEvent = Boolean(item.evento?.dataInicio && !isCivilDateOnly(item.evento.dataInicio));
  const startDate = item.evento?.dataInicio || item.data;
  const endDate = item.evento?.dataFim || null;

  const origin = getAppOrigin(appOrigin);
  const minhasEscalasUrl = origin ? `${origin}/minhas-escalas` : '/minhas-escalas';

  const detailsLines = [
    `Ministério: ${ministerioNome}`,
    `Função: ${funcaoNome}`,
  ];

  if (item.observacoes?.trim()) {
    detailsLines.push(`Observações: ${item.observacoes.trim()}`);
  }

  detailsLines.push(
    '',
    `Gerenciar confirmação e conferir atualizações: ${minhasEscalasUrl}`,
  );

  return {
    uid: `escala-item-${item.id}@oneelo.app`,
    title: `[${ministerioNome}] ${eventoTitulo} - ${funcaoNome}`,
    description: detailsLines.join('\n'),
    location: item.evento?.local?.trim() || undefined,
    startDate,
    endDate,
    isAllDay: !hasTimedEvent,
  };
}

/**
 * Consolida múltiplos itens de escala (ex: voluntário escalado em 2 funções compatíveis no mesmo culto/dia)
 * evitando criar compromissos duplicados no mesmo horário ao exportar em lote (.ics).
 */
export function consolidateEscalasToCalendarEvents(
  items: MinhaEscalaItem[],
  appOrigin?: string,
): CalendarEventParams[] {
  const groups = new Map<string, MinhaEscalaItem[]>();

  for (const item of items) {
    const key = `${item.escalaDiaId || item.data}::${item.escala?.ministerioId || item.escala?.ministerio?.nome || ''}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const events: CalendarEventParams[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      events.push(mapEscalaToCalendarEvent(group[0], appOrigin));
      continue;
    }

    const first = group[0];
    const ministerioNome = first.escala?.ministerio?.nome || 'Ministério';
    const eventoTitulo = first.titulo || first.evento?.titulo || 'Escala';
    const funcoesNomes = Array.from(
      new Set(group.map((g) => g.funcao?.nome || 'Voluntário')),
    ).join(', ');
    const observacoes = Array.from(
      new Set(group.map((g) => g.observacoes?.trim()).filter(Boolean)),
    ).join(' | ');

    const hasTimedEvent = Boolean(first.evento?.dataInicio && !isCivilDateOnly(first.evento.dataInicio));
    const origin = getAppOrigin(appOrigin);
    const minhasEscalasUrl = origin ? `${origin}/minhas-escalas` : '/minhas-escalas';

    const detailsLines = [
      `Ministério: ${ministerioNome}`,
      `Funções: ${funcoesNomes}`,
    ];

    if (observacoes) {
      detailsLines.push(`Observações: ${observacoes}`);
    }

    detailsLines.push(
      '',
      `Gerenciar confirmação e conferir atualizações: ${minhasEscalasUrl}`,
    );

    events.push({
      uid: `escala-dia-${first.escalaDiaId || first.id}-membro-${first.membroId || 'voluntario'}@oneelo.app`,
      title: `[${ministerioNome}] ${eventoTitulo} - ${funcoesNomes}`,
      description: detailsLines.join('\n'),
      location: first.evento?.local?.trim() || undefined,
      startDate: first.evento?.dataInicio || first.data,
      endDate: first.evento?.dataFim || null,
      isAllDay: !hasTimedEvent,
    });
  }

  return events;
}

/**
 * Mapeia um Evento da Agenda da igreja para CalendarEventParams.
 */
export function mapEventoToCalendarEvent(
  evento: Evento,
  appOrigin?: string,
): CalendarEventParams {
  const ministeriosNomes = (evento.ministerios ?? [])
    .map((m) => m.ministerio?.nome?.trim())
    .filter((nome): nome is string => Boolean(nome));

  const titlePrefix =
    evento.tipo !== 'GERAL' && ministeriosNomes.length === 1
      ? `[${ministeriosNomes[0]}] `
      : '';

  const origin = getAppOrigin(appOrigin);
  const agendaUrl = origin ? `${origin}/agenda/visualizacao` : '/agenda/visualizacao';

  const detailsLines: string[] = [];

  if (evento.descricao?.trim()) {
    detailsLines.push(evento.descricao.trim());
  }

  if (ministeriosNomes.length > 0) {
    detailsLines.push(`Ministérios: ${ministeriosNomes.join(', ')}`);
  }

  detailsLines.push(
    '',
    `Confira a programação atualizada em: ${agendaUrl}`,
  );

  return {
    uid: `evento-${evento.id}@oneelo.app`,
    title: `${titlePrefix}${evento.titulo}`,
    description: detailsLines.join('\n'),
    location: evento.local?.trim() || undefined,
    startDate: evento.dataInicio,
    endDate: evento.dataFim || null,
    isAllDay: isCivilDateOnly(evento.dataInicio),
  };
}

/**
 * Gera a URL direta do Google Agenda (action=TEMPLATE).
 */
export function buildGoogleCalendarUrl(params: CalendarEventParams): string {
  const { googleDatesParam } = resolveCalendarDateRange(params);
  const searchParams = new URLSearchParams();
  searchParams.set('action', 'TEMPLATE');
  searchParams.set('text', params.title);
  searchParams.set('dates', googleDatesParam);

  if (params.description?.trim()) {
    searchParams.set('details', params.description.trim());
  }

  if (params.location?.trim()) {
    searchParams.set('location', params.location.trim());
  }

  return `https://calendar.google.com/calendar/render?${searchParams.toString()}`;
}

/**
 * Gera a URL com esquema Android Intent para o Google Agenda nativo.
 * Evita a abertura de Chrome Custom Tabs órfãs (tela branca com botão 'X') em PWAs e navegadores Android.
 */
export function buildAndroidGoogleCalendarIntentUrl(params: CalendarEventParams): string {
  const webUrl = buildGoogleCalendarUrl(params);
  const parsed = new URL(webUrl);
  const pathAndQuery = `${parsed.pathname.replace(/^\//, '')}${parsed.search}`;
  const encodedFallback = encodeURIComponent(webUrl);
  return `intent://${parsed.host}/${pathAndQuery}#Intent;scheme=https;package=com.google.android.calendar;S.browser_fallback_url=${encodedFallback};end`;
}

/**
 * Abre o Google Agenda de forma adaptativa para a plataforma do dispositivo:
 * - No Android: utiliza o Android Intent Scheme na janela atual, despachando direto
 *   ao app nativo do Google Agenda sem abrir uma Chrome Custom Tab intermediária
 *   (eliminando a tela branca com o botão 'X').
 * - No Desktop / iOS / Outros: abre a versão Web em uma nova aba (_blank).
 */
export function openGoogleCalendar(
  params: CalendarEventParams,
  platformOverride?: CalendarPlatform,
): void {
  if (typeof window === 'undefined') return;

  const platform = platformOverride || detectCalendarPlatform();

  if (platform === 'android') {
    const intentUrl = buildAndroidGoogleCalendarIntentUrl(params);
    try {
      window.location.assign(intentUrl);
    } catch {
      window.location.href = intentUrl;
    }
    return;
  }

  const webUrl = buildGoogleCalendarUrl(params);
  window.open(webUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Gera a URL direta do Microsoft Outlook Web (deeplink de criação de evento).
 */
export function buildOutlookCalendarUrl(params: CalendarEventParams): string {
  const { isAllDay } = resolveCalendarDateRange(params);
  const searchParams = new URLSearchParams();
  searchParams.set('path', '/calendar/action/compose');
  searchParams.set('rru', 'addevent');
  searchParams.set('subject', params.title);

  if (isAllDay) {
    const startYmd = extractCivilYmd(params.startDate);
    const startIso = `${startYmd.year}-${pad2(startYmd.month)}-${pad2(startYmd.day)}`;
    searchParams.set('startdt', startIso);

    if (params.endDate) {
      const endYmd = extractCivilYmd(params.endDate);
      const endIso = `${endYmd.year}-${pad2(endYmd.month)}-${pad2(endYmd.day)}`;
      searchParams.set('enddt', endIso);
    } else {
      searchParams.set('enddt', startIso);
    }
    searchParams.set('allday', 'true');
  } else {
    const startDateObj = params.startDate instanceof Date ? params.startDate : new Date(params.startDate);
    const safeStart = Number.isNaN(startDateObj.getTime()) ? new Date() : startDateObj;

    let safeEnd: Date;
    if (params.endDate) {
      const endDateObj = params.endDate instanceof Date ? params.endDate : new Date(params.endDate);
      if (!Number.isNaN(endDateObj.getTime()) && endDateObj.getTime() > safeStart.getTime()) {
        safeEnd = endDateObj;
      } else {
        safeEnd = new Date(safeStart.getTime() + DEFAULT_DURATION_MS);
      }
    } else {
      safeEnd = new Date(safeStart.getTime() + DEFAULT_DURATION_MS);
    }

    searchParams.set('startdt', safeStart.toISOString());
    searchParams.set('enddt', safeEnd.toISOString());
  }

  if (params.description?.trim()) {
    searchParams.set('body', params.description.trim());
  }

  if (params.location?.trim()) {
    searchParams.set('location', params.location.trim());
  }

  return `https://outlook.live.com/calendar/0/deeplink/compose?${searchParams.toString()}`;
}

/**
 * Escapa texto para o formato RFC 5545 (iCalendar .ics).
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Gera conteúdo iCalendar RFC 5545 (.ics) para um ou mais eventos.
 */
export function buildIcsContent(
  events: CalendarEventParams[],
  dtstampDate: Date = new Date(),
): string {
  const dtstamp = formatUtcTimestamp(dtstampDate);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OneElo//Agenda e Escalas//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  events.forEach((event, index) => {
    const { isAllDay, startFormatted, endFormatted } = resolveCalendarDateRange(event);
    const uid = event.uid || `oneelo-event-${index}-${startFormatted}@oneelo.app`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${escapeIcsText(uid)}`);
    lines.push(`DTSTAMP:${dtstamp}`);

    if (isAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${startFormatted}`);
      lines.push(`DTEND;VALUE=DATE:${endFormatted}`);
    } else {
      lines.push(`DTSTART:${startFormatted}`);
      lines.push(`DTEND:${endFormatted}`);
    }

    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);

    if (event.description?.trim()) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description.trim())}`);
    }

    if (event.location?.trim()) {
      lines.push(`LOCATION:${escapeIcsText(event.location.trim())}`);
    }

    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * Detecta o sistema operacional / plataforma do usuário no navegador:
 * - 'apple': iOS (iPhone, iPad) ou macOS
 * - 'windows': Windows Desktop
 * - 'android': Celular / tablet Android
 * - 'other': Linux ou ambiente indeterminado / SSR
 */
export type CalendarPlatform = 'apple' | 'windows' | 'android' | 'other';

export function detectCalendarPlatform(): CalendarPlatform {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'other';
  }

  const ua = navigator.userAgent || '';
  const navAny = navigator as unknown as { userAgentData?: { platform?: string } };
  const platform = navAny.userAgentData?.platform || navigator.platform || '';

  if (/iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(ua) || /Mac/i.test(platform)) {
    return 'apple';
  }

  if (/Win/i.test(platform) || /Windows/i.test(ua)) {
    return 'windows';
  }

  if (/Android/i.test(ua)) {
    return 'android';
  }

  return 'other';
}

/**
 * Dispara o download de um arquivo .ics no navegador/PWA.
 */
export function downloadIcsFile(filename: string, events: CalendarEventParams[]): void {
  if (typeof window === 'undefined' || typeof document === 'undefined' || events.length === 0) {
    return;
  }

  const normalizedFilename = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  const content = buildIcsContent(events);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = normalizedFilename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10000);
}
