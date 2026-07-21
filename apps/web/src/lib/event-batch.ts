export const EVENT_BATCH_MAX_DAYS = 366;
export const EVENT_BATCH_MAX_OCCURRENCES = 200;
export const EVENT_TIME_ZONE = 'America/Sao_Paulo';

export type WeeklyEventDay = {
  weekday: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
};

export type GeneratedEventOccurrence = {
  dataInicio: string;
  dataFim?: string;
  dateKey: string;
  weekday: number;
};

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) return null;
  return date;
}

function getTimeZoneParts(date: Date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: EVENT_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
}

export function zonedDateTimeToIso(dateKey: string, time: string) {
  const date = parseDateKey(dateKey);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!date || !timeMatch) throw new Error('Data ou horário inválido.');
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const targetAsUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hour,
    minute,
  );
  const initialParts = getTimeZoneParts(new Date(targetAsUtc));
  const representedAsUtc = Date.UTC(
    initialParts.year,
    initialParts.month - 1,
    initialParts.day,
    initialParts.hour,
    initialParts.minute,
    initialParts.second,
  );
  const offset = representedAsUtc - targetAsUtc;
  return new Date(targetAsUtc - offset).toISOString();
}

export function generateWeeklyOccurrences(
  startDate: string,
  endDate: string,
  days: WeeklyEventDay[],
): GeneratedEventOccurrence[] {
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  if (!start || !end) return [];
  if (end < start) throw new Error('A data final não pode ser anterior à data inicial.');
  const periodDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
  if (periodDays > EVENT_BATCH_MAX_DAYS) {
    throw new Error(`O período não pode ultrapassar ${EVENT_BATCH_MAX_DAYS} dias.`);
  }

  const enabledDays = days.filter((day) => day.enabled);
  if (enabledDays.some((day) => !day.startTime)) {
    throw new Error('Informe o horário inicial de todos os dias selecionados.');
  }
  if (enabledDays.some((day) => day.endTime && day.endTime <= day.startTime)) {
    throw new Error('A hora final deve ser posterior à hora inicial.');
  }

  const dayMap = new Map(enabledDays.map((day) => [day.weekday, day]));
  const occurrences: GeneratedEventOccurrence[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const config = dayMap.get(cursor.getUTCDay());
    if (!config) continue;
    const dateKey = cursor.toISOString().slice(0, 10);
    occurrences.push({
      dateKey,
      weekday: config.weekday,
      dataInicio: zonedDateTimeToIso(dateKey, config.startTime),
      dataFim: config.endTime ? zonedDateTimeToIso(dateKey, config.endTime) : undefined,
    });
    if (occurrences.length > EVENT_BATCH_MAX_OCCURRENCES) {
      throw new Error(`O lote pode conter no máximo ${EVENT_BATCH_MAX_OCCURRENCES} eventos.`);
    }
  }
  return occurrences;
}

export function formatOperationalDateTime(
  value: string,
  locale: string,
  includeDate = true,
) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: EVENT_TIME_ZONE,
    ...(includeDate ? { day: '2-digit', month: '2-digit', year: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}
