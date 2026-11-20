import { Injectable } from '@nestjs/common';
import {
  FinancialTransactionStatus,
  FinancialTransactionType,
} from '@prisma/client';
import { performance } from 'node:perf_hooks';
import type { Browser } from 'playwright';
import {
  capitalize,
  CHROMIUM_LOW_MEMORY_ARGS,
  ChromiumRendererService,
  countPdfPagesFromBuffer,
  DocumentCacheService,
  escapeHtml,
  ExportServiceUnavailableException,
  MONTH_LABELS,
  renderBaseDocumentStyles,
  renderDocumentHeader,
  renderPdfFooterTemplate,
  TenantLogoService,
  toMiB,
} from '../../../common/export';
import { normalizeSearchText } from '../../../common/utils/search-text';
import {
  FINANCEIRO_PAYMENT_METHOD_LABELS,
  FINANCEIRO_STATUS_LABELS,
  FINANCEIRO_TYPE_LABELS,
  getFinancialTransactionDisplayTitle,
} from '../financial-transactions.service';
import type {
  FinanceiroDocumentInput,
  FinanceiroDocumentItem,
  FinanceiroExportResult,
  FinanceiroRenderOptions,
} from './financeiro-document.types';
import type { RenderedDocument } from '../../../common/export';

export { CHROMIUM_LOW_MEMORY_ARGS, ExportServiceUnavailableException };

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const utcDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const pad2 = (n: number) => String(n).padStart(2, '0');

export function parseFinanceiroDateUtc(
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
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return {
      year: parsed.getUTCFullYear(),
      month: parsed.getUTCMonth() + 1,
      day: parsed.getUTCDate(),
    };
  }
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    return {
      year: val.getUTCFullYear(),
      month: val.getUTCMonth() + 1,
      day: val.getUTCDate(),
    };
  }
  return null;
}

export function formatFinanceiroDateUtc(
  val: Date | string | null | undefined,
): string {
  if (!val) return '—';
  const date = typeof val === 'string' ? new Date(val) : val;
  if (Number.isNaN(date.getTime())) return '—';
  return utcDateFormatter.format(date);
}

export function formatFinanceiroCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatFinanceiroIssuedDateKey(
  date: Date | string | null | undefined,
): string {
  const parsed = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(safeDate);
}

export function formatFinanceiroPeriodSubtitle(
  input: FinanceiroDocumentInput,
): string {
  const start = parseFinanceiroDateUtc(input.periodo?.startDate);
  const end = parseFinanceiroDateUtc(input.periodo?.endDate);

  if (start && end) {
    const lastDayOfMonth = new Date(Date.UTC(start.year, start.month, 0)).getUTCDate();
    if (
      start.year === end.year &&
      start.month === end.month &&
      start.day === 1 &&
      end.day === lastDayOfMonth
    ) {
      const monthLabel = MONTH_LABELS[start.month - 1] ?? '';
      return `${capitalize(monthLabel)} de ${start.year}`;
    }
    if (
      start.year === end.year &&
      start.month === end.month &&
      start.day === end.day
    ) {
      return `${pad2(start.day)}/${pad2(start.month)}/${start.year}`;
    }
    return `${pad2(start.day)}/${pad2(start.month)}/${start.year} a ${pad2(end.day)}/${pad2(end.month)}/${end.year}`;
  }

  if (start && !end) {
    return `A partir de ${pad2(start.day)}/${pad2(start.month)}/${start.year}`;
  }

  if (!start && end) {
    return `Até ${pad2(end.day)}/${pad2(end.month)}/${end.year}`;
  }

  if (input.items.length > 0) {
    const first = parseFinanceiroDateUtc(input.items[0].date);
    const last = parseFinanceiroDateUtc(input.items[input.items.length - 1].date);
    if (first && last) {
      if (
        first.year === last.year &&
        first.month === last.month &&
        first.day === last.day
      ) {
        return `${pad2(first.day)}/${pad2(first.month)}/${first.year}`;
      }
      return `${pad2(first.day)}/${pad2(first.month)}/${first.year} a ${pad2(last.day)}/${pad2(last.month)}/${last.year}`;
    }
  }

  return 'Movimentações financeiras';
}

