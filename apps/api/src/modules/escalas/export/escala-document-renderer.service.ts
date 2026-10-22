import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import type { Browser } from 'playwright';
import {
  ChromiumRendererService,
  CHROMIUM_LOW_MEMORY_ARGS,
  DocumentCacheService,
  escapeHtml,
  ExportServiceUnavailableException,
  formatDate,
  getWeekdayIndex,
  capitalize,
  chunk,
  startOfWeek,
  endOfWeek,
  toMiB,
  renderBaseDocumentStyles,
  renderDocumentHeader,
  ROLE_COLORS,
  WEEKDAY_GROUP_LABELS,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT_LABELS,
  MONTH_LABELS,
  TenantLogoService,
} from '../../../common/export';
import type {
  EscalaDocumentDay,
  EscalaDocumentFormat,
  EscalaDocumentInput,
  EscalaDocumentPageSelection,
  EscalaDocumentRole,
  EscalaDocumentSchedule,
  EscalaDocumentWeekOption,
  EscalaExportResult,
  EscalaRenderOptions,
  RenderedBatchDocument,
  RenderedBatchFile,
  RenderedDocument,
} from './escala-document.types';

export { CHROMIUM_LOW_MEMORY_ARGS, ExportServiceUnavailableException };

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

export interface WeeklyDocumentPage {
  weekStart: Date | null;
  weekEnd: Date | null;
  events: WeeklyEvent[];
  emptySchedule?: EscalaDocumentSchedule;
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

export function createWeeklyPages(schedules: EscalaDocumentSchedule[]): WeeklyDocumentPage[] {
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
    let maxChars = role.name.length;
    for (const day of days) {
      const assignments = day.assignments.filter((assignment) => assignment.roleId === role.id);
      const cellText = assignments.map((assignment) => assignment.memberName).join(', ');
      if (cellText.length > maxChars) {
        maxChars = cellText.length;
      }
    }
    return Math.max(8, Math.min(maxChars, 26));
  });

  const total = weights.reduce((sum, current) => sum + current, 0);
  const remaining = 95.4;
  return weights.map((weight) => `${((weight / total) * remaining).toFixed(2)}%`);
}

