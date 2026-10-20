'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { SkeletonList } from '@/components/app/skeleton';
import { EmptyState } from '@/components/app/empty-state';
import { EscalaPrintGrid } from '@/components/app/escala-print-grid';
import { EscalaReadonlyGrid } from '@/components/app/escala-readonly-grid';
import { CollapseButton } from '@/components/app/collapse-button';
import { FilterShell, FilterActions } from '@/components/app/filter-shell';
import { FilterInput, FilterSelect } from '@/components/app/filter-field';
import { StatCard } from '@/components/app/stat-card';
import { StatusBadge } from '@/components/app/status-badge';
import { PrintDocumentHeader, PrintScheduleFooter } from '@/components/app/print-layout';
import { useFilterState } from '@/hooks/use-filter-state';
import { useEscalasVisualizacao } from '@/hooks/use-escalas-visualizacao';
import { api, buildQuery, HttpError } from '@/lib/api';
import { STATUS_ESCALA_COLOR, STATUS_ESCALA_LABEL } from '@/lib/utils';
import { AuthUser, Escala, Ministerio } from '@/types';
import { ArrowLeft, Calendar, Check, Download, FileText, ImageDown, List, AlertTriangle, LoaderCircle, Share2, X } from 'lucide-react';

const MESES = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const MONTH_LABELS_LOWER = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

interface PreparedFile {
  blob: Blob;
  fileName: string;
}

interface BatchExportResponse {
  files: Array<{
    fileName: string;
    mimeType: string;
    base64: string;
  }>;
  pageCount: number;
}

interface WeeklyExportOption {
  page: number;
  weekStart: Date | null;
  weekEnd: Date | null;
  label: string;
  eventCount: number;
}

type PngWeekSelection = number | 'todas';

function startOfUtcWeek(date: Date) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (result.getUTCDay() + 6) % 7;
  result.setUTCDate(result.getUTCDate() - daysSinceMonday);
  return result;
}

function endOfUtcWeek(weekStart: Date) {
  const result = new Date(weekStart);
  result.setUTCDate(result.getUTCDate() + 6);
  return result;
}

function formatUtcDay(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
  }).format(date);
}