export function getFinanceiroPdfFileName(
  input: FinanceiroDocumentInput,
): string {
  const start = parseFinanceiroDateUtc(input.periodo?.startDate);
  const end = parseFinanceiroDateUtc(input.periodo?.endDate);

  if (start && end) {
    const lastDayOfMonth = new Date(Date.UTC(start.year, start.month, 0)).getUTCDate();
    if (
      start.year === end.year &&
      start.month === end.month &&
      start.day === 1 &&
      end.day === lastDayOfMonth
    ) {
      return `extrato-financeiro-${start.year}-${pad2(start.month)}.pdf`;
    }
    if (
      start.year === end.year &&
      start.month === end.month &&
      start.day === end.day
    ) {
      return `extrato-financeiro-${start.year}-${pad2(start.month)}-${pad2(start.day)}.pdf`;
    }
    return `extrato-financeiro-${start.year}-${pad2(start.month)}-${pad2(start.day)}-a-${end.year}-${pad2(end.month)}-${pad2(end.day)}.pdf`;
  }

  if (start && !end) {
    return `extrato-financeiro-a-partir-de-${start.year}-${pad2(start.month)}-${pad2(start.day)}.pdf`;
  }

  if (!start && end) {
    return `extrato-financeiro-ate-${end.year}-${pad2(end.month)}-${pad2(end.day)}.pdf`;
  }

  if (input.items.length > 0) {
    const first = parseFinanceiroDateUtc(input.items[0].date);
    const last = parseFinanceiroDateUtc(input.items[input.items.length - 1].date);
    if (first && last) {
      if (first.year === last.year && first.month === last.month) {
        return `extrato-financeiro-${first.year}-${pad2(first.month)}.pdf`;
      }
      return `extrato-financeiro-${first.year}-${pad2(first.month)}-${pad2(first.day)}-a-${last.year}-${pad2(last.month)}-${pad2(last.day)}.pdf`;
    }
  }

  return 'extrato-financeiro.pdf';
}

export function buildTransactionDetailSubline(
  item: FinanceiroDocumentItem,
  displayTitle: string,
): string {
  const parts: string[] = [];
  const normalizedTitle = normalizeSearchText(displayTitle);
  const seen = new Set<string>(normalizedTitle ? [normalizedTitle] : []);

  const appendIfUnique = (raw: string | null | undefined, prefix?: string) => {
    const trimmed = raw?.trim();
    if (!trimmed) return;
    const normalized = normalizeSearchText(trimmed);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    parts.push(prefix ? `${prefix}: ${trimmed}` : trimmed);
  };

  // Preferir nome completo do membro; evitar duplicar counterpartyName quando já derivado do membro
  const personName = item.member?.nome?.trim() || item.counterpartyName?.trim() || null;
  appendIfUnique(personName);
  appendIfUnique(item.evento?.titulo, 'Evento');

  if (item.paymentMethod) {
    const paymentLabel =
      FINANCEIRO_PAYMENT_METHOD_LABELS[item.paymentMethod] ?? item.paymentMethod;
    parts.push(paymentLabel);
  }

  return parts.join(' · ');
}

function renderFiltersBar(input: FinanceiroDocumentInput): string {
  if (!input.appliedFilterLabels.length) return '';

  const chips = input.appliedFilterLabels
    .map(
      (item) =>
        `<span class="fin-filter-chip"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</span>`,
    )
    .join('');

  return `<div class="fin-filters-bar"><span class="fin-filters-label">Filtros aplicados:</span><div class="fin-filters-chips">${chips}</div></div>`;
}

function renderStatusBadgeClass(status: FinancialTransactionStatus): string {
  switch (status) {
    case FinancialTransactionStatus.CONFIRMED:
      return 'fin-badge fin-status-confirmed';
    case FinancialTransactionStatus.PENDING:
      return 'fin-badge fin-status-pending';
    case FinancialTransactionStatus.CANCELLED:
      return 'fin-badge fin-status-cancelled';
    default:
      return 'fin-badge fin-status-draft';
  }
}

