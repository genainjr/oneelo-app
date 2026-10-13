import { BadRequestException, Injectable } from '@nestjs/common';
import { chromium } from 'playwright';
import type {
  EscalaDocumentDay,
  EscalaDocumentInput,
  EscalaDocumentRole,
  EscalaDocumentSchedule,
  RenderedDocument,
} from './escala-document.types';

const MONTH_LABELS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const WEEKDAY_LABELS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const WEEKDAY_GROUP_LABELS = ['domingos', 'segundas-feiras', 'terças-feiras', 'quartas-feiras', 'quintas-feiras', 'sextas-feiras', 'sábados'];
const WEEKDAY_SHORT_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const ROLE_COLORS = ['#d8eee9', '#dce6f4', '#f4e8c7', '#e7e0f2', '#f5dfe1', '#deebd7'];
const MAX_DAYS_PER_GENERAL_PAGE = 24;
const MAX_DAYS_PER_MATRIX_PAGE = 18;
const MAX_ROLES_PER_PDF_PAGE = 10;
const MAX_MEMBERS_PER_PDF_PAGE = 22;

type PdfPageKind = 'general' | 'members';

interface PdfDocumentPage {
  kind: PdfPageKind;
  schedule: EscalaDocumentSchedule;
  days: EscalaDocumentDay[];
  roles?: EscalaDocumentRole[];
  members?: string[];
  context?: string;
}

interface WeeklyEvent {
  schedule: EscalaDocumentSchedule;
  day: EscalaDocumentDay;
}

interface WeeklyDocumentPage {
  weekStart: Date | null;
  weekEnd: Date | null;
  events: WeeklyEvent[];
  emptySchedule?: EscalaDocumentSchedule;
}

function escapeHtml(value: string) {
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

function formatDate(date: Date, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    ...options,
  }).format(date);
}

function getWeekdayIndex(date: Date) {
  return date.getUTCDay();
}

function capitalize(value: string) {
  return value ? `${value[0].toLocaleUpperCase('pt-BR')}${value.slice(1)}` : value;
}

function getLookupLabsLogoUrl() {
  const baseUrl = process.env.DOCUMENT_ASSET_BASE_URL ?? process.env.CORS_ORIGIN;
  if (!baseUrl) return null;

  try {
    return new URL('/LogoLookupLabs.png', baseUrl).toString();
  } catch {
    return null;
  }
}

