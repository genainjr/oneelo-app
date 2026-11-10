'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CalendarPlus, ChevronDown, ExternalLink, MapPin, X } from 'lucide-react';
import {
  buildOutlookCalendarUrl,
  detectCalendarPlatform,
  downloadIcsFile,
  openGoogleCalendar,
  type CalendarEventParams,
  type CalendarPlatform,
} from '@/lib/calendar-url-builder';

export interface AddToCalendarButtonProps {
  /** Evento individual para adicionar à agenda */
  event?: CalendarEventParams;
  /** Lista de eventos para exportação em lote (mantido por compatibilidade de tipo) */
  batchEvents?: CalendarEventParams[];
  /** Nome sugerido do arquivo .ics */
  icsFilename?: string;
  /** Rótulo customizado do botão */
  label?: string;
  /** Variante visual alinhada ao OneElo Design System (ODS) */
  variant?: 'primary' | 'secondary' | 'outline' | 'compact';
  /** Flag legada mantida para compatibilidade */
  showIcsFallback?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<AddToCalendarButtonProps['variant']>, string> = {
  primary:
    'inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40',
  secondary:
    'inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs font-bold text-indigo-700 shadow-2xs transition hover:bg-indigo-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30',
  outline:
    'inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-2xs transition hover:border-indigo-200 hover:bg-indigo-50/40 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30',
  compact:
    'inline-flex items-center justify-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50/60 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30',
};

/**
 * Logotipo oficial do Google Calendar / Google Agenda (Google Workspace 4 cores com data 31)
 */
function GoogleCalendarLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" fill="none" aria-hidden="true">
      <path d="M390.736 121.264H121.264V390.736H390.736V121.264Z" fill="#FFFFFF" />
      <path d="M390.736 512L512 390.736L451.368 380.392L390.736 390.736L379.67 446.196L390.736 512Z" fill="#EA4335" />
      <path d="M0 390.736V471.578C0 493.912 18.088 512 40.42 512H121.264L133.714 451.368L121.264 390.736L55.198 380.392L0 390.736Z" fill="#188038" />
      <path d="M512 121.264V40.42C512 18.088 493.912 0 471.58 0H390.736c-7.38 30.07-11.07 52.2-11.07 66.39 0 14.19 3.69 32.48 11.07 54.87 26.82 7.68 47.03 11.52 60.63 11.52 13.6 0 33.81-3.84 60.63-11.52Z" fill="#1967D2" />
      <path d="M512 121.264H390.736V390.736H512V121.264Z" fill="#FBBC04" />
      <path d="M390.736 390.736H121.264V512H390.736V390.736Z" fill="#34A853" />
      <path d="M390.736 0H40.422C18.088 0 0 18.088 0 40.42V390.736H121.264V121.264H390.736V0Z" fill="#4285F4" />
      <text
        x="256"
        y="298"
        textAnchor="middle"
        fontSize="148"
        fontWeight="700"
        fill="#1A73E8"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        31
      </text>
    </svg>
  );
}

/**
 * Logotipo oficial do Microsoft Outlook (envelope azul e emblema 'O' do Fluent Design)
 */
function OutlookLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 507 512" fill="none" aria-hidden="true">
      <path fill="#0078D4" d="M316.49 140.402l147.23 97.518L316.88 335.88z" />
      <path
        fill="#28A8EA"
        d="M316.892 375.892H463.72c14.423 0 27.25-8.404 27.25-28.441V163.38c0-20.037-12.827-28.441-27.25-28.441H316.892v240.953z"
      />
      <path fill="#005A9E" d="M0 57.69v391.812L298.066 512V0L0 57.69z" />
      <ellipse cx="149" cy="256" rx="68" ry="86" fill="#FFFFFF" />
      <ellipse cx="149" cy="256" rx="38" ry="52" fill="#005A9E" />
    </svg>
  );
}

/**
 * Logotipo oficial do Apple Calendário (estilo nativo iOS / macOS com topo vermelho e base branca)
 */
function AppleCalendarLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="96" height="96" rx="22" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="2.5" />
      <path d="M2 24C2 11.85 11.85 2 24 2h52c12.15 0 22 9.85 22 22v10H2V24z" fill="#FF3B30" />
      <rect x="26" y="8" width="8" height="6" rx="3" fill="#FFFFFF" opacity="0.8" />
      <rect x="66" y="8" width="8" height="6" rx="3" fill="#FFFFFF" opacity="0.8" />
      <text
        x="50"
        y="26"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="12"
        fontWeight="800"
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing="0.5"
      >
        CAL
      </text>
      <text
        x="50"
        y="75"
        textAnchor="middle"
        fill="#1C1C1E"
        fontSize="40"
        fontWeight="400"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        31
      </text>
    </svg>
  );
}