function renderRows(items: FinanceiroDocumentItem[]): string {
  return items
    .map((item) => {
      const displayTitle = getFinancialTransactionDisplayTitle(item);
      const subline = buildTransactionDetailSubline(item, displayTitle);
      const dateStr = formatFinanceiroDateUtc(item.date);
      const paidAtStr =
        item.status === FinancialTransactionStatus.CONFIRMED && item.paidAt
          ? formatFinanceiroDateUtc(item.paidAt)
          : '—';
      const installmentStr =
        item.installmentNumber && item.totalInstallments
          ? `${item.installmentNumber}/${item.totalInstallments}`
          : '—';
      const typeLabel = FINANCEIRO_TYPE_LABELS[item.type] ?? item.type;
      const statusLabel = FINANCEIRO_STATUS_LABELS[item.status] ?? item.status;
      const isIncome = item.type === FinancialTransactionType.INCOME;
      const isCancelled = item.status === FinancialTransactionStatus.CANCELLED;
      const sign = isIncome ? '+' : '-';
      const formattedAmount = `${sign} ${formatFinanceiroCurrency(item.amount)}`;
      const amountClass = isCancelled
        ? 'fin-amount-cell fin-amount-cancelled'
        : isIncome
          ? 'fin-amount-cell fin-amount-income'
          : 'fin-amount-cell fin-amount-expense';
      const typeClass = isIncome
        ? 'fin-badge fin-type-income'
        : 'fin-badge fin-type-expense';

      return `<tr class="${isCancelled ? 'fin-row--cancelled' : ''}">
        <td class="fin-date-cell">${escapeHtml(dateStr)}</td>
        <td class="fin-date-cell fin-muted-cell">${escapeHtml(paidAtStr)}</td>
        <td class="fin-desc-cell">
          <div class="fin-title">${escapeHtml(displayTitle)}</div>
          ${subline ? `<div class="fin-subline">${escapeHtml(subline)}</div>` : ''}
        </td>
        <td class="fin-center-cell">${escapeHtml(installmentStr)}</td>
        <td class="fin-center-cell"><span class="${typeClass}">${escapeHtml(typeLabel)}</span></td>
        <td class="fin-center-cell"><span class="${renderStatusBadgeClass(item.status)}">${escapeHtml(statusLabel)}</span></td>
        <td class="fin-text-cell">${escapeHtml(item.account.name)}</td>
        <td class="fin-text-cell">${escapeHtml(item.category.name)}</td>
        <td class="${amountClass}">${escapeHtml(formattedAmount)}</td>
      </tr>`;
    })
    .join('');
}

function formatSignedCurrency(value: number): string {
  if (value > 0) return `+ ${formatFinanceiroCurrency(value)}`;
  if (value < 0) return `- ${formatFinanceiroCurrency(Math.abs(value))}`;
  return formatFinanceiroCurrency(0);
}