function chunk<T>(values: T[], size: number): T[][] {
  if (values.length === 0) return [[]];
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function getAssignedMembers(schedule: EscalaDocumentSchedule) {
  return Array.from(new Set(
    schedule.days.flatMap((day) => day.assignments.map((assignment) => assignment.memberName)),
  )).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function getMatrixRoleColor(index: number) {
  const hue = ((index * 137.508) % 360).toFixed(2);
  return `hsl(${hue} 58% 88%)`;
}

function createPdfPages(schedule: EscalaDocumentSchedule): PdfDocumentPage[] {
  const generalDayChunks = chunk(schedule.days, MAX_DAYS_PER_GENERAL_PAGE);
  const roleChunks = chunk(schedule.roles, MAX_ROLES_PER_PDF_PAGE);
  const generalPages = generalDayChunks.flatMap((days, dayChunkIndex) =>
    roleChunks.map((roles, roleChunkIndex) => ({
      kind: 'general' as const,
      schedule,
      days,
      roles,
      context: [
        generalDayChunks.length > 1
          ? `dias ${dayChunkIndex * MAX_DAYS_PER_GENERAL_PAGE + 1}–${dayChunkIndex * MAX_DAYS_PER_GENERAL_PAGE + days.length}`
          : null,
        roleChunks.length > 1
          ? `funções ${roleChunkIndex * MAX_ROLES_PER_PDF_PAGE + 1}–${roleChunkIndex * MAX_ROLES_PER_PDF_PAGE + roles.length}`
          : null,
      ].filter(Boolean).join(' · ') || undefined,
    })),
  );

  const members = getAssignedMembers(schedule);
  const matrixDayChunks = chunk(schedule.days, MAX_DAYS_PER_MATRIX_PAGE);
  const memberChunks = chunk(members, MAX_MEMBERS_PER_PDF_PAGE);
  const matrixPages = matrixDayChunks.flatMap((days, dayChunkIndex) =>
    memberChunks.map((memberGroup, memberChunkIndex) => ({
      kind: 'members' as const,
      schedule,
      days,
      members: memberGroup,
      context: [
        matrixDayChunks.length > 1
          ? `dias ${dayChunkIndex * MAX_DAYS_PER_MATRIX_PAGE + 1}–${dayChunkIndex * MAX_DAYS_PER_MATRIX_PAGE + days.length}`
          : null,
        memberChunks.length > 1
          ? `pessoas ${memberChunkIndex * MAX_MEMBERS_PER_PDF_PAGE + 1}–${memberChunkIndex * MAX_MEMBERS_PER_PDF_PAGE + memberGroup.length}`
          : null,
      ].filter(Boolean).join(' · ') || undefined,
    })),
  );

  return [...generalPages, ...matrixPages];
}

function startOfWeek(date: Date) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (result.getUTCDay() + 6) % 7;
  result.setUTCDate(result.getUTCDate() - daysSinceMonday);
  return result;
}

function endOfWeek(weekStart: Date) {
  const result = new Date(weekStart);
  result.setUTCDate(result.getUTCDate() + 6);
  return result;
}

function createWeeklyPages(schedules: EscalaDocumentSchedule[]): WeeklyDocumentPage[] {
  const pagesByWeek = new Map<string, WeeklyDocumentPage>();

  for (const schedule of schedules) {
    for (const day of schedule.days) {
      const weekStart = startOfWeek(day.date);
      const key = `${schedule.year}-${schedule.month}-${weekStart.toISOString().slice(0, 10)}`;
      const page = pagesByWeek.get(key) ?? {
        weekStart,
        weekEnd: endOfWeek(weekStart),
        events: [],
      };
      page.events.push({ schedule, day });
      pagesByWeek.set(key, page);
    }
  }

  if (pagesByWeek.size === 0) {
    return schedules.map((schedule) => ({
      weekStart: null,
      weekEnd: null,
      events: [],
      emptySchedule: schedule,
    }));
  }

  return Array.from(pagesByWeek.values())
    .map((page) => ({
      ...page,
      events: page.events.sort((a, b) => a.day.date.getTime() - b.day.date.getTime()),
    }))
    .sort((a, b) => {
      const scheduleA = a.events[0]?.schedule ?? a.emptySchedule;
      const scheduleB = b.events[0]?.schedule ?? b.emptySchedule;
      if (!scheduleA || !scheduleB) {
        return (a.weekStart?.getTime() ?? 0) - (b.weekStart?.getTime() ?? 0);
      }

      const monthOrder = scheduleA.year - scheduleB.year || scheduleA.month - scheduleB.month;
      return monthOrder || (a.weekStart?.getTime() ?? 0) - (b.weekStart?.getTime() ?? 0);
    });
}

function formatPeriod(schedule: EscalaDocumentSchedule) {
  const month = MONTH_LABELS[schedule.month - 1] ?? String(schedule.month);
  return `${capitalize(month)} de ${schedule.year}`;
}

function renderHeader(
  title: string,
  subtitle: string,
  input: EscalaDocumentInput,
) {
  const tenantLogo = input.logoUrl
    ? `<img class="tenant-logo" src="${escapeHtml(input.logoUrl)}" alt="" />`
    : '';
  const lookupLabsUrl = getLookupLabsLogoUrl();
  const lookupLabsLogo = lookupLabsUrl
    ? `<img class="lookup-labs-logo" src="${escapeHtml(lookupLabsUrl)}" alt="Lookup Labs" />`
    : '';

  return `<header class="document-header">${tenantLogo}<div class="header-title"><h1>${escapeHtml(title)}</h1></div><div class="header-meta"><p class="header-period">${escapeHtml(subtitle)}</p><strong class="organization">${escapeHtml(input.organizationName)}</strong></div></header><div class="brand">${lookupLabsLogo}<span>One Elo <small>Lookup Labs</small></span></div>`;
}

function getNamesByRole(day: EscalaDocumentDay) {
  const result = new Map<string, string[]>();
  for (const assignment of day.assignments) {
    const names = result.get(assignment.roleId) ?? [];
    names.push(assignment.memberName);
    result.set(assignment.roleId, names);
  }
  return result;
}

function getRoleColumnWeights(days: EscalaDocumentDay[], roles: EscalaDocumentRole[]) {
  const weights = roles.map((role) => {
    const maxContentLength = days.reduce((longest, day) => {
      if (day.hiddenRoleIds.includes(role.id)) {
        return Math.max(longest, 'Indisponível'.length);
      }
      const names = day.assignments
        .filter((assignment) => assignment.roleId === role.id)
        .map((assignment) => assignment.memberName)
        .join(', ');
      return Math.max(longest, names.length);
    }, role.name.length);
    const normalizedLength = Math.min(Math.max(maxContentLength, 8), 44);
    return 0.35 + 0.65 * Math.sqrt(normalizedLength / 44);
  });
  const totalWeight = weights.reduce((total, weight) => total + weight, 0) || 1;
  const roleColumnsWidth = 95.4;
  return weights.map((weight) => `${((weight / totalWeight) * roleColumnsWidth).toFixed(2)}%`);
}

function renderGeneralTable(days: EscalaDocumentDay[], roles: EscalaDocumentRole[]) {
  if (days.length === 0 || roles.length === 0) {
    return '<div class="empty">Esta escala ainda não possui funções ou dias cadastrados.</div>';
  }

  const daysByWeekday = new Map<number, EscalaDocumentDay[]>();
  for (const day of days) {
    const weekday = getWeekdayIndex(day.date);
    const group = daysByWeekday.get(weekday) ?? [];
    group.push(day);
    daysByWeekday.set(weekday, group);
  }

  const groups = Array.from(daysByWeekday.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekday, groupDays]) => {
      const heading = WEEKDAY_GROUP_LABELS[weekday] ?? 'Eventos';
      const roleColumnWidths = getRoleColumnWeights(days, roles);
      const columnGroup = `<colgroup><col style="width:4.6%" />${roleColumnWidths.map((width) => `<col style="width:${width}" />`).join('')}</colgroup>`;
      const rows = groupDays.map((day) => {
        const namesByRole = getNamesByRole(day);
        const cells = roles.map((role) => {
          const content = day.hiddenRoleIds.includes(role.id)
            ? 'Indisponível'
            : (namesByRole.get(role.id) ?? []).join(', ') || '—';
          return `<td>${escapeHtml(content)}</td>`;
        });
        return `<tr><td class="date-cell">${escapeHtml(formatDate(day.date, { day: '2-digit', month: '2-digit' }))}</td>${cells.join('')}</tr>`;
      }).join('');
      const roleHeaders = roles.map((role) => `<th>${escapeHtml(role.name)}</th>`).join('');
      return `<section class="weekday-group"><h2>${escapeHtml(heading)}</h2><table class="general-table">${columnGroup}<thead><tr><th class="date-head">Data</th>${roleHeaders}</tr></thead><tbody>${rows}</tbody></table></section>`;
    });

  return groups.join('');
}

