export const MONTH_LABELS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export const WEEKDAY_LABELS = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado',
];

export const WEEKDAY_GROUP_LABELS = [
  'domingos', 'segundas-feiras', 'terças-feiras', 'quartas-feiras', 'quintas-feiras', 'sextas-feiras', 'sábados',
];

export const WEEKDAY_SHORT_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const ROLE_COLORS = [
  '#0f766e', '#1d4ed8', '#a16207', '#6d28d9', '#be123c', '#4d7c0f',
];

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character] ?? character,
  );
}

export function formatDate(date: Date, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    ...options,
  }).format(date);
}

export function getWeekdayIndex(date: Date): number {
  return date.getUTCDay();
}

export function capitalize(value: string): string {
  return value ? `${value[0].toLocaleUpperCase('pt-BR')}${value.slice(1)}` : value;
}

export function chunk<T>(values: T[], size: number): T[][] {
  if (values.length === 0) return [[]];
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export function startOfWeek(date: Date): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (result.getUTCDay() + 6) % 7;
  result.setUTCDate(result.getUTCDate() - daysSinceMonday);
  return result;
}

export function endOfWeek(weekStart: Date): Date {
  const result = new Date(weekStart);
  result.setUTCDate(result.getUTCDate() + 6);
  return result;
}

export function toMiB(bytes: number): number {
  return Number((bytes / 1024 / 1024).toFixed(1));
}

export function normalizeEtagValue(value: string): string {
  return value.trim().replace(/^W\//i, '').replace(/^"|"$/g, '');
}

export function matchesIfNoneMatch(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  const target = normalizeEtagValue(etag);
  return ifNoneMatch
    .split(',')
    .map((candidate) => candidate.trim())
    .some((candidate) => candidate === '*' || normalizeEtagValue(candidate) === target);
}
