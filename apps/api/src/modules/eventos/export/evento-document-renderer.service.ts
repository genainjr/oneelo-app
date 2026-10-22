import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { EventoTipo, StatusEvento } from '@prisma/client';
import { performance } from 'node:perf_hooks';
import type { Browser } from 'playwright';
import {
  ChromiumRendererService,
  CHROMIUM_LOW_MEMORY_ARGS,
  DocumentCacheService,
  escapeHtml,
  ExportServiceUnavailableException,
  formatDate,
  capitalize,
  chunk,
  endOfWeek,
  toMiB,
  renderBaseDocumentStyles,
  renderDocumentHeader,
  ROLE_COLORS,
  WEEKDAY_GROUP_LABELS,
  WEEKDAY_LABELS,
  MONTH_LABELS,
  TenantLogoService,
} from '../../../common/export';
import type {
  EventoDocumentFormat,
  EventoDocumentInput,
  EventoDocumentItem,
  EventoDocumentPageSelection,
  EventoDocumentWeekOption,
  EventoExportResult,
  EventoRenderOptions,
  RenderedBatchDocument,
  RenderedBatchFile,
  RenderedDocument,
} from './evento-document.types';

export { CHROMIUM_LOW_MEMORY_ARGS, ExportServiceUnavailableException };

export const TIPO_EVENTO_LABEL: Record<EventoTipo, string> = {
  GERAL: 'Geral',
  MINISTERIO: 'Ministério',
  REUNIAO_INTERNA: 'Reunião interna',
};

export const STATUS_EVENTO_LABEL: Record<StatusEvento, string> = {
  AGENDADO: 'Agendado',
  REALIZADO: 'Realizado',
  CANCELADO: 'Cancelado',
};

export interface WeeklyEventoPage {
  year: number;
  month: number;
  weekStart: Date | null;
  weekEnd: Date | null;
  events: EventoDocumentItem[];
}

export function parseDateFilter(
  val: string | Date | null | undefined,
): { year: number; month: number; day: number } | null {
  if (!val) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      };
    }
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return null;
    return parseDateFilter(d);
  }
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(val).split('-');
    return {
      year: Number(parts[0]),
      month: Number(parts[1]),
      day: Number(parts[2]),
    };
  }
  return null;
}

