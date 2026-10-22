import type { DocumentHeaderInput } from './document-export.types';
import { escapeHtml } from './document-format.utils';

function formatIssuedAt(date: Date | string | null | undefined): string {
  const d = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(validDate);
}

export function renderDocumentHeader(
  title: string,
  subtitle: string,
  input: DocumentHeaderInput,
  lookupLabsLogoDataUri?: string | null,
  options?: { includeBrand?: boolean; issuedAt?: Date | string | null },
): string {
  const includeBrand = options?.includeBrand ?? true;
  const tenantLogo = input.logoUrl
    ? `<img class="tenant-logo" src="${escapeHtml(input.logoUrl)}" alt="" />`
    : '';
  const lookupLabsLogo = lookupLabsLogoDataUri
    ? `<img class="lookup-labs-logo" src="${escapeHtml(lookupLabsLogoDataUri)}" alt="Lookup Labs" />`
    : '';

  const brandHtml = includeBrand
    ? `<div class="brand">${lookupLabsLogo}<span>One Elo <small>Lookup Labs</small></span></div>`
    : '';

  const subtitleHtml = subtitle
    ? `<p class="header-subtitle">${escapeHtml(subtitle)}</p>`
    : '';

  const issuedDate = formatIssuedAt(options?.issuedAt ?? input.issuedAt);
  const issuedAtHtml = `<span class="header-issued-at">Emitido em ${escapeHtml(issuedDate)}</span>`;

  return `<header class="document-header">${tenantLogo}<div class="header-title"><h1>${escapeHtml(title)}</h1>${subtitleHtml}</div><div class="header-meta"><strong class="organization">${escapeHtml(input.organizationName)}</strong>${issuedAtHtml}<p class="header-period">${escapeHtml(subtitle)}</p></div></header>${brandHtml}`;
}

export function renderBaseDocumentStyles(): string {
  return `<style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #111827; font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: A4 landscape; margin: 7mm; }
    .agenda-pdf-document { width: 100%; box-sizing: border-box; background: #fff; }
    .agenda-pdf-document .document-header { margin-bottom: 4mm; }
    .agenda-pdf-document .weekday-group { margin: 0 0 4mm; }
    .agenda-pdf-document .weekday-group h2 { margin: 0; padding: 2mm 3mm; border-radius: 1.5mm 1.5mm 0 0; background: var(--group-color, #203d61); color: #fff; font-size: 8.5pt; font-weight: 800; letter-spacing: 0.3px; line-height: 1.2; text-transform: uppercase; break-after: avoid-page; page-break-after: avoid; }
    .agenda-pdf-document .general-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8pt; line-height: 1.25; }
    .agenda-pdf-document .general-table th { background: #f1f5f9; color: #334155; font-size: 7.2pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; padding: 1.8mm 2.2mm; border: 0.25mm solid #cbd5e1; }
    .agenda-pdf-document .general-table td { padding: 2mm 2.2mm; border: 0.25mm solid #e2e8f0; vertical-align: middle; font-size: 8pt; }
    .agenda-pdf-document .general-table tbody tr { break-inside: avoid; page-break-inside: avoid; }
    .agenda-pdf-document .general-table tbody tr:nth-child(even) td { background: #f8fafc; }
    .agenda-pdf-document .date-cell { white-space: nowrap; color: #0f172a; font-weight: 700; font-size: 8.2pt; }
    .agenda-pdf-document .date-time-chip { display: inline-block; margin-top: 0.8mm; padding: 0.4mm 1.8mm; border-radius: 1mm; background: #e2e8f0; color: #334155; font-size: 6.8pt; font-weight: 700; }
    .agenda-pdf-document .event-title-cell { text-align: left; }
    .agenda-pdf-document .event-title-text { font-weight: 700; font-size: 8.8pt; color: #0f172a; }
    .agenda-pdf-document .event-ministry-label { display: inline; margin-left: 1.2mm; font-size: 7.8pt; font-weight: 600; color: #64748b; }
    .agenda-pdf-document .tipo-badge { display: inline-block; padding: 0.7mm 2.2mm; border-radius: 999px; font-size: 6.8pt; font-weight: 700; background: #e0e7ff; color: #3730a3; white-space: nowrap; }
    .agenda-pdf-document .tipo-badge.ministerio { background: #fef3c7; color: #92400e; }
    .agenda-pdf-document .tipo-badge.reuniao { background: #f1f5f9; color: #475569; }
    .agenda-pdf-document .local-cell { color: #475569; font-weight: 600; font-size: 7.8pt; }
    .pdf-page { position: relative; width: 283mm; min-height: 194mm; padding: 2mm 2mm 12mm; break-after: page; page-break-after: always; background: #fff; }
    .pdf-page:last-child { break-after: auto; page-break-after: auto; }
    .document-header { min-height: 22mm; display: grid; grid-template-columns: 22mm minmax(0, 1fr) 62mm; align-items: center; gap: 4mm; margin-bottom: 4mm; }
    .document-header:not(:has(.tenant-logo)) { grid-template-columns: minmax(0, 1fr) 62mm; }
    .tenant-logo { width: 20mm; height: 20mm; object-fit: contain; background: transparent; }
    .header-title { grid-column: 2; min-width: 0; justify-self: center; text-align: center; }
    .document-header:not(:has(.tenant-logo)) .header-title { grid-column: 1; }
    .header-title h1 { margin: 0; color: #101827; font-size: 19pt; line-height: 1.05; font-weight: 800; text-align: center; }
    .header-subtitle { margin: 1.2mm 0 0; color: #475569; font-size: 10pt; font-weight: 700; text-align: center; }
    .header-meta { grid-column: 3; justify-self: end; min-width: 0; max-width: 62mm; text-align: right; }
    .document-header:not(:has(.tenant-logo)) .header-meta { grid-column: 2; }
    .header-period { margin: 0 0 1.2mm; color: #64748b; font-size: 10pt; font-weight: 700; }
    .pdf-page .header-period, .agenda-pdf-document .header-period { display: none; }
    .organization { display: block; color: #1e293b; font-size: 8.8pt; text-align: right; font-weight: 700; overflow-wrap: anywhere; line-height: 1.2; }
    .header-issued-at { display: block; margin-top: 1mm; color: #64748b; font-size: 7.2pt; font-weight: 500; text-align: right; }
    .brand { position: absolute; left: 2mm; bottom: 1mm; display: flex; align-items: center; gap: 2mm; color: #334155; font-size: 8pt; font-weight: 700; }
    .brand small { display: block; color: #64748b; font-size: 6.5pt; font-weight: 500; }
    .lookup-labs-logo { width: 8mm; height: 8mm; object-fit: contain; background: transparent; mix-blend-mode: multiply; }
    .page-context { margin: -2mm 0 2mm; color: #64748b; font-size: 7.5pt; text-align: center; }
    .weekday-group { margin: 0 0 4mm; break-inside: avoid; page-break-inside: avoid; }
    .weekday-group h2 { margin: 0; padding: 1.5mm 2mm; border-radius: 2mm 2mm 0 0; background: var(--group-color, #203d61); color: #fff; font-size: 8pt; line-height: 1.1; text-transform: uppercase; break-after: avoid-page; page-break-after: avoid; }
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
    .weekly-sheet .header-subtitle { display: none; }
    .weekly-sheet .header-issued-at { display: none; }
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