function renderTotalsBox(input: FinanceiroDocumentInput): string {
  const { totals, filters, truncated, totalMatchingCount, items } = input;
  const countLabel =
    totals.count === 1 ? '1 lançamento listado' : `${totals.count} lançamentos listados`;

  const truncationHtml = truncated
    ? `<div class="fin-truncation-note">Exibindo os ${items.length} lançamentos mais recentes de ${totalMatchingCount} encontrados — os totais abaixo refletem exclusivamente os itens listados.</div>`
    : '';

  const isFilteredCancelled =
    filters.status === FinancialTransactionStatus.CANCELLED ||
    (totals.cancelledCount > 0 &&
      totals.confirmedCount === 0 &&
      totals.pendingCount === 0 &&
      totals.draftCount === 0);

  const isFilteredDraft =
    filters.status === FinancialTransactionStatus.DRAFT ||
    (totals.draftCount > 0 &&
      totals.confirmedCount === 0 &&
      totals.pendingCount === 0 &&
      totals.cancelledCount === 0);

  const isFilteredPendingOnly =
    filters.status === FinancialTransactionStatus.PENDING ||
    (totals.pendingCount > 0 && totals.confirmedCount === 0 && !isFilteredCancelled && !isFilteredDraft);

  let title = 'Total dos Lançamentos Listados';
  let metricsHtml = '';
  const footnotes: string[] = [];

  if (isFilteredCancelled) {
    title = 'Total Listado (Cancelados — não contabilizados no resultado)';
    metricsHtml = `
      <div class="fin-total-item">
        <span>Entradas canceladas</span>
        <strong class="fin-val-muted">${escapeHtml(formatFinanceiroCurrency(totals.cancelledIncome))}</strong>
      </div>
      <div class="fin-total-item">
        <span>Saídas canceladas</span>
        <strong class="fin-val-muted">${escapeHtml(formatFinanceiroCurrency(totals.cancelledExpense))}</strong>
      </div>
      <div class="fin-total-item">
        <span>Itens cancelados</span>
        <strong>${totals.cancelledCount}</strong>
      </div>`;
  } else if (isFilteredDraft) {
    title = 'Total Listado (Rascunhos — não contabilizados no resultado)';
    metricsHtml = `
      <div class="fin-total-item">
        <span>Entradas em rascunho</span>
        <strong class="fin-val-muted">${escapeHtml(formatFinanceiroCurrency(totals.draftIncome))}</strong>
      </div>
      <div class="fin-total-item">
        <span>Saídas em rascunho</span>
        <strong class="fin-val-muted">${escapeHtml(formatFinanceiroCurrency(totals.draftExpense))}</strong>
      </div>
      <div class="fin-total-item">
        <span>Itens em rascunho</span>
        <strong>${totals.draftCount}</strong>
      </div>`;
  } else if (isFilteredPendingOnly) {
    title = 'Total dos Lançamentos Pendentes Listados';
    const pendingNetClass =
      totals.pendingNet > 0
        ? 'fin-val-income'
        : totals.pendingNet < 0
          ? 'fin-val-expense'
          : '';
    metricsHtml = `
      <div class="fin-total-item">
        <span>A Receber (Pendente)</span>
        <strong class="fin-val-income">${escapeHtml(formatFinanceiroCurrency(totals.pendingIncome))}</strong>
      </div>
      <div class="fin-total-item">
        <span>A Pagar (Pendente)</span>
        <strong class="fin-val-expense">${escapeHtml(formatFinanceiroCurrency(totals.pendingExpense))}</strong>
      </div>
      <div class="fin-total-item">
        <span>Saldo Previsto (Pendentes)</span>
        <strong class="${pendingNetClass}">${escapeHtml(formatSignedCurrency(totals.pendingNet))}</strong>
      </div>`;
  } else {
    const netClass =
      totals.confirmedNet > 0
        ? 'fin-val-income'
        : totals.confirmedNet < 0
          ? 'fin-val-expense'
          : '';
    metricsHtml = `
      <div class="fin-total-item">
        <span>Entradas confirmadas</span>
        <strong class="fin-val-income">${escapeHtml(formatFinanceiroCurrency(totals.confirmedIncome))}</strong>
      </div>
      <div class="fin-total-item">
        <span>Saídas confirmadas</span>
        <strong class="fin-val-expense">${escapeHtml(formatFinanceiroCurrency(totals.confirmedExpense))}</strong>
      </div>
      <div class="fin-total-item fin-total-item--highlight">
        <span>Resultado (Confirmados)</span>
        <strong class="${netClass}">${escapeHtml(formatSignedCurrency(totals.confirmedNet))}</strong>
      </div>`;

    if (totals.pendingCount > 0) {
      footnotes.push(
        `Pendentes na lista (${totals.pendingCount}): A Receber ${formatFinanceiroCurrency(totals.pendingIncome)} · A Pagar ${formatFinanceiroCurrency(totals.pendingExpense)}`,
      );
    }
    if (totals.draftCount > 0) {
      footnotes.push(
        `Rascunhos fora do resultado (${totals.draftCount}): Entradas ${formatFinanceiroCurrency(totals.draftIncome)} · Saídas ${formatFinanceiroCurrency(totals.draftExpense)}`,
      );
    }
    if (totals.cancelledCount > 0) {
      footnotes.push(
        `Cancelados fora do resultado (${totals.cancelledCount}): Entradas ${formatFinanceiroCurrency(totals.cancelledIncome)} · Saídas ${formatFinanceiroCurrency(totals.cancelledExpense)}`,
      );
    }
  }

  const footnotesHtml = footnotes.length
    ? `<div class="fin-totals-footnotes">${footnotes.map((note) => `<div>${escapeHtml(note)}</div>`).join('')}</div>`
    : '';

  return `<section class="fin-totals-box">
    <div class="fin-totals-header">
      <strong>${escapeHtml(title)}</strong>
      <span class="fin-totals-count">${escapeHtml(countLabel)}</span>
    </div>
    ${truncationHtml}
    <div class="fin-totals-grid">${metricsHtml}</div>
    ${footnotesHtml}
  </section>`;
}