export function formatPeriodSubtitle(input: EventoDocumentInput): string {
  const start = parseDateFilter(input.periodo?.dataInicio);
  const end = parseDateFilter(input.periodo?.dataFim);

  if (start && end) {
    const lastDayOfMonth = new Date(start.year, start.month, 0).getDate();
    if (
      start.year === end.year &&
      start.month === end.month &&
      start.day === 1 &&
      end.day === lastDayOfMonth
    ) {
      const monthLabel = MONTH_LABELS[start.month - 1] ?? '';
      return `${capitalize(monthLabel)} de ${start.year}`;
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    if (
      start.year === end.year &&
      start.month === end.month &&
      start.day === end.day
    ) {
      return `${pad(start.day)}/${pad(start.month)}/${start.year}`;
    }

    return `${pad(start.day)}/${pad(start.month)}/${start.year} a ${pad(end.day)}/${pad(end.month)}/${end.year}`;
  }

  if (start && !end) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `A partir de ${pad(start.day)}/${pad(start.month)}/${start.year}`;
  }

  if (!start && end) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `Até ${pad(end.day)}/${pad(end.month)}/${end.year}`;
  }

  if (input.eventos.length > 0) {
    const first = parseDateFilter(input.eventos[0].dataInicio);
    const last = parseDateFilter(
      input.eventos[input.eventos.length - 1].dataInicio,
    );
    if (first && last) {
      if (first.year === last.year && first.month === last.month) {
        const monthLabel = MONTH_LABELS[first.month - 1] ?? '';
        return `${capitalize(monthLabel)} de ${first.year}`;
      }
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(first.day)}/${pad(first.month)}/${first.year} a ${pad(last.day)}/${pad(last.month)}/${last.year}`;
    }
  }

  return 'Eventos programados';
}

export function renderPdfFooterTemplate(
  lookupLabsLogoDataUri?: string | null,
): string {
  const logo = lookupLabsLogoDataUri
    ? `<img src="${escapeHtml(lookupLabsLogoDataUri)}" style="width:8mm;height:8mm;object-fit:contain;mix-blend-mode:multiply;" />`
    : '';

  return `<div style="font-family:Arial,sans-serif;font-size:8pt;width:100%;padding:0 8mm;box-sizing:border-box;display:flex;justify-content:flex-start;align-items:flex-end;color:#334155;">
    <div style="display:flex;align-items:center;gap:2mm;">
      ${logo}
      <div style="display:flex;flex-direction:column;">
        <span style="font-size:8pt;font-weight:700;color:#334155;line-height:1.1;">One Elo</span>
        <span style="font-size:6.5pt;font-weight:500;color:#64748b;line-height:1.1;margin-top:1px;">Lookup Labs</span>
      </div>
    </div>
  </div>`;
}

export function countPdfPagesFromBuffer(buffer: Buffer): number {
  try {
    const text = buffer.toString('latin1');
    const pageMatches = text.match(/\/Type\s*\/Page\b/g);
    if (pageMatches && pageMatches.length > 0) {
      return pageMatches.length;
    }
    const countMatch = text.match(/\/Count\s+(\d+)/);
    if (countMatch && Number(countMatch[1]) > 0) {
      return Number(countMatch[1]);
    }
  } catch {
    // fallback
  }
  return 1;
}

function formatEventDate(date: Date, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    ...options,
  }).format(date);
}

function getOperationalWeekdayIndex(date: Date): number {
  const dayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[dayStr] ?? date.getUTCDay();
}

function getOperationalDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getEventStartOfWeek(date: Date): Date {
  const key = getOperationalDateKey(date);
  const [year, month, day] = key.split('-').map(Number);
  const weekday = getOperationalWeekdayIndex(date);
  const daysSinceMonday = (weekday + 6) % 7;
  const result = new Date(Date.UTC(year, month - 1, day));
  result.setUTCDate(result.getUTCDate() - daysSinceMonday);
  return result;
}

function formatTime(date: Date): string {
  return formatEventDate(date, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEventTimeRange(start: Date, end?: Date | null): string {
  const startTime = formatTime(start);
  if (!end) {
    return startTime;
  }
  const endTime = formatTime(end);
  if (startTime === endTime) {
    return startTime;
  }
  return `${startTime} às ${endTime}`;
}

export function createWeeklyEventoPages(eventos: EventoDocumentItem[]): WeeklyEventoPage[] {
  const pagesByWeek = new Map<string, WeeklyEventoPage>();

  for (const evento of eventos) {
    const dateKey = getOperationalDateKey(evento.dataInicio);
    const [year, month] = dateKey.split('-').map(Number);
    const weekStart = getEventStartOfWeek(evento.dataInicio);
    const key = `${year}-${month}-${weekStart.toISOString().slice(0, 10)}`;
    const page = pagesByWeek.get(key) ?? {
      year,
      month,
      weekStart,
      weekEnd: endOfWeek(weekStart),
      events: [],
    };
    page.events.push(evento);
    pagesByWeek.set(key, page);
  }

  if (pagesByWeek.size === 0) {
    return [
      {
        year: 0,
        month: 0,
        weekStart: null,
        weekEnd: null,
        events: [],
      },
    ];
  }

  return Array.from(pagesByWeek.values())
    .map((page) => ({
      ...page,
      events: page.events.sort(
        (a, b) => a.dataInicio.getTime() - b.dataInicio.getTime(),
      ),
    }))
    .sort((a, b) => {
      const monthOrder = a.year - b.year || a.month - b.month;
      return monthOrder || (a.weekStart?.getTime() ?? 0) - (b.weekStart?.getTime() ?? 0);
    });
}

export function formatEventoWeekPeriod(page: WeeklyEventoPage): string {
  if (!page.weekStart || !page.weekEnd || !page.year || !page.month) {
    return '';
  }
  const monthStart = new Date(Date.UTC(page.year, page.month - 1, 1));
  const monthEnd = new Date(Date.UTC(page.year, page.month, 0));
  const visibleStart = page.weekStart < monthStart ? monthStart : page.weekStart;
  const visibleEnd = page.weekEnd > monthEnd ? monthEnd : page.weekEnd;
  const startDay = formatDate(visibleStart, { day: '2-digit' });
  const endDay = formatDate(visibleEnd, { day: '2-digit' });
  const monthLabel = MONTH_LABELS[page.month - 1] ?? '';
  return `Semana de ${startDay} a ${endDay} de ${monthLabel}`;
}

export function getWeeklyEventoPageFileName(page: WeeklyEventoPage, pageNumber: number): string {
  const monthStart = page.year && page.month
    ? new Date(Date.UTC(page.year, page.month - 1, 1))
    : null;
  const visibleStart = (monthStart && page.weekStart && page.weekStart < monthStart)
    ? monthStart
    : page.weekStart;
  const weekFileSuffix = visibleStart
    ? visibleStart.toISOString().slice(0, 10)
    : `sem-eventos-${String(pageNumber).padStart(2, '0')}`;
  return `agenda-semana-${weekFileSuffix}.png`;
}

export function getEventoPdfFileName(input: EventoDocumentInput): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = parseDateFilter(input.periodo?.dataInicio);
  const end = parseDateFilter(input.periodo?.dataFim);

  if (start && end) {
    const lastDayOfMonth = new Date(start.year, start.month, 0).getDate();
    if (
      start.year === end.year &&
      start.month === end.month &&
      start.day === 1 &&
      end.day === lastDayOfMonth
    ) {
      return `agenda-eventos-${start.year}-${pad(start.month)}.pdf`;
    }
    if (start.year === end.year && start.month === end.month && start.day === end.day) {
      return `agenda-eventos-${start.year}-${pad(start.month)}-${pad(start.day)}.pdf`;
    }
    return `agenda-eventos-${start.year}-${pad(start.month)}-${pad(start.day)}-a-${end.year}-${pad(end.month)}-${pad(end.day)}.pdf`;
  }

  if (start && !end) {
    return `agenda-eventos-a-partir-de-${start.year}-${pad(start.month)}-${pad(start.day)}.pdf`;
  }

  if (!start && end) {
    return `agenda-eventos-ate-${end.year}-${pad(end.month)}-${pad(end.day)}.pdf`;
  }

  if (input.eventos.length > 0) {
    const first = parseDateFilter(input.eventos[0].dataInicio);
    const last = parseDateFilter(input.eventos[input.eventos.length - 1].dataInicio);
    if (first && last) {
      if (first.year === last.year && first.month === last.month) {
        return `agenda-eventos-${first.year}-${pad(first.month)}.pdf`;
      }
      return `agenda-eventos-${first.year}-${pad(first.month)}-${pad(first.day)}-a-${last.year}-${pad(last.month)}-${pad(last.day)}.pdf`;
    }
  }

  return 'agenda-eventos.pdf';
}

export function listWeeklyEventoPageOptions(eventos: EventoDocumentItem[]): EventoDocumentWeekOption[] {
  return createWeeklyEventoPages(eventos).map((page, index) => {
    const pageNumber = index + 1;
    return {
      page: pageNumber,
      weekStart: page.weekStart ? page.weekStart.toISOString().slice(0, 10) : null,
      weekEnd: page.weekEnd ? page.weekEnd.toISOString().slice(0, 10) : null,
      label: formatEventoWeekPeriod(page) || `Semana ${pageNumber}`,
      fileName: getWeeklyEventoPageFileName(page, pageNumber),
      eventCount: page.events.length,
    };
  });
}

function getTipoBadgeClass(tipo: EventoTipo): string {
  if (tipo === EventoTipo.GERAL) return 'tipo-badge';
  if (tipo === EventoTipo.MINISTERIO) return 'tipo-badge ministerio';
  return 'tipo-badge reuniao';
}

function renderPdfWeekdayGroups(eventos: EventoDocumentItem[]): string {
  if (eventos.length === 0) {
    return '<div class="empty">Nenhum evento encontrado para o período selecionado.</div>';
  }

  const eventsByWeekday = new Map<number, EventoDocumentItem[]>();
  for (const evento of eventos) {
    const weekday = getOperationalWeekdayIndex(evento.dataInicio);
    const group = eventsByWeekday.get(weekday) ?? [];
    group.push(evento);
    eventsByWeekday.set(weekday, group);
  }

  const getMondayFirstIndex = (weekday: number) => (weekday + 6) % 7;

  const groups = Array.from(eventsByWeekday.entries())
    .sort(([a], [b]) => getMondayFirstIndex(a) - getMondayFirstIndex(b))
    .map(([weekday, groupEvents], groupIndex) => {
      groupEvents.sort(
        (a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime(),
      );

      const heading = WEEKDAY_GROUP_LABELS[weekday] ?? 'Eventos';
      const rows = groupEvents.map((evento) => {
        const dateStr = formatEventDate(evento.dataInicio, { day: '2-digit', month: '2-digit' });
        const timeRange = formatEventTimeRange(evento.dataInicio, evento.dataFim);
        const tipoLabel = TIPO_EVENTO_LABEL[evento.tipo] ?? evento.tipo;
        const tipoBadgeClass = getTipoBadgeClass(evento.tipo);
        const ministeriosSuffix =
          evento.tipo !== EventoTipo.GERAL && evento.ministerios.length > 0
            ? ` <span class="event-ministry-label">(${escapeHtml(evento.ministerios.map((m) => m.nome).join(', '))})</span>`
            : '';
        const local = evento.local ? escapeHtml(evento.local) : '—';

        return `<tr>
          <td class="date-cell">${escapeHtml(dateStr)}<br/><span class="date-time-chip">${escapeHtml(timeRange)}</span></td>
          <td class="event-title-cell"><span class="event-title-text">${escapeHtml(evento.titulo)}</span>${ministeriosSuffix}</td>
          <td><span class="${tipoBadgeClass}">${escapeHtml(tipoLabel)}</span></td>
          <td class="local-cell">${local}</td>
        </tr>`;
      }).join('');

      return `<section class="weekday-group" style="--group-color:${ROLE_COLORS[groupIndex % ROLE_COLORS.length]}">
        <h2>${escapeHtml(heading)}</h2>
        <table class="general-table">
          <colgroup>
            <col style="width:22%" />
            <col style="width:48%" />
            <col style="width:15%" />
            <col style="width:15%" />
          </colgroup>
          <thead>
            <tr>
              <th class="date-head">Data / Horário</th>
              <th>Evento</th>
              <th>Tipo</th>
              <th>Local</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
    });

  return groups.join('');
}

