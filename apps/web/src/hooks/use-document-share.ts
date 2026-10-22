'use client';

import { useEffect, useRef, useState } from 'react';
import { api, buildQuery, HttpError } from '@/lib/api';
import { getDefaultSelectedWeek, type PngWeekSelection, type WeeklyExportOption } from '@/lib/export-calendar-weeks';

export interface PreparedFile {
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

export interface UseDocumentShareOptions<TFilter extends Record<string, any>> {
  endpoint: string;
  filter: TFilter;
  tenantLogoUrl?: string | null;
  weeklyOptions: WeeklyExportOption[];
  documentTitle?: string;
  defaultPdfFileName?: string;
  pngFileNamePrefix?: string;
  resetDependencies?: unknown[];
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export function downloadFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function formatExportErrorMessage(err: unknown, fallbackMessage: string): string {
  if (err instanceof HttpError) {
    if (err.status === 503) {
      return 'O servidor está processando outras exportações no momento. Aguarde alguns segundos e tente novamente.';
    }
    return err.message || fallbackMessage;
  }
  return fallbackMessage;
}

export function useDocumentShare<TFilter extends Record<string, any>>({
  endpoint,
  filter,
  tenantLogoUrl,
  weeklyOptions,
  documentTitle = 'Documento',
  defaultPdfFileName = 'documento.pdf',
  pngFileNamePrefix = 'documento',
  resetDependencies = [],
}: UseDocumentShareOptions<TFilter>) {
  const [exporting, setExporting] = useState<'pdf' | 'png' | null>(null);
  const [exportChoiceOpen, setExportChoiceOpen] = useState(false);
  const [exportDialogStep, setExportDialogStep] = useState<'format' | 'week'>('format');
  const [selectedPngWeek, setSelectedPngWeek] = useState<PngWeekSelection>(1);
  const [exportError, setExportError] = useState<string | null>(null);
  const [preparedFiles, setPreparedFiles] = useState<PreparedFile[]>([]);
  const sessionExportCacheRef = useRef<Map<string, PreparedFile[]>>(new Map());

  // Limpa cache de sessão se os dados mudarem
  const serializedFilter = JSON.stringify(filter);
  useEffect(() => {
    sessionExportCacheRef.current.clear();
    setPreparedFiles([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, tenantLogoUrl, serializedFilter, ...resetDependencies]);

  function getExportQuery(formato: 'pdf' | 'png', pagina?: PngWeekSelection) {
    return `${endpoint}${buildQuery({ ...filter, formato, pagina, _t: Date.now() })}`;
  }

  function getSessionCacheKey(formato: 'pdf' | 'png', pagina: PngWeekSelection = 1) {
    return JSON.stringify({
      v: 4,
      endpoint,
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
    const prepared: PreparedFile[] = [
      {
        blob: file.blob,
        fileName: file.fileName || defaultPdfFileName,
      },
    ];
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
      const prepared = (response.files || []).map((file, index) => {
        const pageNumber = String(index + 1).padStart(2, '0');
        const rawName = file.fileName || `${pngFileNamePrefix}-semana-${pageNumber}.png`;
        const hasNumberPrefix = /^\d{2}-/.test(rawName);
        const fileName = hasNumberPrefix ? rawName : `${pageNumber}-${rawName}`;
        return {
          blob: base64ToBlob(file.base64, file.mimeType || 'image/png'),
          fileName,
        };
      });
      sessionExportCacheRef.current.set(cacheKey, prepared);
      return prepared;
    }

    const file = await api.getFile(getExportQuery('png', selection), { cache: 'no-cache' });
    const prepared: PreparedFile[] = [
      {
        blob: file.blob,
        fileName: file.fileName || `${pngFileNamePrefix}-semana-${String(selection).padStart(2, '0')}.png`,
      },
    ];
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

  function handleChooseImageOption() {
    setSelectedPngWeek(getDefaultSelectedWeek(weeklyOptions, new Date()));
    setExportDialogStep('week');
  }

  async function downloadAllFiles(filesToDownload: PreparedFile[] = preparedFiles) {
    for (let i = 0; i < filesToDownload.length; i += 1) {
      downloadFile(filesToDownload[i].blob, filesToDownload[i].fileName);
      if (i < filesToDownload.length - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 350));
      }
    }
    setPreparedFiles([]);
    setExportError(null);
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

    const files = filesToShare.map(
      (file) =>
        new File([file.blob], file.fileName, {
          type: file.fileName.toLowerCase().endsWith('.pdf')
            ? 'application/pdf'
            : 'image/png',
        }),
    );

    if (typeof navigator.canShare === 'function' && !navigator.canShare({ files })) {
      if (!options?.silent) {
        downloadAllFiles(filesToShare);
      }
      return 'failed';
    }

    setExportError(null);
    try {
      await navigator.share({ files, title: documentTitle });
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

  async function handleFallbackShare() {
    const filesToShare = preparedFiles;
    setPreparedFiles([]);
    setExportError(null);
    await handleSharePreparedFiles(filesToShare);
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

  return {
    exporting,
    exportChoiceOpen,
    exportDialogStep,
    selectedPngWeek,
    exportError,
    preparedFiles,
    openExportDialog,
    closeExportDialog,
    setExportDialogStep,
    setSelectedPngWeek,
    handleChooseImageOption,
    handleExportPdf,
    handleExportImages,
    handleSharePreparedFiles,
    handleFallbackShare,
    downloadAllFiles,
    clearPreparedFiles: () => setPreparedFiles([]),
    clearExportError: () => setExportError(null),
  };
}