export function renderFinanceiroStyles(): string {
  return `<style>
    @page { size: A4 landscape; margin: 8mm 8mm 12mm 8mm; }
    .financeiro-pdf-document { width: 100%; box-sizing: border-box; background: #fff; }
    .financeiro-pdf-document .document-header { margin-bottom: 3.5mm; }
    .financeiro-pdf-document .header-period { display: none; }
    .fin-filters-bar { display: flex; align-items: baseline; flex-wrap: wrap; gap: 1.5mm 3mm; margin: 0 0 3.5mm; padding: 1.8mm 2.8mm; border: 0.25mm solid #e2e8f0; border-radius: 1.5mm; background: #f8fafc; font-size: 7.4pt; color: #334155; }
    .fin-filters-label { font-weight: 800; text-transform: uppercase; letter-spacing: 0.25px; color: #475569; font-size: 6.8pt; white-space: nowrap; }
    .fin-filters-chips { display: flex; flex-wrap: wrap; gap: 1.5mm 2.5mm; }
    .fin-filter-chip { color: #1e293b; }
    .fin-filter-chip strong { color: #475569; font-weight: 700; }
    .fin-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 7.6pt; line-height: 1.25; }
    .fin-table thead { display: table-header-group; }
    .fin-table th { background: #f1f5f9; color: #334155; font-size: 6.8pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.25px; padding: 1.8mm 1.8mm; border: 0.25mm solid #cbd5e1; text-align: left; }
    .fin-table th.fin-th-center { text-align: center; }
    .fin-table th.fin-th-right { text-align: right; }
    .fin-table td { padding: 1.7mm 1.8mm; border: 0.22mm solid #e2e8f0; vertical-align: middle; overflow-wrap: anywhere; color: #0f172a; }
    .fin-table tbody tr { break-inside: avoid; page-break-inside: avoid; }
    .fin-table tbody tr:nth-child(even) td { background: #f8fafc; }
    .fin-table tbody tr.fin-row--cancelled td { color: #64748b; }
    .fin-date-cell { white-space: nowrap; text-align: center; font-variant-numeric: tabular-nums; font-weight: 600; font-size: 7.4pt; }
    .fin-muted-cell { color: #64748b; font-weight: 500; }
    .fin-desc-cell { text-align: left; }
    .fin-title { font-weight: 700; color: #0f172a; font-size: 7.8pt; }
    .fin-row--cancelled .fin-title { color: #64748b; }
    .fin-subline { margin-top: 0.5mm; font-size: 6.7pt; color: #64748b; line-height: 1.2; }
    .fin-center-cell { text-align: center; white-space: nowrap; }
    .fin-text-cell { text-align: left; font-size: 7.4pt; color: #334155; }
    .fin-amount-cell { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 800; font-size: 7.8pt; }
    .fin-table td.fin-amount-income { color: #047857; }
    .fin-table td.fin-amount-expense { color: #be123c; }
    .fin-table td.fin-amount-cancelled { color: #94a3b8; text-decoration: line-through; font-weight: 600; }
    .fin-badge { display: inline-block; padding: 0.5mm 1.8mm; border-radius: 999px; font-size: 6.5pt; font-weight: 700; white-space: nowrap; }
    .fin-type-income { background: #ccfbf1; color: #0f766e; }
    .fin-type-expense { background: #ffe4e6; color: #be123c; }
    .fin-status-confirmed { background: #d1fae5; color: #047857; }
    .fin-status-pending { background: #fef3c7; color: #b45309; }
    .fin-status-draft { background: #f1f5f9; color: #475569; }
    .fin-status-cancelled { background: #ffe4e6; color: #be123c; }
    .fin-totals-box { margin-top: 4mm; padding: 3mm 3.5mm; border: 0.3mm solid #cbd5e1; border-radius: 1.8mm; background: #f8fafc; break-inside: avoid; page-break-inside: avoid; }
    .fin-totals-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.2mm; padding-bottom: 1.6mm; border-bottom: 0.22mm solid #e2e8f0; }
    .fin-totals-header strong { font-size: 8.4pt; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.25px; }
    .fin-totals-count { font-size: 7.4pt; font-weight: 700; color: #475569; }
    .fin-truncation-note { margin-bottom: 2.2mm; padding: 1.4mm 2.2mm; border-radius: 1.2mm; background: #fef3c7; border: 0.22mm solid #fcd34d; color: #92400e; font-size: 7.2pt; font-weight: 600; }
    .fin-totals-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3mm; }
    .fin-total-item { padding: 2mm 2.5mm; border-radius: 1.2mm; border: 0.22mm solid #e2e8f0; background: #fff; }
    .fin-total-item--highlight { border-color: #cbd5e1; background: #f1f5f9; }
    .fin-total-item span { display: block; font-size: 6.8pt; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.2px; }
    .fin-total-item strong { display: block; margin-top: 0.8mm; font-size: 10pt; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
    .fin-val-income { color: #047857 !important; }
    .fin-val-expense { color: #be123c !important; }
    .fin-val-muted { color: #475569 !important; }
    .fin-totals-footnotes { margin-top: 2mm; padding-top: 1.6mm; border-top: 0.2mm dashed #cbd5e1; font-size: 7pt; color: #475569; line-height: 1.35; }
  </style>`;
}