function renderPdfDocument(
  input: EventoDocumentInput,
  lookupLabsLogoDataUri?: string | null,
): string {
  const title = 'Agenda de Eventos';
  const subtitle = formatPeriodSubtitle(input);
  const content = renderPdfWeekdayGroups(input.eventos);

  return `<div class="agenda-pdf-document">${renderDocumentHeader(
    title,
    subtitle,
    input,
    lookupLabsLogoDataUri,
    { includeBrand: false },
  )}<main>${content}</main></div>`;
}

function renderEventoCard(evento: EventoDocumentItem, index: number) {
  const dia = formatEventDate(evento.dataInicio, { day: '2-digit', month: '2-digit' });
  const weekday = capitalize(WEEKDAY_LABELS[getOperationalWeekdayIndex(evento.dataInicio)] ?? '');
  const tipoLabel = TIPO_EVENTO_LABEL[evento.tipo] ?? evento.tipo;
  const timeRange = formatEventTimeRange(evento.dataInicio, evento.dataFim);
  const ministerios =
    evento.tipo === EventoTipo.GERAL
      ? ''
      : evento.ministerios.map((m) => m.nome).join(', ');

  const rows: string[] = [
    `<div class="assignment-row"><span class="assignment-role">Horário</span><strong>${escapeHtml(timeRange)}</strong></div>`,
  ];

  if (ministerios) {
    rows.push(
      `<div class="assignment-row"><span class="assignment-role">Ministérios</span><strong>${escapeHtml(ministerios)}</strong></div>`,
    );
  }

  if (evento.local?.trim()) {
    rows.push(
      `<div class="assignment-row"><span class="assignment-role">Local</span><strong>${escapeHtml(evento.local.trim())}</strong></div>`,
    );
  }

  return `<article class="event-card" style="--event-color:${ROLE_COLORS[index % ROLE_COLORS.length]}">
    <header>
      <div class="event-date">
        <strong>${escapeHtml(dia)}</strong>
        <span>${escapeHtml(weekday)}</span>
        <span class="event-title">${escapeHtml(evento.titulo)}</span>
      </div>
      <span class="ministry-tag">${escapeHtml(tipoLabel)}</span>
    </header>
    <div class="event-assignments">${rows.join('')}</div>
  </article>`;
}

