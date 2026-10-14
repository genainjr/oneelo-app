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
import { Calendar, List, AlertTriangle, Download, FileText, ImageDown, LoaderCircle, Share2, X } from 'lucide-react';

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

interface PreparedFile {
  blob: Blob;
  fileName: string;
}

interface PreparedExportCacheEntry {
  key: string;
  promise: Promise<PreparedFile[]>;
  startedAt: number;
}

export default function EscalasVisualizacaoPage() {
  const now = new Date();
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const [tenantName, setTenantName] = useState('OneElo');
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);
  const [printedAt] = useState(() => new Date());
  const [exporting, setExporting] = useState<'pdf' | 'png' | null>(null);
  const [exportChoiceOpen, setExportChoiceOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [preparedFiles, setPreparedFiles] = useState<PreparedFile[]>([]);
  const exportCacheRef = useRef<{ pdf?: PreparedExportCacheEntry; png?: PreparedExportCacheEntry }>({});
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

  function getExportQuery(formato: 'pdf' | 'png', pagina?: number) {
    return `/api/escalas/exportacao${buildQuery({ ...filter, formato, pagina })}`;
  }

  async function fetchPdfExport(): Promise<PreparedFile[]> {
    const file = await api.getFile(getExportQuery('pdf'));
    return [{
      blob: file.blob,
      fileName: file.fileName || 'escalas.pdf',
    }];
  }

  async function fetchPngExport(): Promise<PreparedFile[]> {
    const firstFile = await api.getFile(getExportQuery('png', 1));
    const files = [firstFile];
    const rawCount = firstFile.headers.get('X-Document-Page-Count');
    const headerCount = rawCount === null ? Number.NaN : Number(rawCount);

    if (Number.isNaN(headerCount)) {
      for (let page = 2; page <= 30; page += 1) {
        try {
          files.push(await api.getFile(getExportQuery('png', page)));
        } catch (err) {
          if (err instanceof HttpError && (err.status === 400 || err.status === 404)) break;
          throw err;
        }
      }
    } else if (headerCount > files.length) {
      const remaining = await Promise.all(
        Array.from({ length: headerCount - files.length }, (_, index) =>
          api.getFile(getExportQuery('png', files.length + index + 1))),
      );
      files.push(...remaining);
    }

    return files.map((file, index) => ({
      blob: file.blob,
      fileName: file.fileName || `escalas-pagina-${String(index + 1).padStart(2, '0')}.png`,
    }));
  }

  function getPreparedExport(kind: 'pdf' | 'png'): Promise<PreparedFile[]> {
    const key = JSON.stringify(filter);
    const cached = exportCacheRef.current[kind];
    if (cached && cached.key === key && Date.now() - cached.startedAt < 60_000) {
      return cached.promise;
    }

    const promise = kind === 'pdf' ? fetchPdfExport() : fetchPngExport();
    exportCacheRef.current[kind] = { key, promise, startedAt: Date.now() };
    promise.catch(() => {
      if (exportCacheRef.current[kind]?.promise === promise) {
        exportCacheRef.current[kind] = undefined;
      }
    });
    return promise;
  }

  function prefetchExports() {
    getPreparedExport('pdf');
    getPreparedExport('png');
  }

  async function handleExportPdf() {
    setExportChoiceOpen(false);
    setExporting('pdf');
    setExportError(null);
    setPreparedFiles([]);
    try {
      const prepared = await getPreparedExport('pdf');
      setPreparedFiles(prepared);
      setExporting(null);
      await handleSharePreparedFiles(prepared);
    } catch (err) {
      setExportError(err instanceof HttpError ? err.message : 'Nao foi possivel exportar o PDF.');
    } finally {
      setExporting(null);
    }
  }

  async function handleExportImages() {
    setExportChoiceOpen(false);
    setExporting('png');
    setExportError(null);
    setPreparedFiles([]);
    try {
      const prepared = await getPreparedExport('png');
      setPreparedFiles(prepared);
      setExporting(null);
      await handleSharePreparedFiles(prepared);
    } catch (err) {
      setExportError(err instanceof HttpError ? err.message : 'Nao foi possivel exportar as imagens.');
    } finally {
      setExporting(null);
    }
  }

  function downloadAllFiles(filesToDownload: PreparedFile[] = preparedFiles) {
    filesToDownload.forEach((file, index) => {
      window.setTimeout(() => downloadFile(file.blob, file.fileName), index * 300);
    });
  }

  async function handleSharePreparedFiles(filesToShare: PreparedFile[] = preparedFiles) {
    if (filesToShare.length === 0) return;

    if (typeof navigator.share !== 'function') {
      setExportError('O compartilhamento nativo não está disponível neste navegador. Use o botão de download.');
      return;
    }

    const files = filesToShare.map((file) => new File(
      [file.blob],
      file.fileName,
      { type: file.fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png' },
    ));

    if (typeof navigator.canShare === 'function' && !navigator.canShare({ files })) {
      setExportError(files.length > 1
        ? 'Este navegador não permite compartilhar esses arquivos juntos. Use o botão de download.'
        : 'Este navegador não permite compartilhar este arquivo. Use o botão de download.');
      return;
    }

    setExportError(null);
    try {
      await navigator.share({ files, title: 'Escalas' });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setExportError('Não foi possível abrir o compartilhamento. Você ainda pode baixar os arquivos.');
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
            onClick={() => {
              setExportChoiceOpen(true);
              prefetchExports();
            }}
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
            onClick={() => setExportChoiceOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-choice-title"
            className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="export-choice-title" className="text-lg font-black text-slate-900">Compartilhar como</h2>
              </div>
              <button
                type="button"
                onClick={() => setExportChoiceOpen(false)}
                aria-label="Fechar"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
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
                onClick={handleExportImages}
                className="flex items-center gap-4 rounded-xl border border-slate-200 p-4 text-left hover:border-indigo-400 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <ImageDown className="h-5 w-5 shrink-0 text-indigo-700" />
                <strong className="text-sm font-bold text-slate-900">Imagem</strong>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setExportChoiceOpen(false)}
              className="mt-4 w-full rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
          </section>
        </div>
      )}

      {preparedFiles.length > 0 && (
        <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSharePreparedFiles()}
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