function renderGeneralTable(
  days: EscalaDocumentDay[],
  roles: EscalaDocumentRole[],
) {
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
    .map(([weekday, groupDays], groupIndex) => {
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
      return `<section class="weekday-group" style="--group-color:${ROLE_COLORS[groupIndex % ROLE_COLORS.length]}"><h2>${escapeHtml(heading)}</h2><table class="general-table">${columnGroup}<thead><tr><th class="date-head">Data</th>${roleHeaders}</tr></thead><tbody>${rows}</tbody></table></section>`;
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
  lookupLabsLogoDataUri?: string | null,
) {
  const schedule = page.schedule;
  const heading = page.kind === 'general' ? `Escala - ${schedule.ministryName}` : `Escala por membro - ${schedule.ministryName}`;
  const subtitle = formatPeriod(schedule);
  const context = page.context ? `<p class="page-context">${escapeHtml(page.context)}</p>` : '';
  const content = page.kind === 'general'
    ? renderGeneralTable(page.days, page.roles ?? [])
    : renderMemberMatrix(schedule, page.days, page.members ?? []);

  return `<section class="pdf-page">${renderDocumentHeader(heading, subtitle, input, lookupLabsLogoDataUri)}${context}<main>${content}</main></section>`;
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

export function formatWeekPeriod(page: WeeklyDocumentPage) {
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

export function getWeeklyPageFileName(page: WeeklyDocumentPage, pageNumber: number) {
  const schedule = page.events[0]?.schedule ?? page.emptySchedule;
  const monthStart = schedule
    ? new Date(Date.UTC(schedule.year, schedule.month - 1, 1))
    : null;
  const visibleStart = (monthStart && page.weekStart && page.weekStart < monthStart)
    ? monthStart
    : page.weekStart;
  const weekFileSuffix = visibleStart
    ? visibleStart.toISOString().slice(0, 10)
    : `sem-eventos-${String(pageNumber).padStart(2, '0')}`;
  return `escalas-semana-${weekFileSuffix}.png`;
}

export function getEscalaPdfFileName(schedules: EscalaDocumentSchedule[]): string {
  if (schedules.length === 0) {
    return 'escalas.pdf';
  }
  const first = schedules[0];
  const pad = (n: number) => String(n).padStart(2, '0');
  if (first.year && first.month) {
    return `escalas-${first.year}-${pad(first.month)}.pdf`;
  }
  return 'escalas.pdf';
}

export function listWeeklyPageOptions(schedules: EscalaDocumentSchedule[]): EscalaDocumentWeekOption[] {
  return createWeeklyPages(schedules).map((page, index) => {
    const pageNumber = index + 1;
    return {
      page: pageNumber,
      weekStart: page.weekStart ? page.weekStart.toISOString().slice(0, 10) : null,
      weekEnd: page.weekEnd ? page.weekEnd.toISOString().slice(0, 10) : null,
      label: formatWeekPeriod(page) || `Semana ${pageNumber}`,
      fileName: getWeeklyPageFileName(page, pageNumber),
      eventCount: page.events.length,
    };
  });
}

function renderWeeklyPage(
  page: WeeklyDocumentPage,
  input: EscalaDocumentInput,
  lookupLabsLogoDataUri?: string | null,
) {
  const title = page.emptySchedule
    ? `Escala - ${page.emptySchedule.ministryName}`
    : 'Escalas da semana';
  const events = page.events.map(renderEventCard).join('');
  const emptyMessage = page.events.length === 0
    ? '<div class="weekly-empty">Não há eventos cadastrados nesta escala no período.</div>'
    : '';

  return `<main class="weekly-sheet">${renderDocumentHeader(title, formatWeekPeriod(page), input, lookupLabsLogoDataUri)}<div class="weekly-events">${events}${emptyMessage}</div></main>`;
}

@Injectable()
export class EscalaDocumentRendererService {
  constructor(
    private readonly chromiumRenderer: ChromiumRendererService = new ChromiumRendererService(),
    private readonly tenantLogo: TenantLogoService = new TenantLogoService(),
    private readonly documentCache: DocumentCacheService = new DocumentCacheService(),
  ) {}

  setLimitsForTesting(limits: {
    maxQueueWaiting?: number;
    renderTimeoutMs?: number;
    maxCacheBytes?: number;
  }) {
    this.chromiumRenderer.setLimitsForTesting(limits);
    this.documentCache.setLimitsForTesting(limits);
  }

  computeEtag(
    input: EscalaDocumentInput,
    format: EscalaDocumentFormat,
    pageSelection: EscalaDocumentPageSelection,
  ): string {
    return this.documentCache.computeEtag({
      organizationName: input.organizationName,
      logoUrl: input.logoUrl ?? null,
      format,
      pageSelection,
      schedules: input.schedules.map((schedule) => ({
        id: schedule.id,
        ministryName: schedule.ministryName,
        month: schedule.month,
        year: schedule.year,
        roles: schedule.roles,
        days: schedule.days.map((day) => ({
          date: day.date instanceof Date ? day.date.toISOString() : String(day.date),
          title: day.title ?? null,
          hiddenRoleIds: day.hiddenRoleIds,
          assignments: day.assignments,
        })),
      })),
    });
  }

  private computeTotalPages(
    input: EscalaDocumentInput,
    format: EscalaDocumentFormat,
  ): number {
    return format === 'pdf'
      ? input.schedules.flatMap(createPdfPages).length
      : createWeeklyPages(input.schedules).length;
  }

  private validatePageSelection(
    format: EscalaDocumentFormat,
    pageSelection: EscalaDocumentPageSelection,
    totalWeeklyPages: number,
  ) {
    if (format === 'png' && pageSelection !== 'todas') {
      if (pageSelection < 1 || pageSelection > totalWeeklyPages) {
        throw new BadRequestException('A semana solicitada não existe nesta escala.');
      }
    }
  }

  async render(
    input: EscalaDocumentInput,
    format: 'pdf' | 'png',
    pageNumber?: number,
    options?: EscalaRenderOptions,
  ): Promise<RenderedDocument> {
    const result = await this.renderExport(input, format, pageNumber ?? 1, options);
    if (result.kind === 'batch' || result.kind === 'not-modified') {
      throw new BadRequestException('Modo de exportação incompatível com renderização única.');
    }
    return result;
  }

  async renderExport(
    input: EscalaDocumentInput,
    format: EscalaDocumentFormat,
    pageSelection: EscalaDocumentPageSelection = 1,
    options?: EscalaRenderOptions,
  ): Promise<EscalaExportResult> {
    const startedAt = performance.now();
    const rssBeforeMiB = toMiB(process.memoryUsage().rss);
    const effectiveSelection: EscalaDocumentPageSelection =
      format === 'pdf' ? 1 : (pageSelection ?? 1);

    const totalPages = this.computeTotalPages(input, format);
    this.validatePageSelection(format, effectiveSelection, totalPages);

    const etag = this.computeEtag(input, format, effectiveSelection);

    if (this.documentCache.isNotModified(options?.ifNoneMatch, etag)) {
      const totalMs = Math.round(performance.now() - startedAt);
      this.chromiumRenderer.logCacheHitMetrics({
        eventName: 'escala_export',
        format,
        page: effectiveSelection,
        pageCount: totalPages,
        queryMs: options?.queryMs ?? 0,
        totalMs,
        bufferBytes: 0,
        rssBeforeMiB,
        cache: 'etag',
      });
      return {
        kind: 'not-modified',
        etag,
        pageCount: totalPages,
        notModified: true,
      };
    }

    const cached = this.documentCache.get(etag);
    if (cached) {
      const bufferBytes =
        cached.kind === 'batch'
          ? cached.files.reduce((acc, f) => acc + Buffer.byteLength(f.base64, 'utf8'), 0)
          : cached.buffer.byteLength;
      const totalMs = Math.round(performance.now() - startedAt);
      this.chromiumRenderer.logCacheHitMetrics({
        eventName: 'escala_export',
        format,
        page: effectiveSelection,
        pageCount: cached.pageCount,
        queryMs: options?.queryMs ?? 0,
        totalMs,
        bufferBytes,
        rssBeforeMiB,
        cache: 'hit',
      });
      return cached;
    }

    return this.chromiumRenderer.runSerialRender(
      {
        eventName: 'escala_export',
        format,
        pageSelection: effectiveSelection,
        queryMs: options?.queryMs ?? 0,
      },
      async (browser: Browser, markLaunchMs: () => number) => {
        // Re-check cache in case an earlier queued request finished the same render
        const cachedAfterQueue = this.documentCache.get(etag);
        if (cachedAfterQueue) {
          return cachedAfterQueue;
        }

        const resolvedLogoDataUri = await this.tenantLogo.resolveTenantLogoDataUri(input.logoUrl);
        const lookupLabsLogoDataUri = this.tenantLogo.getLookupLabsLogoDataUri();
        const shouldCacheResult = !input.logoUrl?.trim() || resolvedLogoDataUri !== null;
        const resolvedInput: EscalaDocumentInput = {
          ...input,
          logoUrl: resolvedLogoDataUri,
        };

        const pdfPages = format === 'pdf'
          ? resolvedInput.schedules.flatMap(createPdfPages)
          : [];
        const weeklyPages = format === 'png'
          ? createWeeklyPages(resolvedInput.schedules)
          : [];
        const currentTotalPages = format === 'pdf' ? pdfPages.length : weeklyPages.length;

        const launchMs = markLaunchMs();
        const renderStart = performance.now();
        const page = await browser.newPage({
          viewport: format === 'pdf'
            ? { width: 1123, height: 794 }
            : { width: 1080, height: 1000 },
          deviceScaleFactor: 1,
        });

        try {
          const styles = renderBaseDocumentStyles();
          const head = `<meta charset="utf-8" /><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline';" />${styles}`;
          const responseEtag = shouldCacheResult ? etag : undefined;

          if (format === 'pdf') {
            const body = pdfPages
              .map((pdfPage) => renderPdfPage(pdfPage, resolvedInput, lookupLabsLogoDataUri))
              .join('');
            await page.setContent(
              `<!doctype html><html lang="pt-BR"><head>${head}</head><body>${body}</body></html>`,
              { waitUntil: 'domcontentloaded' },
            );
            await this.chromiumRenderer.waitForImages(page);

            const buffer = await page.pdf({
              format: 'A4',
              landscape: true,
              printBackground: true,
              preferCSSPageSize: true,
              margin: { top: '7mm', right: '7mm', bottom: '7mm', left: '7mm' },
            });
            const renderMs = Math.round(performance.now() - renderStart);
            const result: RenderedDocument = {
              kind: 'single',
              buffer,
              mimeType: 'application/pdf',
              fileName: getEscalaPdfFileName(resolvedInput.schedules),
              pageCount: currentTotalPages,
              etag: responseEtag,
            };
            if (shouldCacheResult) {
              this.documentCache.set(etag, result, buffer.byteLength);
            }
            this.chromiumRenderer.logRenderMetrics({
              eventName: 'escala_export',
              format,
              page: 1,
              pageCount: currentTotalPages,
              queryMs: options?.queryMs ?? 0,
              launchMs,
              renderMs,
              totalMs: Math.round(performance.now() - startedAt),
              bufferBytes: buffer.byteLength,
              rssBeforeMiB,
            });
            return result;
          }

          if (effectiveSelection === 'todas') {
            const files: RenderedBatchFile[] = [];
            let totalBufferBytes = 0;

            for (let idx = 0; idx < weeklyPages.length; idx += 1) {
              const weeklyPage = weeklyPages[idx];
              const body = renderWeeklyPage(weeklyPage, resolvedInput, lookupLabsLogoDataUri);
              await page.setContent(
                `<!doctype html><html lang="pt-BR"><head>${head}</head><body>${body}</body></html>`,
                { waitUntil: 'domcontentloaded' },
              );
              await this.chromiumRenderer.waitForImages(page);
              const buffer = await page.screenshot({ type: 'png', fullPage: true });
              totalBufferBytes += buffer.byteLength;
              files.push({
                fileName: getWeeklyPageFileName(weeklyPage, idx + 1),
                mimeType: 'image/png',
                base64: buffer.toString('base64'),
              });
            }

            const renderMs = Math.round(performance.now() - renderStart);
            const batchResult: RenderedBatchDocument = {
              kind: 'batch',
              files,
              pageCount: currentTotalPages,
              etag: responseEtag,
            };
            const cacheBytes = files.reduce(
              (acc, f) => acc + Buffer.byteLength(f.base64, 'utf8'),
              0,
            );
            if (shouldCacheResult) {
              this.documentCache.set(etag, batchResult, cacheBytes);
            }
            this.chromiumRenderer.logRenderMetrics({
              eventName: 'escala_export',
              format,
              page: 'todas',
              pageCount: currentTotalPages,
              queryMs: options?.queryMs ?? 0,
              launchMs,
              renderMs,
              totalMs: Math.round(performance.now() - startedAt),
              bufferBytes: totalBufferBytes,
              rssBeforeMiB,
            });
            return batchResult;
          }

          const selectedPage = effectiveSelection as number;
          const weeklyPage = weeklyPages[selectedPage - 1];
          const body = renderWeeklyPage(weeklyPage, resolvedInput, lookupLabsLogoDataUri);
          await page.setContent(
            `<!doctype html><html lang="pt-BR"><head>${head}</head><body>${body}</body></html>`,
            { waitUntil: 'domcontentloaded' },
          );
          await this.chromiumRenderer.waitForImages(page);

          const buffer = await page.screenshot({ type: 'png', fullPage: true });
          const renderMs = Math.round(performance.now() - renderStart);
          const pngResult: RenderedDocument = {
            kind: 'single',
            buffer,
            mimeType: 'image/png',
            fileName: getWeeklyPageFileName(weeklyPage, selectedPage),
            pageCount: currentTotalPages,
            etag: responseEtag,
          };
          if (shouldCacheResult) {
            this.documentCache.set(etag, pngResult, buffer.byteLength);
          }
          this.chromiumRenderer.logRenderMetrics({
            eventName: 'escala_export',
            format,
            page: selectedPage,
            pageCount: currentTotalPages,
            queryMs: options?.queryMs ?? 0,
            launchMs,
            renderMs,
            totalMs: Math.round(performance.now() - startedAt),
            bufferBytes: buffer.byteLength,
            rssBeforeMiB,
          });
          return pngResult;
        } finally {
          await page.close().catch(() => undefined);
        }
      },
    );
  }
}