function renderWeeklyEventoPage(
  page: WeeklyEventoPage,
  input: EventoDocumentInput,
  lookupLabsLogoDataUri?: string | null,
) {
  const title = 'Agenda da semana';
  const subtitle = formatEventoWeekPeriod(page);
  const events = page.events.map(renderEventoCard).join('');
  const emptyMessage = page.events.length === 0
    ? '<div class="weekly-empty">Não há eventos cadastrados nesta semana.</div>'
    : '';

  return `<main class="weekly-sheet">${renderDocumentHeader(title, subtitle, input, lookupLabsLogoDataUri)}<div class="weekly-events">${events}${emptyMessage}</div></main>`;
}

@Injectable()
export class EventoDocumentRendererService {
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
    input: EventoDocumentInput,
    format: EventoDocumentFormat,
    pageSelection: EventoDocumentPageSelection,
  ): string {
    return this.documentCache.computeEtag({
      v: 'evento-v2',
      organizationName: input.organizationName,
      logoUrl: input.logoUrl ?? null,
      format,
      pageSelection,
      periodo: input.periodo,
      eventos: input.eventos.map((evento) => ({
        id: evento.id,
        titulo: evento.titulo,
        tipo: evento.tipo,
        status: evento.status,
        dataInicio: evento.dataInicio instanceof Date ? evento.dataInicio.toISOString() : String(evento.dataInicio),
        dataFim: evento.dataFim instanceof Date ? evento.dataFim.toISOString() : String(evento.dataFim),
        local: evento.local ?? null,
        descricao: evento.descricao ?? null,
        ministerios: evento.ministerios.map((m) => ({ id: m.id, nome: m.nome })),
      })),
    });
  }

  private computeTotalPages(
    input: EventoDocumentInput,
    format: EventoDocumentFormat,
  ): number {
    if (format === 'pdf') {
      return 1;
    }
    return createWeeklyEventoPages(input.eventos).length;
  }

  private validatePageSelection(
    format: EventoDocumentFormat,
    pageSelection: EventoDocumentPageSelection,
    totalWeeklyPages: number,
  ) {
    if (format === 'png' && pageSelection !== 'todas') {
      if (pageSelection < 1 || pageSelection > totalWeeklyPages) {
        throw new BadRequestException('A semana solicitada não existe nesta agenda.');
      }
    }
  }

  async renderExport(
    input: EventoDocumentInput,
    format: EventoDocumentFormat,
    pageSelection: EventoDocumentPageSelection = 1,
    options?: EventoRenderOptions,
  ): Promise<EventoExportResult> {
    const startedAt = performance.now();
    const rssBeforeMiB = toMiB(process.memoryUsage().rss);
    const effectiveSelection: EventoDocumentPageSelection =
      format === 'pdf' ? 1 : (pageSelection ?? 1);

    const totalPages = this.computeTotalPages(input, format);
    this.validatePageSelection(format, effectiveSelection, totalPages);

    const etag = this.computeEtag(input, format, effectiveSelection);

    if (this.documentCache.isNotModified(options?.ifNoneMatch, etag)) {
      const totalMs = Math.round(performance.now() - startedAt);
      this.chromiumRenderer.logCacheHitMetrics({
        eventName: 'evento_export',
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
        eventName: 'evento_export',
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
        eventName: 'evento_export',
        format,
        pageSelection: effectiveSelection,
        queryMs: options?.queryMs ?? 0,
      },
      async (browser: Browser, markLaunchMs: () => number) => {
        const cachedAfterQueue = this.documentCache.get(etag);
        if (cachedAfterQueue) {
          return cachedAfterQueue;
        }

        const resolvedLogoDataUri = await this.tenantLogo.resolveTenantLogoDataUri(input.logoUrl);
        const lookupLabsLogoDataUri = this.tenantLogo.getLookupLabsLogoDataUri();
        const shouldCacheResult = !input.logoUrl?.trim() || resolvedLogoDataUri !== null;
        const resolvedInput: EventoDocumentInput = {
          ...input,
          logoUrl: resolvedLogoDataUri,
        };

        const weeklyPages = format === 'png'
          ? createWeeklyEventoPages(resolvedInput.eventos)
          : [];
        const currentTotalPages = format === 'pdf' ? 1 : weeklyPages.length;

        const launchMs = markLaunchMs();
        const renderStart = performance.now();
        const page = await browser.newPage({
          viewport: format === 'pdf'
            ? { width: 794, height: 1123 }
            : { width: 1080, height: 1000 },
          deviceScaleFactor: 1,
        });

        try {
          const styles = renderBaseDocumentStyles();
          const head = `<meta charset="utf-8" /><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline';" />${styles}`;
          const responseEtag = shouldCacheResult ? etag : undefined;

          if (format === 'pdf') {
            const body = renderPdfDocument(resolvedInput, lookupLabsLogoDataUri);
            const agendaPageStyle = `<style>@page { size: A4 portrait; margin: 8mm 8mm 12mm 8mm; }</style>`;

            await page.setContent(
              `<!doctype html><html lang="pt-BR"><head>${head}${agendaPageStyle}</head><body>${body}</body></html>`,
              { waitUntil: 'domcontentloaded' },
            );
            await this.chromiumRenderer.waitForImages(page);

            const buffer = await page.pdf({
              format: 'A4',
              landscape: false,
              printBackground: true,
              preferCSSPageSize: true,
              displayHeaderFooter: true,
              headerTemplate: '<div></div>',
              footerTemplate: renderPdfFooterTemplate(lookupLabsLogoDataUri),
              margin: { top: '8mm', right: '8mm', bottom: '12mm', left: '8mm' },
            });
            const pdfPageCount = countPdfPagesFromBuffer(buffer);
            const renderMs = Math.round(performance.now() - renderStart);
            const result: RenderedDocument = {
              kind: 'single',
              buffer,
              mimeType: 'application/pdf',
              fileName: getEventoPdfFileName(resolvedInput),
              pageCount: pdfPageCount,
              etag: responseEtag,
            };
            if (shouldCacheResult) {
              this.documentCache.set(etag, result, buffer.byteLength);
            }
            this.chromiumRenderer.logRenderMetrics({
              eventName: 'evento_export',
              format,
              page: 1,
              pageCount: pdfPageCount,
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
              const body = renderWeeklyEventoPage(weeklyPage, resolvedInput, lookupLabsLogoDataUri);
              await page.setContent(
                `<!doctype html><html lang="pt-BR"><head>${head}</head><body>${body}</body></html>`,
                { waitUntil: 'domcontentloaded' },
              );
              await this.chromiumRenderer.waitForImages(page);
              const buffer = await page.screenshot({ type: 'png', fullPage: true });
              totalBufferBytes += buffer.byteLength;
              files.push({
                fileName: getWeeklyEventoPageFileName(weeklyPage, idx + 1),
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
              eventName: 'evento_export',
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
          const body = renderWeeklyEventoPage(weeklyPage, resolvedInput, lookupLabsLogoDataUri);
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
            fileName: getWeeklyEventoPageFileName(weeklyPage, selectedPage),
            pageCount: currentTotalPages,
            etag: responseEtag,
          };
          if (shouldCacheResult) {
            this.documentCache.set(etag, pngResult, buffer.byteLength);
          }
          this.chromiumRenderer.logRenderMetrics({
            eventName: 'evento_export',
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