export function renderFinanceiroPdfHtml(
  input: FinanceiroDocumentInput,
  lookupLabsLogoDataUri?: string | null,
): string {
  const title = 'Extrato Financeiro';
  const subtitle = formatFinanceiroPeriodSubtitle(input);

  return `<div class="financeiro-pdf-document">
    ${renderDocumentHeader(title, subtitle, input, lookupLabsLogoDataUri, {
      includeBrand: false,
      issuedAt: input.issuedAt,
    })}
    ${renderFiltersBar(input)}
    <main>
      <table class="fin-table">
        <colgroup>
          <col style="width:7.5%" />
          <col style="width:7.5%" />
          <col style="width:28%" />
          <col style="width:6%" />
          <col style="width:7%" />
          <col style="width:8.5%" />
          <col style="width:12%" />
          <col style="width:12.5%" />
          <col style="width:11%" />
        </colgroup>
        <thead>
          <tr>
            <th class="fin-th-center">Data</th>
            <th class="fin-th-center">Liquidação</th>
            <th>Descrição / Detalhes</th>
            <th class="fin-th-center">Parcela</th>
            <th class="fin-th-center">Tipo</th>
            <th class="fin-th-center">Status</th>
            <th>Conta</th>
            <th>Categoria</th>
            <th class="fin-th-right">Valor</th>
          </tr>
        </thead>
        <tbody>${renderRows(input.items)}</tbody>
      </table>
      ${renderTotalsBox(input)}
    </main>
  </div>`;
}

@Injectable()
export class FinanceiroDocumentRendererService {
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

  computeEtag(input: FinanceiroDocumentInput): string {
    return this.documentCache.computeEtag({
      v: 'financeiro-v1',
      tenantId: input.tenantId,
      issuedDateKey: formatFinanceiroIssuedDateKey(input.issuedAt),
      organizationName: input.organizationName,
      logoUrl: input.logoUrl ?? null,
      periodo: input.periodo,
      filters: input.filters,
      appliedFilterLabels: input.appliedFilterLabels,
      truncated: input.truncated,
      totalMatchingCount: input.totalMatchingCount,
      totals: input.totals,
      items: input.items.map((item) => ({
        id: item.id,
        type: item.type,
        status: item.status,
        date: item.date instanceof Date ? item.date.toISOString() : String(item.date),
        paidAt: item.paidAt ? (item.paidAt instanceof Date ? item.paidAt.toISOString() : String(item.paidAt)) : null,
        updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : String(item.updatedAt),
        amount: item.amount,
        description: item.description ?? null,
        paymentMethod: item.paymentMethod ?? null,
        counterpartyName: item.counterpartyName ?? null,
        installmentNumber: item.installmentNumber ?? null,
        totalInstallments: item.totalInstallments ?? null,
        account: item.account,
        category: item.category,
        evento: item.evento,
        member: item.member,
      })),
    });
  }