export function AddToCalendarButton({
  event,
  icsFilename,
  label,
  variant = 'outline',
  className = '',
}: AddToCalendarButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [platform, setPlatform] = useState<CalendarPlatform>('other');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlatform(detectCalendarPlatform());
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!event) return null;

  const isApple = platform === 'apple';
  const outlookUrl = buildOutlookCalendarUrl(event);
  const buttonLabel = label || 'Adicionar à Agenda';
  const resolvedFilename = icsFilename || 'evento-oneelo.ics';

  const handleOpenGoogle = () => {
    setIsOpen(false);
    openGoogleCalendar(event, platform);
  };

  const handleOpenApple = () => {
    setIsOpen(false);
    downloadIcsFile(resolvedFilename, [event]);
  };

  const handleOpenOutlook = () => {
    setIsOpen(false);
    window.open(outlookUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div ref={containerRef} className={`relative inline-flex items-center ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`${buttonLabel}: ${event.title}`}
        className={VARIANT_CLASSES[variant]}
      >
        <CalendarPlus className="h-3.5 w-3.5 shrink-0" />
        <span>{buttonLabel}</span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 opacity-70 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Opções de Agenda"
          className="absolute right-0 top-full z-50 mt-1.5 w-60 origin-top-right rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Salvar em
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={handleOpenGoogle}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-700"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-50 border border-gray-100/80">
              <GoogleCalendarLogo className="h-5 w-5 shrink-0" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900 leading-tight">Google Agenda</p>
              <p className="text-[11px] text-gray-500 leading-tight">Web e aplicativo</p>
            </div>
            <ExternalLink className="h-3 w-3 shrink-0 text-gray-400 opacity-60" />
          </button>

          {isApple && (
            <button
              type="button"
              role="menuitem"
              onClick={handleOpenApple}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-700"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-50 border border-gray-100/80">
                <AppleCalendarLogo className="h-5 w-5 shrink-0" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900 leading-tight">Apple Calendário</p>
                <p className="text-[11px] text-gray-500 leading-tight">iPhone, iPad e Mac</p>
              </div>
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={handleOpenOutlook}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-700"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-50 border border-gray-100/80">
              <OutlookLogo className="h-5 w-5 shrink-0" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900 leading-tight">Microsoft Outlook</p>
              <p className="text-[11px] text-gray-500 leading-tight">Outlook e Hotmail Web</p>
            </div>
            <ExternalLink className="h-3 w-3 shrink-0 text-gray-400 opacity-60" />
          </button>
        </div>
      )}
    </div>
  );
}

export interface CalendarDeepLinkModalProps {
  isOpen?: boolean;
  event: CalendarEventParams | null;
  subtitle?: string;
  icsFilename?: string;
  onClose: () => void;
}

export function CalendarDeepLinkModal({
  isOpen = true,
  event,
  subtitle,
  icsFilename,
  onClose,
}: CalendarDeepLinkModalProps) {
  const [platform, setPlatform] = useState<CalendarPlatform>('other');

  useEffect(() => {
    setPlatform(detectCalendarPlatform());
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !event) return null;

  const isApple = platform === 'apple';
  const outlookUrl = buildOutlookCalendarUrl(event);
  const resolvedFilename = icsFilename || 'evento-oneelo.ics';

  const handleOpenGoogle = () => {
    onClose();
    openGoogleCalendar(event, platform);
  };

  const handleOpenApple = () => {
    onClose();
    downloadIcsFile(resolvedFilename, [event]);
  };

  const handleOpenOutlook = () => {
    onClose();
    window.open(outlookUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-deeplink-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <CalendarPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 id="calendar-deeplink-title" className="text-base font-bold text-gray-900">
                Adicionar à Agenda
              </h2>
              <p className="text-xs text-gray-500">
                Escolha o aplicativo ou serviço da sua preferência:
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-indigo-100/80 bg-indigo-50/40 p-3.5 space-y-1.5">
          <p className="text-sm font-bold text-gray-900 break-words">{event.title}</p>
          {subtitle && <p className="text-xs font-semibold text-indigo-700">{subtitle}</p>}
          {event.location && (
            <p className="inline-flex items-center gap-1 text-xs text-gray-600">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span>{event.location}</span>
            </p>
          )}
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleOpenGoogle}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 border border-gray-100">
                <GoogleCalendarLogo className="h-6 w-6 shrink-0" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900">Google Agenda</p>
                <p className="text-[11px] text-gray-500">Salvar no Google Calendar web ou app</p>
              </div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          </button>

          {isApple && (
            <button
              type="button"
              onClick={handleOpenApple}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 border border-gray-100">
                  <AppleCalendarLogo className="h-6 w-6 shrink-0" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900">Apple Calendário</p>
                  <p className="text-[11px] text-gray-500">iPhone, iPad ou Mac (aplicativo nativo)</p>
                </div>
              </div>
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                iOS / Mac
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenOutlook}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 border border-gray-100">
                <OutlookLogo className="h-6 w-6 shrink-0" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900">Microsoft Outlook</p>
                <p className="text-[11px] text-gray-500">Outlook Web ou Hotmail</p>
              </div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          </button>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