function renderMemberMatrix(
  schedule: EscalaDocumentSchedule,
  days: EscalaDocumentDay[],
  members: string[],
) {
  if (days.length === 0 || members.length === 0) {
    return '<div class="empty">Não há pessoas escaladas neste período.</div>';
  }

  const roleById = new Map<string, { role: EscalaDocumentRole; index: number }>(
    schedule.roles.map((role, index) => [role.id, { role, index }]),
  );
  const headers = days.map((day) => {
    const weekday = WEEKDAY_SHORT_LABELS[getWeekdayIndex(day.date)] ?? '';
    return `<th><span>${escapeHtml(weekday)}</span><strong>${escapeHtml(formatDate(day.date, { day: '2-digit', month: '2-digit' }))}</strong></th>`;
  }).join('');
  const rows = members.map((member) => {
    const cells = days.map((day) => {
      const assignments = day.assignments.filter((assignment) => assignment.memberName === member);
      const uniqueRoles = Array.from(new Set(assignments.map((assignment) => assignment.roleId)));
      const chips = uniqueRoles.map((roleId) => {
        const roleData = roleById.get(roleId);
        if (!roleData) return '';
        const color = getMatrixRoleColor(roleData.index);
        return `<span class="role-chip" style="--role-color:${color}">${escapeHtml(roleData.role.name)}</span>`;
      }).join('');
      return `<td>${chips || '<span class="no-assignment">—</span>'}</td>`;
    }).join('');
    return `<tr><th scope="row" class="member-name">${escapeHtml(member)}</th>${cells}</tr>`;
  }).join('');

  return `<div class="matrix-frame"><table class="member-matrix"><thead><tr><th class="member-head">Membro</th>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderPdfPage(
  page: PdfDocumentPage,
  input: EscalaDocumentInput,
) {
  const schedule = page.schedule;
  const heading = page.kind === 'general' ? `Escala - ${schedule.ministryName}` : `Escala por membro - ${schedule.ministryName}`;
  const subtitle = formatPeriod(schedule);
  const context = page.context ? `<p class="page-context">${escapeHtml(page.context)}</p>` : '';
  const content = page.kind === 'general'
    ? renderGeneralTable(page.days, page.roles ?? [])
    : renderMemberMatrix(schedule, page.days, page.members ?? []);

  return `<section class="pdf-page">${renderHeader(heading, subtitle, input)}${context}<main>${content}</main></section>`;
}

function renderEventCard(event: WeeklyEvent, index: number) {
  const { schedule, day } = event;
  const namesByRole = getNamesByRole(day);
  const roleRows = schedule.roles.flatMap((role) => {
    const isHidden = day.hiddenRoleIds.includes(role.id);
    const names = namesByRole.get(role.id) ?? [];
    if (!isHidden && names.length === 0) return [];
    const content = isHidden ? 'Indisponível' : names.join(', ');
    return [`<div class="assignment-row"><span class="assignment-role">${escapeHtml(role.name)}</span><strong>${escapeHtml(content)}</strong></div>`];
  }).join('');
  const weekday = capitalize(WEEKDAY_LABELS[getWeekdayIndex(day.date)] ?? '');
  const eventTitle = day.title ? `<span class="event-title">${escapeHtml(day.title)}</span>` : '';

  return `<article class="event-card" style="--event-color:${ROLE_COLORS[index % ROLE_COLORS.length]}"><header><div class="event-date"><strong>${escapeHtml(formatDate(day.date, { day: '2-digit', month: '2-digit' }))}</strong><span>${escapeHtml(weekday)}</span>${eventTitle}</div><span class="ministry-tag">${escapeHtml(schedule.ministryName)}</span></header><div class="event-assignments">${roleRows || '<p class="empty-assignments">Nenhuma atribuição registrada.</p>'}</div></article>`;
}

function formatWeekPeriod(page: WeeklyDocumentPage) {
  if (!page.weekStart || !page.weekEnd) {
    return page.emptySchedule ? formatPeriod(page.emptySchedule) : '';
  }
  const schedule = page.events[0]?.schedule ?? page.emptySchedule;
  if (!schedule) return '';

  const monthStart = new Date(Date.UTC(schedule.year, schedule.month - 1, 1));
  const monthEnd = new Date(Date.UTC(schedule.year, schedule.month, 0));
  const visibleStart = page.weekStart < monthStart ? monthStart : page.weekStart;
  const visibleEnd = page.weekEnd > monthEnd ? monthEnd : page.weekEnd;
  const startDay = formatDate(visibleStart, { day: '2-digit' });
  const endDay = formatDate(visibleEnd, { day: '2-digit' });
  const monthLabel = MONTH_LABELS[schedule.month - 1] ?? '';
  return `Semana de ${startDay} a ${endDay} de ${monthLabel}`;
}

function renderWeeklyPage(
  page: WeeklyDocumentPage,
  input: EscalaDocumentInput,
) {
  const title = page.emptySchedule
    ? `Escala - ${page.emptySchedule.ministryName}`
    : 'Escalas da semana';
  const events = page.events.map(renderEventCard).join('');
  const emptyMessage = page.events.length === 0
    ? '<div class="weekly-empty">Não há eventos cadastrados nesta escala no período.</div>'
    : '';

  return `<main class="weekly-sheet">${renderHeader(title, formatWeekPeriod(page), input)}<div class="weekly-events">${events}${emptyMessage}</div></main>`;
}

function renderStyles() {
  return `<style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #111827; font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: A4 landscape; margin: 7mm; }
    .pdf-page { position: relative; width: 283mm; min-height: 194mm; padding: 2mm 2mm 12mm; break-after: page; page-break-after: always; background: #fff; }
    .pdf-page:last-child { break-after: auto; page-break-after: auto; }
    .document-header { min-height: 22mm; display: grid; grid-template-columns: 22mm minmax(0, 1fr) 58mm; align-items: center; gap: 4mm; margin-bottom: 4mm; }
    .document-header:not(:has(.tenant-logo)) { grid-template-columns: minmax(0, 1fr) 58mm; }
    .tenant-logo { width: 20mm; height: 20mm; object-fit: contain; background: transparent; }
    .header-title { grid-column: 2; min-width: 0; justify-self: center; text-align: center; }
    .document-header:not(:has(.tenant-logo)) .header-title { grid-column: 1; }
    .header-title h1 { margin: 0; color: #101827; font-size: 19pt; line-height: 1.05; font-weight: 800; text-align: center; }
    .header-meta { grid-column: 3; justify-self: end; min-width: 0; max-width: 58mm; text-align: right; }
    .document-header:not(:has(.tenant-logo)) .header-meta { grid-column: 2; }
    .header-period { margin: 0 0 1.2mm; color: #64748b; font-size: 10pt; font-weight: 700; }
    .organization { display: block; color: #475569; font-size: 8.5pt; text-align: right; font-weight: 700; overflow-wrap: anywhere; }
    .brand { position: absolute; left: 2mm; bottom: 1mm; display: flex; align-items: center; gap: 2mm; color: #334155; font-size: 8pt; font-weight: 700; }
    .brand small { display: block; color: #64748b; font-size: 6.5pt; font-weight: 500; }
    .lookup-labs-logo { width: 8mm; height: 8mm; object-fit: contain; background: transparent; mix-blend-mode: multiply; }
    .page-context { margin: -2mm 0 2mm; color: #64748b; font-size: 7.5pt; text-align: center; }
    .weekday-group { margin: 0 0 3mm; break-inside: auto; page-break-inside: auto; }
    .weekday-group h2 { margin: 0; padding: 1.5mm 2mm; border-radius: 2mm 2mm 0 0; background: #203d61; color: #fff; font-size: 8pt; line-height: 1.1; text-transform: uppercase; break-after: avoid-page; page-break-after: avoid; }
    .weekday-group:nth-child(3n + 2) h2 { background: #5b6c8c; }
    .weekday-group:nth-child(3n) h2 { background: #2f8271; }
    .general-table, .member-matrix { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .general-table { font-size: 7.5pt; line-height: 1.15; }
    .general-table thead { display: table-header-group; }
    .general-table th, .general-table td { padding: 1.35mm 1mm; border: 0.25mm solid #d7dee8; text-align: center; vertical-align: middle; overflow-wrap: anywhere; }
    .general-table tbody tr { break-inside: avoid; page-break-inside: avoid; }
    .general-table th { background: #e7ebf1; color: #475569; font-size: 6.8pt; font-weight: 800; text-transform: uppercase; }
    .general-table .date-head, .general-table .date-cell { white-space: nowrap; font-weight: 700; }
    .general-table tbody tr:nth-child(even) td { background: #f4f6f9; }
    .general-table .date-cell { color: #243b5a; }
    .matrix-frame { overflow: hidden; border: 0.25mm solid #d7dee8; }
    .member-matrix { font-size: 7pt; }
    .member-matrix th, .member-matrix td { padding: 1mm 0.7mm; border: 0.2mm solid #dfe5ed; text-align: center; vertical-align: middle; overflow-wrap: anywhere; }
    .member-matrix thead th { background: #e7ebf1; color: #475569; font-size: 6.2pt; }
    .member-matrix thead th span, .member-matrix thead th strong { display: block; }
    .member-matrix thead th strong { margin-top: 0.6mm; color: #27364b; font-size: 7pt; }
    .member-matrix .member-head, .member-matrix .member-name { width: 34mm; text-align: left; }
    .member-matrix .member-name { background: #f1f4f8; font-size: 7.1pt; font-weight: 700; }
    .role-chip { display: inline-block; margin: 0.35mm; padding: 0.5mm 0.9mm; border-radius: 1mm; background: var(--role-color); color: #1f2937; font-size: 6pt; }
    .no-assignment { color: #c3cbd6; }
    .empty { padding: 8mm; border: 0.3mm dashed #cbd5e1; color: #64748b; text-align: center; font-size: 11pt; }
    .weekly-sheet { width: 1080px; min-height: 100vh; padding: 46px 48px 36px; background: #fff; color: #111827; }
    .weekly-sheet .document-header { grid-template-columns: 92px minmax(0, 1fr) minmax(290px, 340px); gap: 20px; height: 150px; min-height: 150px; margin-bottom: 28px; }
    .weekly-sheet .document-header:not(:has(.tenant-logo)) { grid-template-columns: minmax(0, 1fr) minmax(290px, 340px); }
    .weekly-sheet .header-title { grid-column: 2; }
    .weekly-sheet .document-header:not(:has(.tenant-logo)) .header-title { grid-column: 1; }
    .weekly-sheet .header-meta { grid-column: 3; max-width: 340px; }
    .weekly-sheet .document-header:not(:has(.tenant-logo)) .header-meta { grid-column: 2; }
    .weekly-sheet .tenant-logo { width: 84px; height: 84px; background: transparent; }
    .weekly-sheet .header-title h1 { font-size: 54px; }
    .weekly-sheet .header-period { margin-bottom: 8px; font-size: 21px; line-height: 1.2; white-space: nowrap; }
    .weekly-sheet .organization { font-size: 20px; font-weight: 500; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
    .weekly-sheet .brand { display: none; }
    .weekly-events { display: grid; gap: 28px; }
    .event-card { overflow: hidden; border: 1px solid #d8dee8; border-radius: 22px; background: #fff; }
    .event-card > header { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 20px 28px; background: var(--event-color); color: #fff; }
    .event-date { display: flex; flex-wrap: wrap; align-items: baseline; gap: 14px; }
    .event-date > strong { font-size: 44px; line-height: 1; }
    .event-date > span { font-size: 26px; font-weight: 700; }
    .event-title { flex-basis: 100%; font-size: 21px; font-weight: 600; }
    .ministry-tag { flex-shrink: 0; max-width: 36%; padding: 7px 13px; border-radius: 999px; background: rgba(255,255,255,.2); font-size: 19px; font-weight: 700; text-align: right; }
    .event-assignments { padding: 4px 28px; }
    .assignment-row { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 22px; align-items: center; min-height: 54px; padding: 10px 0; border-bottom: 1px solid #e7ebf1; }
    .assignment-row:last-child { border-bottom: 0; }
    .assignment-role { color: #657184; font-size: 22px; }
    .assignment-row strong { color: #111827; font-size: 27px; line-height: 1.2; overflow-wrap: anywhere; }
    .empty-assignments, .weekly-empty { padding: 26px; color: #64748b; font-size: 23px; text-align: center; }
    @media screen { body:has(.pdf-page) { background: #e5e7eb; } .pdf-page { width: 1123px; min-height: 794px; padding: 35px 35px 70px; margin-bottom: 16px; } .pdf-page .brand { left: 35px; bottom: 16px; } }
  </style>`;
}

@Injectable()
export class EscalaDocumentRendererService {
  async render(
    input: EscalaDocumentInput,
    format: 'pdf' | 'png',
    pageNumber?: number,
  ): Promise<RenderedDocument> {
    const pdfPages = format === 'pdf'
      ? input.schedules.flatMap(createPdfPages)
      : [];
    const weeklyPages = format === 'png'
      ? createWeeklyPages(input.schedules)
      : [];
    const totalPages = format === 'pdf' ? pdfPages.length : weeklyPages.length;
    const selectedPage = pageNumber ?? 1;

    if (format === 'png' && (selectedPage < 1 || selectedPage > weeklyPages.length)) {
      throw new BadRequestException('A semana solicitada não existe nesta escala.');
    }

    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage({
        viewport: format === 'pdf'
          ? { width: 1123, height: 794 }
          : { width: 1080, height: 1000 },
        deviceScaleFactor: format === 'png' ? 1 : 1,
      });
      const body = format === 'pdf'
        ? pdfPages.map((pdfPage) => renderPdfPage(pdfPage, input)).join('')
        : renderWeeklyPage(weeklyPages[selectedPage - 1], input);

      await page.setContent(
        `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />${renderStyles()}</head><body>${body}</body></html>`,
        { waitUntil: 'domcontentloaded' },
      );
      await page
        .waitForFunction(() => Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0), undefined, { timeout: 3_000 })
        .catch(() => undefined);

      if (format === 'pdf') {
        const buffer = await page.pdf({
          format: 'A4',
          landscape: true,
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: '7mm', right: '7mm', bottom: '7mm', left: '7mm' },
        });
        return {
          buffer,
          mimeType: 'application/pdf',
          fileName: 'escalas.pdf',
          pageCount: totalPages,
        };
      }

      const weeklyPage = weeklyPages[selectedPage - 1];
      const weekFileSuffix = weeklyPage.weekStart
        ? weeklyPage.weekStart.toISOString().slice(0, 10)
        : `sem-eventos-${String(selectedPage).padStart(2, '0')}`;
      const buffer = await page.screenshot({ type: 'png', fullPage: true });
      return {
        buffer,
        mimeType: 'image/png',
        fileName: `escalas-semana-${weekFileSuffix}.png`,
        pageCount: totalPages,
      };
    } finally {
      await browser.close();
    }
  }
}