  async renderPdf(
    input: FinanceiroDocumentInput,
    options?: FinanceiroRenderOptions,
  ): Promise<FinanceiroExportResult> {
    const startedAt = performance.now();
    const rssBeforeMiB = toMiB(process.memoryUsage().rss);
    const etag = this.computeEtag(input);
    const cached = this.documentCache.get(etag);

    if (this.documentCache.isNotModified(options?.ifNoneMatch, etag)) {
      const pageCount = cached?.pageCount ?? 1;
      const totalMs = Math.round(performance.now() - startedAt);
      this.chromiumRenderer.logCacheHitMetrics({
        eventName: 'financeiro_export',
        format: 'pdf',
        page: 1,
        pageCount,
        queryMs: options?.queryMs ?? 0,
        totalMs,
        bufferBytes: 0,
        rssBeforeMiB,
        cache: 'etag',
      });
      return {
        kind: 'not-modified',
        etag,
        pageCount,
        notModified: true,
      };
    }

    if (cached && cached.kind !== 'batch') {
      const totalMs = Math.round(performance.now() - startedAt);
      this.chromiumRenderer.logCacheHitMetrics({
        eventName: 'financeiro_export',
        format: 'pdf',
        page: 1,
        pageCount: cached.pageCount,
        queryMs: options?.queryMs ?? 0,
        totalMs,
        bufferBytes: cached.buffer.byteLength,
        rssBeforeMiB,
        cache: 'hit',
      });
      return cached;
    }

    return this.chromiumRenderer.runSerialRender(
      {
        eventName: 'financeiro_export',
        format: 'pdf',
        pageSelection: 1,
        queryMs: options?.queryMs ?? 0,
      },
      async (browser: Browser, markLaunchMs: () => number) => {
        const cachedAfterQueue = this.documentCache.get(etag);
        if (cachedAfterQueue && cachedAfterQueue.kind !== 'batch') {
          return cachedAfterQueue;
        }

        const resolvedLogoDataUri = await this.tenantLogo.resolveTenantLogoDataUri(input.logoUrl);
        const lookupLabsLogoDataUri = this.tenantLogo.getLookupLabsLogoDataUri();
        const shouldCacheResult = !input.logoUrl?.trim() || resolvedLogoDataUri !== null;
        const resolvedInput: FinanceiroDocumentInput = {
          ...input,
          logoUrl: resolvedLogoDataUri,
        };

        const launchMs = markLaunchMs();
        const renderStart = performance.now();
        const page = await browser.newPage({
          viewport: { width: 1123, height: 794 },
          deviceScaleFactor: 1,
        });

        try {
          const baseStyles = renderBaseDocumentStyles();
          const financeiroStyles = renderFinanceiroStyles();
          const head = `<meta charset="utf-8" /><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline';" />${baseStyles}${financeiroStyles}`;
          const body = renderFinanceiroPdfHtml(resolvedInput, lookupLabsLogoDataUri);

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
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: renderPdfFooterTemplate(lookupLabsLogoDataUri, {
              showPageNumbers: true,
            }),
            margin: { top: '8mm', right: '8mm', bottom: '12mm', left: '8mm' },
          });

          const pdfPageCount = countPdfPagesFromBuffer(buffer);
          const renderMs = Math.round(performance.now() - renderStart);
          const responseEtag = shouldCacheResult ? etag : undefined;
          const result: RenderedDocument = {
            kind: 'single',
            buffer,
            mimeType: 'application/pdf',
            fileName: getFinanceiroPdfFileName(resolvedInput),
            pageCount: pdfPageCount,
            etag: responseEtag,
          };

          if (shouldCacheResult) {
            this.documentCache.set(etag, result, buffer.byteLength);
          }

          this.chromiumRenderer.logRenderMetrics({
            eventName: 'financeiro_export',
            format: 'pdf',
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
        } finally {
          await page.close().catch(() => undefined);
        }
      },
    );
  }
}