function buildWeeklyExportOptions(escalas: Escala[]): WeeklyExportOption[] {
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

function getDefaultSelectedWeek(options: WeeklyExportOption[], referenceDate: Date): number {
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

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function formatExportErrorMessage(err: unknown, fallbackMessage: string): string {
  if (err instanceof HttpError) {
    if (err.status === 503) {
      return 'O servidor está processando outras exportações no momento. Aguarde alguns segundos e tente novamente.';
    }
    return err.message || fallbackMessage;
  }
  return fallbackMessage;
}

export default function EscalasVisualizacaoPage() {
  const now = new Date();
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const [tenantName, setTenantName] = useState('OneElo');
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);
  const [printedAt] = useState(() => new Date());
  const [exporting, setExporting] = useState<'pdf' | 'png' | null>(null);
  const [exportChoiceOpen, setExportChoiceOpen] = useState(false);
  const [exportDialogStep, setExportDialogStep] = useState<'format' | 'week'>('format');
  const [selectedPngWeek, setSelectedPngWeek] = useState<PngWeekSelection>(1);
  const [exportError, setExportError] = useState<string | null>(null);
  const [preparedFiles, setPreparedFiles] = useState<PreparedFile[]>([]);
  const sessionExportCacheRef = useRef<Map<string, PreparedFile[]>>(new Map());
  const [escalasMinimizadas, setEscalasMinimizadas] = useState<Set<string>>(
    () => new Set(),
  );
  const { escalas, loading, error, filter, applyFilter, refetch } = useEscalasVisualizacao({
    mes: String(now.getMonth() + 1),
    ano: String(now.getFullYear()),
  });

  const {
    formState: filterState,
    setField: setFilterField,
    handleClear: handleClearFilters,
    handleSubmit: handleFilterSubmit,
  } = useFilterState({
    initialState: {
      ministerioId: '',
      status: '',
      mes: String(now.getMonth() + 1),
      ano: String(now.getFullYear()),
      pendentesApenas: false,
    },
    onApply: (filters) => {
      applyFilter({
        ministerioId: filters.ministerioId || undefined,
        status: filters.status || undefined,
        mes: filters.mes || undefined,
        ano: filters.ano || undefined,
        pendentesApenas: filters.pendentesApenas ? 'true' : undefined,
      });
    },
  });

  useEffect(() => {
    api.get<Ministerio[]>('/api/ministerios')
      .then((data) => setMinisterios(Array.isArray(data) ? data : []))
      .catch(() => setMinisterios([]));

    api.get<AuthUser>('/api/auth/me')
      .then((user) => {
        setTenantName(user.tenant?.nome || 'OneElo');
        setTenantLogoUrl(user.tenant?.logoUrl ?? null);
      })
      .catch(() => {
        setTenantName('OneElo');
        setTenantLogoUrl(null);
      });
  }, []);

  const weeklyOptions = useMemo(() => buildWeeklyExportOptions(escalas), [escalas]);

  useEffect(() => {
    sessionExportCacheRef.current.clear();
    setPreparedFiles([]);
  }, [escalas, tenantLogoUrl]);

  const totais = useMemo(() => {
    const dias = escalas.reduce((acc, escala) => acc + (escala.dias?.length || 0), 0);
    const itens = escalas.reduce((acc, escala) => (
      acc + (escala.dias || []).reduce((diaAcc, dia) => diaAcc + (dia.itens?.length || 0), 0)
    ), 0);
    const pendentes = escalas.reduce((acc, escala) => (
      acc + (escala.dias || []).reduce((diaAcc, dia) => (
        diaAcc + (
          escala.status === 'PUBLICADA'
            ? (dia.itens || []).filter((item) => item.statusConfirmacao === 'PENDENTE').length
            : 0
        )
      ), 0)
    ), 0);
    return { dias, itens, pendentes };
  }, [escalas]);

  function downloadFile(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function getExportQuery(formato: 'pdf' | 'png', pagina?: PngWeekSelection) {
    return `/api/escalas/exportacao${buildQuery({ ...filter, formato, pagina })}`;
  }

  function getSessionCacheKey(formato: 'pdf' | 'png', pagina: PngWeekSelection = 1) {
    return JSON.stringify({
      v: 3,
      filter,
      tenantLogoUrl,
      formato,
      pagina: formato === 'pdf' ? 1 : pagina,
    });
  }

  async function fetchPdfExport(): Promise<PreparedFile[]> {
    const cacheKey = getSessionCacheKey('pdf', 1);
    const cached = sessionExportCacheRef.current.get(cacheKey);
    if (cached) return cached;

    const file = await api.getFile(getExportQuery('pdf'), { cache: 'no-cache' });
    const prepared = [{
      blob: file.blob,
      fileName: file.fileName || 'escalas.pdf',
    }];
    sessionExportCacheRef.current.set(cacheKey, prepared);
    return prepared;
  }

  async function fetchPngExport(selection: PngWeekSelection): Promise<PreparedFile[]> {
    const cacheKey = getSessionCacheKey('png', selection);
    const cached = sessionExportCacheRef.current.get(cacheKey);
    if (cached) return cached;

    if (selection === 'todas') {
      const response = await api.get<BatchExportResponse>(
        getExportQuery('png', 'todas'),
        { cache: 'no-cache' },
      );
      const prepared = (response.files || []).map((file, index) => ({
        blob: base64ToBlob(file.base64, file.mimeType || 'image/png'),
        fileName: file.fileName || `escalas-pagina-${String(index + 1).padStart(2, '0')}.png`,
      }));
      sessionExportCacheRef.current.set(cacheKey, prepared);
      return prepared;
    }

    const file = await api.getFile(getExportQuery('png', selection), { cache: 'no-cache' });
    const prepared = [{
      blob: file.blob,
      fileName: file.fileName || `escalas-semana-${String(selection).padStart(2, '0')}.png`,
    }];
    sessionExportCacheRef.current.set(cacheKey, prepared);
    return prepared;
  }

  function openExportDialog() {
    setExportDialogStep('format');
    setSelectedPngWeek(getDefaultSelectedWeek(weeklyOptions, new Date()));
    setExportChoiceOpen(true);
  }

  function closeExportDialog() {
    setExportChoiceOpen(false);
    setExportDialogStep('format');
  }

  async function handleExportPdf() {
    closeExportDialog();
    setExporting('pdf');
    setExportError(null);
    setPreparedFiles([]);
    try {
      const prepared = await fetchPdfExport();
      setExporting(null);
      if ((await handleSharePreparedFiles(prepared, { silent: true })) === 'failed') {
        setPreparedFiles(prepared);
      }
    } catch (err) {
      setExportError(formatExportErrorMessage(err, 'Não foi possível exportar o PDF.'));
    } finally {
      setExporting(null);
    }
  }

  function handleChooseImageOption() {
    setSelectedPngWeek(getDefaultSelectedWeek(weeklyOptions, new Date()));
    setExportDialogStep('week');
  }

  async function handleExportImages(selection: PngWeekSelection = selectedPngWeek) {
    closeExportDialog();
    setExporting('png');
    setExportError(null);
    setPreparedFiles([]);
    try {
      const prepared = await fetchPngExport(selection);
      setExporting(null);
      if ((await handleSharePreparedFiles(prepared, { silent: true })) === 'failed') {
        setPreparedFiles(prepared);
      }
    } catch (err) {
      setExportError(formatExportErrorMessage(err, 'Não foi possível exportar as imagens.'));
    } finally {
      setExporting(null);
    }
  }

  function downloadAllFiles(filesToDownload: PreparedFile[] = preparedFiles) {
    filesToDownload.forEach((file) => {
      downloadFile(file.blob, file.fileName);
    });
    setPreparedFiles([]);
    setExportError(null);
  }

  async function handleFallbackShare() {
    const filesToShare = preparedFiles;
    setPreparedFiles([]);
    setExportError(null);
    await handleSharePreparedFiles(filesToShare);
  }

  async function handleSharePreparedFiles(
    filesToShare: PreparedFile[] = preparedFiles,
    options?: { silent?: boolean },
  ): Promise<'shared' | 'cancelled' | 'failed'> {
    if (filesToShare.length === 0) return 'failed';

    if (typeof navigator.share !== 'function') {
      if (!options?.silent) {
        downloadAllFiles(filesToShare);
      }
      return 'failed';
    }

    const files = filesToShare.map((file) => new File(
      [file.blob],
      file.fileName,
      { type: file.fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png' },
    ));

    if (typeof navigator.canShare === 'function' && !navigator.canShare({ files })) {
      if (!options?.silent) {
        downloadAllFiles(filesToShare);
      }
      return 'failed';
    }

    setExportError(null);
    try {
      await navigator.share({ files, title: 'Escalas' });
      setPreparedFiles([]);
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      if (!options?.silent) {
        downloadAllFiles(filesToShare);
      }
      return 'failed';
    }
  }

  function toggleEscalaMinimizada(escalaId: string) {
    setEscalasMinimizadas((current) => {
      const next = new Set(current);
      if (next.has(escalaId)) {
        next.delete(escalaId);
      } else {
        next.add(escalaId);
      }
      return next;
    });
  }

  return (
    <div className="p-6">
      <div className="no-print">
      <PageHeader
        title="Visualização Escalas"
        description="Acompanhe as escalas publicadas ou em rascunho em formato de leitura, sem controles de montagem."
        action={(
          <button
            onClick={openExportDialog}
            disabled={loading || escalas.length === 0 || exporting !== null}
            aria-haspopup="dialog"
            aria-expanded={exportChoiceOpen}
            aria-label="Compartilhar"
            title="Compartilhar"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          </button>
        )}
      />

      {exportChoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center sm:p-6">
          <button
            type="button"
            aria-label="Fechar opções de exportação"
            className="absolute inset-0 cursor-default"
            onClick={closeExportDialog}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-choice-title"
            className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                {exportDialogStep === 'week' && (
                  <button
                    type="button"
                    onClick={() => setExportDialogStep('format')}
                    aria-label="Voltar"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <h2 id="export-choice-title" className="text-lg font-black text-slate-900">
                  {exportDialogStep === 'format' ? 'Compartilhar como' : 'Selecionar semana'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeExportDialog}
                aria-label="Fechar"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {exportDialogStep === 'format' ? (
              <>
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="flex items-center gap-4 rounded-xl border border-slate-200 p-4 text-left hover:border-indigo-400 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <FileText className="h-5 w-5 shrink-0 text-indigo-700" />
                    <strong className="text-sm font-bold text-slate-900">PDF</strong>
                  </button>
                  <button
                    type="button"
                    onClick={handleChooseImageOption}
                    className="flex items-center gap-4 rounded-xl border border-slate-200 p-4 text-left hover:border-indigo-400 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <ImageDown className="h-5 w-5 shrink-0 text-indigo-700" />
                    <strong className="text-sm font-bold text-slate-900">Imagem</strong>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={closeExportDialog}
                  className="mt-4 w-full rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {weeklyOptions.map((option) => {
                    const isSelected = selectedPngWeek === option.page;
                    return (
                      <button
                        key={option.page}
                        type="button"
                        onClick={() => setSelectedPngWeek(option.page)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950'
                            : 'border-slate-200 bg-white text-slate-800 hover:border-indigo-300 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <strong className="block text-sm font-bold">{option.label}</strong>
                          <span className="text-xs text-slate-500">
                            {option.eventCount === 1
                              ? '1 evento'
                              : `${option.eventCount} eventos`}
                          </span>
                        </div>
                        {isSelected && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
                      </button>
                    );
                  })}

                  {weeklyOptions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSelectedPngWeek('todas')}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                        selectedPngWeek === 'todas'
                          ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950'
                          : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:border-indigo-300 hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <strong className="block text-sm font-bold">Todas as semanas</strong>
                        <span className="text-xs text-slate-500">
                          {weeklyOptions.length} imagens do período
                        </span>
                      </div>
                      {selectedPngWeek === 'todas' && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
                    </button>
                  )}
                </div>

                <div className="mt-5 grid gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportImages(selectedPngWeek)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700"
                  >
                    <ImageDown className="h-4 w-4" />
                    {selectedPngWeek === 'todas' ? 'Gerar todas as semanas' : 'Gerar imagem da semana'}
                  </button>
                  <button
                    type="button"
                    onClick={closeExportDialog}
                    className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {preparedFiles.length > 0 && (
        <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleFallbackShare()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700"
            >
              <Share2 className="h-4 w-4" />
              Compartilhar
            </button>
            <button
              onClick={() => downloadAllFiles()}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100"
            >
              <Download className="h-4 w-4" />
              Baixar
            </button>
          </div>
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard title="Escalas" value={escalas.length} icon={<Calendar className="w-5 h-5" />} color="indigo" />
        <StatCard title="Dias" value={totais.dias} icon={<List className="w-5 h-5" />} color="blue" />
        <StatCard title="Pendencias" value={totais.pendentes} icon={<AlertTriangle className="w-5 h-5" />} color="amber" />
      </div>

      <FilterShell
        onSubmit={handleFilterSubmit}
        actions={
          <FilterActions
            submitLabel="Filtrar"
            clearLabel="Limpar"
            reloadLabel="Recarregar"
            onClear={() => handleClearFilters()}
            onReload={refetch}
          />
        }
      >
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-5 items-end">
          <FilterSelect
            label="Ministério"
            value={filterState.ministerioId}
            onChange={(event) => setFilterField('ministerioId', event.target.value)}
          >
            <option value="">Todos</option>
            {ministerios.map((ministerio) => (
              <option key={ministerio.id} value={ministerio.id}>{ministerio.nome}</option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Status"
            value={filterState.status}
            onChange={(event) => setFilterField('status', event.target.value)}
          >
            <option value="">Todos</option>
            <option value="RASCUNHO">Rascunho</option>
            <option value="PUBLICADA">Publicada</option>
            <option value="ENCERRADA">Encerrada</option>
          </FilterSelect>
          <FilterSelect
            label="Mês"
            value={filterState.mes}
            onChange={(event) => setFilterField('mes', event.target.value)}
          >
            {MESES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </FilterSelect>
          <FilterInput
            label="Ano"
            type="number"
            min="2020"
            max="2100"
            value={filterState.ano}
            onChange={(event) => setFilterField('ano', event.target.value)}
          />
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors w-full cursor-pointer">
            <input
              type="checkbox"
              checked={filterState.pendentesApenas}
              onChange={(event) => setFilterField('pendentesApenas', event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
            />
            Pendentes
          </label>
        </div>
      </FilterShell>

      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {exportError && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {exportError}
        </div>
      )}

      {loading ? (
        <SkeletonList count={2} className="h-64" />
      ) : escalas.length === 0 ? (
        <EmptyState title="Nenhuma escala encontrada" description="Ajuste os filtros para localizar outras escalas." />
      ) : (
        <div className="space-y-6">
          {escalas.map((escala) => {
            const participacoes = (escala.dias || []).reduce((acc, dia) => acc + (dia.itens?.length || 0), 0);
            const minimizada = escalasMinimizadas.has(escala.id);
            return (
              <section key={escala.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-indigo-600">{escala.ministerio?.nome || 'Ministerio'}</p>
                    <h2 className="text-lg font-black text-gray-900">
                      {MESES.find((item) => item.value === String(escala.mes))?.label || escala.mes} de {escala.ano}
                    </h2>
                    {escala.observacoes && <p className="mt-1 text-sm text-gray-500">{escala.observacoes}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CollapseButton
                      collapsed={minimizada}
                      onToggle={() => toggleEscalaMinimizada(escala.id)}
                      collapseLabel="Minimizar escala"
                      expandLabel="Mostrar escala"
                    />
                    <StatusBadge
                      label={STATUS_ESCALA_LABEL[escala.status]}
                      className={`px-2.5 py-1 font-bold ${STATUS_ESCALA_COLOR[escala.status]}`}
                    />
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
                      {participacoes} participacoes
                    </span>
                  </div>
                </div>
                {!minimizada && <EscalaReadonlyGrid escala={escala} />}
              </section>
            );
          })}
        </div>
      )}
      </div>

      {!loading && escalas.length > 0 && (
        <div className="print-area print-document print-document--schedule hidden" aria-hidden="true">
          {escalas.map((escala) => (
            <section key={escala.id} className="print-page">
              <PrintDocumentHeader
                organizationName={tenantName}
                documentTitle={`Escala - ${escala.ministerio?.nome || 'Ministerio'}`}
                period={getMesLabel(escala)}
                logoUrl={tenantLogoUrl}
              />
              <EscalaPrintGrid escala={escala} />
              <PrintScheduleFooter printedAt={printedAt} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function getMesLabel(escala: Escala) {
  const mesLabel = MESES.find((item) => item.value === String(escala.mes))?.label || String(escala.mes);
  return `${mesLabel} de ${escala.ano}`;
}
