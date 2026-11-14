'use client';

import { ArrowLeft, Check, Download, FileText, ImageDown, Share2, X } from 'lucide-react';
import type { PngWeekSelection, WeeklyExportOption } from '@/lib/export-calendar-weeks';
import type { PreparedFile } from '@/hooks/use-document-share';

export interface ExportShareDialogProps {
  isOpen: boolean;
  step: 'format' | 'week';
  selectedWeek: PngWeekSelection;
  weeklyOptions: WeeklyExportOption[];
  onClose: () => void;
  onStepChange: (step: 'format' | 'week') => void;
  onSelectWeek: (week: PngWeekSelection) => void;
  onExportPdf: () => void;
  onChooseImageOption: () => void;
  onExportImages: (selection?: PngWeekSelection) => void;
}

export function ExportShareDialog({
  isOpen,
  step,
  selectedWeek,
  weeklyOptions,
  onClose,
  onStepChange,
  onSelectWeek,
  onExportPdf,
  onChooseImageOption,
  onExportImages,
}: ExportShareDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Fechar opções de exportação"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-choice-title"
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            {step === 'week' && (
              <button
                type="button"
                onClick={() => onStepChange('format')}
                aria-label="Voltar"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h2 id="export-choice-title" className="text-lg font-black text-slate-900">
              {step === 'format' ? 'Compartilhar como' : 'Selecionar semana'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 'format' ? (
          <>
            <div className="grid gap-3">
              <button
                type="button"
                onClick={onExportPdf}
                className="flex items-center gap-4 rounded-xl border border-slate-200 p-4 text-left hover:border-accent-ring hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-accent-ring"
              >
                <FileText className="h-5 w-5 shrink-0 text-accent-ink" />
                <strong className="text-sm font-bold text-slate-900">PDF</strong>
              </button>
              <button
                type="button"
                onClick={onChooseImageOption}
                className="flex items-center gap-4 rounded-xl border border-slate-200 p-4 text-left hover:border-accent-ring hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-accent-ring"
              >
                <ImageDown className="h-5 w-5 shrink-0 text-accent-ink" />
                <strong className="text-sm font-bold text-slate-900">Imagem</strong>
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {weeklyOptions.map((option) => {
                const isSelected = selectedWeek === option.page;
                return (
                  <button
                    key={option.page}
                    type="button"
                    onClick={() => onSelectWeek(option.page)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                      isSelected
                        ? 'border-accent-ink bg-accent-soft text-slate-900'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-accent-soft-border hover:bg-slate-50'
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
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-accent-ink" />}
                  </button>
                );
              })}

              {weeklyOptions.length > 1 && (
                <button
                  type="button"
                  onClick={() => onSelectWeek('todas')}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                    selectedWeek === 'todas'
                      ? 'border-accent-ink bg-accent-soft text-slate-900'
                      : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:border-accent-soft-border hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <strong className="block text-sm font-bold">Todas as semanas</strong>
                    <span className="text-xs text-slate-500">
                      {weeklyOptions.length} imagens do período
                    </span>
                  </div>
                  {selectedWeek === 'todas' && <Check className="h-4 w-4 shrink-0 text-accent-ink" />}
                </button>
              )}
            </div>

            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={() => onExportImages(selectedWeek)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-brand-foreground hover:bg-brand-hover"
              >
                <ImageDown className="h-4 w-4" />
                {selectedWeek === 'todas' ? 'Gerar todas as semanas' : 'Gerar imagem da semana'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export interface ExportSharePreparedBannerProps {
  preparedFiles: PreparedFile[];
  onShare: () => void;
  onDownload: () => void;
}

export function ExportSharePreparedBanner({
  preparedFiles,
  onShare,
  onDownload,
}: ExportSharePreparedBannerProps) {
  if (preparedFiles.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-accent-soft-border bg-accent-soft p-4 text-sm text-slate-900">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-bold text-brand-foreground hover:bg-brand-hover"
        >
          <Share2 className="h-4 w-4" />
          Compartilhar
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-2 rounded-lg border border-accent-soft-border bg-white px-3 py-2 text-sm font-bold text-accent-ink hover:bg-accent-soft"
        >
          <Download className="h-4 w-4" />
          Baixar
        </button>
      </div>
    </div>
  );
}

export interface ExportShareErrorBannerProps {
  error: string | null;
}

export function ExportShareErrorBanner({ error }: ExportShareErrorBannerProps) {
  if (!error) return null;

  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {error}
    </div>
  );
}
