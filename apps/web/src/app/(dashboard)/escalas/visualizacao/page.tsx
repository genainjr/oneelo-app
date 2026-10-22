'use client';

import { useEffect, useMemo, useState } from 'react';
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
import {
  ExportShareDialog,
  ExportSharePreparedBanner,
  ExportShareErrorBanner,
} from '@/components/app/export-share-dialog';
import { useFilterState } from '@/hooks/use-filter-state';
import { useEscalasVisualizacao } from '@/hooks/use-escalas-visualizacao';
import { useDocumentShare } from '@/hooks/use-document-share';
import { buildWeeklyExportOptionsForEscalas } from '@/lib/export-calendar-weeks';
import { api } from '@/lib/api';
import { STATUS_ESCALA_COLOR, STATUS_ESCALA_LABEL } from '@/lib/utils';
import { AuthUser, Escala, Ministerio } from '@/types';
import { Calendar, List, AlertTriangle, LoaderCircle, Share2 } from 'lucide-react';

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

export default function EscalasVisualizacaoPage() {
  const now = new Date();
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const [tenantName, setTenantName] = useState('OneElo');
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);
  const [printedAt] = useState(() => new Date());
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

  const weeklyOptions = useMemo(
    () => buildWeeklyExportOptionsForEscalas(escalas),
    [escalas],
  );

  const defaultPdfFileName = useMemo(() => {
    if (filter.ano && filter.mes) {
      const padMes = String(filter.mes).padStart(2, '0');
      return `escalas-${filter.ano}-${padMes}.pdf`;
    }
    return 'escalas.pdf';
  }, [filter.ano, filter.mes]);

  const {
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
    handleFallbackShare,
    downloadAllFiles,
  } = useDocumentShare({
    endpoint: '/api/escalas/exportacao',
    filter,
    tenantLogoUrl,
    weeklyOptions,
    documentTitle: 'Escalas',
    defaultPdfFileName,
    pngFileNamePrefix: 'escalas',
    resetDependencies: [escalas],
  });

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

      <ExportShareDialog
        isOpen={exportChoiceOpen}
        step={exportDialogStep}
        selectedWeek={selectedPngWeek}
        weeklyOptions={weeklyOptions}
        onClose={closeExportDialog}
        onStepChange={setExportDialogStep}
        onSelectWeek={setSelectedPngWeek}
        onExportPdf={handleExportPdf}
        onChooseImageOption={handleChooseImageOption}
        onExportImages={handleExportImages}
      />

      <ExportSharePreparedBanner
        preparedFiles={preparedFiles}
        onShare={handleFallbackShare}
        onDownload={downloadAllFiles}
      />

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
            onClear={() => handleClearFilters()}
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

      <ExportShareErrorBanner error={exportError} />

      {loading ? (
        <SkeletonList count={2} className="h-64" />
      ) : escalas.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-12 h-12 text-gray-400" />}
          title="Nenhuma escala encontrada"
          description="Ajuste os filtros acima para visualizar as escalas do período desejado."
        />
      ) : (
        <div className="space-y-4">
          {escalas.map((escala) => {
            const minimizada = escalasMinimizadas.has(escala.id);

            return (
              <div
                key={escala.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <CollapseButton
                      collapsed={minimizada}
                      onToggle={() => toggleEscalaMinimizada(escala.id)}
                      collapseLabel="Minimizar escala"
                      expandLabel="Mostrar escala"
                    />
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        {escala.ministerio?.nome || 'Ministério'}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {MESES.find((m) => m.value === String(escala.mes))?.label} de {escala.ano}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      label={STATUS_ESCALA_LABEL[escala.status]}
                      className={`px-2.5 py-1 font-bold ${STATUS_ESCALA_COLOR[escala.status]}`}
                    />
                  </div>
                </div>

                {!minimizada && <EscalaReadonlyGrid escala={escala} />}
              </div>
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
