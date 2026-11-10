'use client';

import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  QrCode,
  RotateCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { api } from '@/lib/api';
import type { Membro } from '@/types';

export interface CarteirinhaModalProps {
  isOpen: boolean;
  membro: Membro | null;
  churchName?: string;
  churchLogoUrl?: string | null;
  onClose: () => void;
}

export function CarteirinhaModal({
  isOpen,
  membro,
  churchName = 'OneElo Igreja',
  churchLogoUrl,
  onClose,
}: CarteirinhaModalProps) {
  const [downloading, setDownloading] = useState<boolean>(false);
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [validationUrl, setValidationUrl] = useState<string>('');
  const [currentTimestamp, setCurrentTimestamp] = useState<string>('');

  // Estados de orientação mobile (estilo CNH Digital)
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isCnhMode, setIsCnhMode] = useState<boolean>(true);

  useEffect(() => {
    function handleResize() {
      if (typeof window === 'undefined') return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isTouchOrNarrow =
        w < 640 || (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && w < 1024);
      setIsMobile(isTouchOrNarrow);
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  useEffect(() => {
    if (!membro?.id) return;
    setError(null);

    const now = new Date();
    const formatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} - ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setCurrentTimestamp(formatted);

    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001';
    const targetUrl = `${origin}/validar-carteirinha/${membro.id}`;
    setValidationUrl(targetUrl);

    QRCode.toDataURL(targetUrl, {
      margin: 2,
      width: 320,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then(setQrCodeDataUrl)
      .catch(() => setQrCodeDataUrl(null));
  }, [membro?.id]);

  if (!isOpen || !membro) return null;

  const displayName = membro.nomeExibicao || membro.nome;
  const roleLabel = membro.cargo || 'Membro';
  const matricula = membro.matricula || `ROL-${membro.id.slice(0, 6).toUpperCase()}`;
  const validadeAno = new Date().getFullYear() + 1;

  function formatDate(iso?: string | null) {
    if (!iso) return 'Não informado';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return 'Não informado';
      return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    } catch {
      return 'Não informado';
    }
  }

  function formatEstadoCivil(estadoCivil?: string | null, sexo?: string | null) {
    if (!estadoCivil) return 'Não informado';
    const clean = estadoCivil.trim().toUpperCase();
    const isFeminino = sexo === 'FEMININO';

    switch (clean) {
      case 'SOLTEIRO':
      case 'SOLTEIRA':
        return isFeminino ? 'Solteira' : 'Solteiro';
      case 'CASADO':
      case 'CASADA':
        return isFeminino ? 'Casada' : 'Casado';
      case 'DIVORCIADO':
      case 'DIVORCIADA':
        return isFeminino ? 'Divorciada' : 'Divorciado';
      case 'VIUVO':
      case 'VIUVA':
      case 'VIÚVO':
      case 'VIÚVA':
        return isFeminino ? 'Viúva' : 'Viúvo';
      case 'UNIAO_ESTAVEL':
      case 'UNIÃO_ESTÁVEL':
      case 'UNIAO ESTAVEL':
      case 'UNIÃO ESTÁVEL':
        return 'União Estável';
      default:
        return estadoCivil;
    }
  }

  async function handleEmitir() {
    if (!membro) return;
    setDownloading(true);
    setError(null);

    try {
      const job = await api.post<{ id: string; status: string; downloadUrl?: string }>('/api/documents/jobs', {
        tipoDocumento: 'CARTEIRINHA_INDIVIDUAL',
        formato: 'PDF',
        parametros: {
          memberId: membro.id,
          validationUrl: validationUrl || (typeof window !== 'undefined' ? `${window.location.origin}/validar-carteirinha/${membro.id}` : undefined),
        },
      });

      let currentJob = job;
      let attempts = 0;
      while (currentJob.status !== 'COMPLETED' && currentJob.status !== 'FAILED' && attempts < 15) {
        await new Promise((r) => setTimeout(r, 1200));
        attempts += 1;
        currentJob = await api.get<{ id: string; status: string; downloadUrl?: string }>(
          `/api/documents/jobs/${job.id}`,
        );
      }

      if (currentJob.status === 'COMPLETED' && currentJob.downloadUrl) {
        const fileName = `carteirinha-${membro.nome.toLowerCase().replace(/\s+/g, '-')}.pdf`;

        const isMobileDevice =
          typeof window !== 'undefined' &&
          (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
            (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches));

        if (isMobileDevice) {
          window.location.href = currentJob.downloadUrl;
        } else {
          const link = document.createElement('a');
          link.href = currentJob.downloadUrl;
          link.download = fileName;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        throw new Error('Tempo de geração expirou. Consulte a Central de Documentos.');
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao emitir carteirinha.');
    } finally {
      setDownloading(false);
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchDeltaX(0);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartX === null) return;
    setTouchDeltaX(e.targetTouches[0].clientX - touchStartX);
  }

  function handleTouchEnd() {
    if (touchStartX === null) return;
    if (touchDeltaX < -40) {
      setCurrentSlide((prev) => Math.min(prev + 1, 2));
    } else if (touchDeltaX > 40) {
      setCurrentSlide((prev) => Math.max(prev - 1, 0));
    }
    setTouchStartX(null);
    setTouchDeltaX(0);
  }

  function handleMouseDown(e: React.MouseEvent) {
    setIsDragging(true);
    setDragStartX(e.clientX);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging || dragStartX === null) return;
    const diff = dragStartX - e.clientX;
    if (diff > 45) {
      setCurrentSlide((prev) => Math.min(prev + 1, 2));
      setIsDragging(false);
      setDragStartX(null);
    } else if (diff < -45) {
      setCurrentSlide((prev) => Math.max(prev - 1, 0));
      setIsDragging(false);
      setDragStartX(null);
    }
  }

  function handleMouseUp() {
    setIsDragging(false);
    setDragStartX(null);
  }

  // Render do cartão Frente (versão ampliada CNH ou versão desktop)
  const renderFrontContent = (isLarge: boolean) => (
    <div
      style={{
        background: 'linear-gradient(135deg, #ffffff 15%, #f1f5f9 45%, #cbd5e1 75%, #94a3b8 100%)',
      }}
      className={`h-full w-full rounded-xl border border-slate-200/70 ${
        isLarge ? 'p-4 sm:p-5' : 'p-3.5'
      } shadow-2xl flex flex-col justify-between overflow-hidden text-slate-800 shrink-0 select-none box-border`}
    >
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/80">
        <div className={`flex items-center gap-2 ${isLarge ? 'max-w-[280px]' : 'max-w-[190px]'}`}>
          {churchLogoUrl ? (
            <img
              src={churchLogoUrl}
              alt={churchName}
              className={`${isLarge ? 'h-7 sm:h-8 max-w-[120px]' : 'h-6 max-w-[90px]'} object-contain`}
            />
          ) : (
            <span
              className={`${
                isLarge ? 'text-sm sm:text-base' : 'text-xs'
              } font-black tracking-tight text-slate-900 truncate uppercase`}
            >
              {churchName}
            </span>
          )}
        </div>
        <span
          className={`rounded-md bg-indigo-600 ${
            isLarge ? 'px-2.5 py-0.5 text-[10px] sm:text-xs' : 'px-2 py-0.5 text-[9px]'
          } font-black tracking-wider text-white uppercase shadow-2xs`}
        >
          Carteira de Membro
        </span>
      </div>

      <div className={`flex items-center ${isLarge ? 'gap-4 sm:gap-5' : 'gap-3'} my-auto`}>
        <div
          className={`${
            isLarge ? 'h-24 w-20 sm:h-28 sm:w-24 rounded-xl' : 'h-16 w-14 rounded-xl'
          } shrink-0 bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center shadow-inner`}
        >
          {membro.fotoUrl ? (
            <img src={membro.fotoUrl} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <span className={`${isLarge ? 'text-xl sm:text-2xl' : 'text-base'} font-extrabold text-slate-400`}>
              {displayName.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4
            className={`${
              isLarge ? 'text-lg sm:text-xl font-black' : 'text-sm font-extrabold'
            } text-slate-900 truncate leading-snug`}
          >
            {displayName}
          </h4>
          <p className={`${isLarge ? 'text-xs sm:text-sm font-bold' : 'text-xs font-bold'} text-indigo-600 uppercase tracking-wide mt-0.5`}>
            {roleLabel}
          </p>
          <div className="mt-1.5">
            <span
              className={`inline-block bg-indigo-50 border border-indigo-100 rounded-md ${
                isLarge ? 'px-2.5 py-0.5 text-[11px] sm:text-xs' : 'px-1.5 py-0.5 text-[9.5px]'
              } font-bold text-indigo-700 truncate ${isLarge ? 'max-w-[300px]' : 'max-w-[180px]'}`}
            >
              {churchName}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/80 text-[10px] sm:text-xs text-slate-600 font-medium">
        <span>
          Matrícula: <strong className="text-slate-900 font-bold">{matricula}</strong>
        </span>
        <span className="text-[10px] text-slate-400">Documento Oficial Digital</span>
      </div>
    </div>
  );

  // Render do cartão Verso
  const renderBackContent = (isLarge: boolean) => (
    <div
      style={{ backgroundColor: '#ffffff' }}
      className={`h-full w-full rounded-xl border border-slate-200/70 ${
        isLarge ? 'p-4 sm:p-5' : 'p-3.5'
      } shadow-2xl flex flex-col justify-between overflow-hidden text-slate-800 shrink-0 select-none box-border`}
    >
      <div className="grid grid-cols-3 gap-2.5 h-full text-[10px] sm:text-xs">
        <div className="col-span-2 flex flex-col justify-between py-0.5">
          <div>
            <span className="text-[8.5px] sm:text-[10px] text-slate-400 font-bold uppercase block leading-none mb-1">
              Nome Completo
            </span>
            <strong
              className={`text-slate-900 ${
                isLarge ? 'text-xs sm:text-sm' : 'text-[10.5px]'
              } truncate block leading-tight font-bold`}
            >
              {membro.nome}
            </strong>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[9.5px] sm:text-xs">
            <div>
              <span className="text-[8.5px] sm:text-[10px] text-slate-400 font-bold uppercase block leading-none mb-0.5">
                Nascimento
              </span>
              <span className="text-slate-700 font-semibold">{formatDate(membro.dataNascimento)}</span>
            </div>
            <div>
              <span className="text-[8.5px] sm:text-[10px] text-slate-400 font-bold uppercase block leading-none mb-0.5">
                Batismo
              </span>
              <span className="text-slate-700 font-semibold">{formatDate(membro.dataBatismo)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[9.5px] sm:text-xs">
            <div>
              <span className="text-[8.5px] sm:text-[10px] text-slate-400 font-bold uppercase block leading-none mb-0.5">
                CPF
              </span>
              <span className="text-slate-700 font-semibold">{membro.cpf || 'Não informado'}</span>
            </div>
            <div>
              <span className="text-[8.5px] sm:text-[10px] text-slate-400 font-bold uppercase block leading-none mb-0.5">
                Estado Civil
              </span>
              <span className="text-slate-700 font-semibold">
                {formatEstadoCivil(membro.estadoCivil, membro.sexo)}
              </span>
            </div>
          </div>
          <div>
            <span className="text-[8.5px] sm:text-[10px] text-slate-400 font-bold uppercase block leading-none mb-0.5">
              Validade
            </span>
            <strong className="text-slate-900 font-black text-xs sm:text-sm">31/12/{validadeAno}</strong>
          </div>
        </div>

        <div className="col-span-1 border-l border-dashed border-slate-200 pl-2 sm:pl-3 flex flex-col items-center justify-center text-center">
          {qrCodeDataUrl ? (
            <a
              href={validationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center hover:opacity-90 transition-opacity"
              title="Clique para testar validação da carteirinha"
            >
              <img
                src={qrCodeDataUrl}
                alt="QR Code Autenticidade"
                className={`${isLarge ? 'h-24 w-24 sm:h-28 sm:w-28' : 'h-16 w-16'} object-contain`}
              />
              <span className="mt-1 text-[8.5px] sm:text-[10px] font-bold text-indigo-600 group-hover:underline uppercase tracking-tight flex items-center gap-0.5">
                Validar ↗
              </span>
            </a>
          ) : (
            <div className="flex flex-col items-center">
              <QrCode className={`${isLarge ? 'h-20 w-20' : 'h-12 w-12'} text-slate-700`} />
              <span className="mt-1 text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                Autenticidade
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-1.5 border-t border-slate-100 text-center text-[8px] sm:text-[10px] text-slate-400">
        Documento emitido por OneElo • lookuplabs.com.br
      </div>
    </div>
  );

  // Render do cartão QR Code Ampliado
  const renderQrContent = (isLarge: boolean) => (
    <div
      style={{ backgroundColor: '#ffffff' }}
      className={`h-full w-full rounded-xl border border-slate-200/70 ${
        isLarge ? 'p-4 sm:p-5' : 'p-3.5'
      } shadow-2xl flex flex-col items-center justify-between overflow-hidden text-slate-800 shrink-0 select-none box-border text-center`}
    >
      <div className="w-full flex items-center justify-between pb-1.5 border-b border-slate-100">
        <span className="text-[10px] sm:text-xs font-black tracking-wider text-slate-800 uppercase">
          QR Code de Autenticidade
        </span>
        <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[8.5px] sm:text-[10px] font-black tracking-wider text-white uppercase shadow-2xs">
          Digital
        </span>
      </div>

      <div className="my-auto flex flex-col items-center justify-center">
        {qrCodeDataUrl ? (
          <img
            src={qrCodeDataUrl}
            alt="QR Code Autenticidade"
            className={`${isLarge ? 'h-32 w-32 sm:h-36 sm:w-36' : 'h-28 w-28'} object-contain`}
          />
        ) : (
          <QrCode className={`${isLarge ? 'h-28 w-28 sm:h-32 sm:w-32' : 'h-24 w-24'} text-slate-700`} />
        )}
        <span className="mt-2 text-[9px] sm:text-xs font-bold text-slate-500 uppercase tracking-tight">
          Aponte a câmera para validar
        </span>
      </div>

      <div className="w-full pt-1.5 border-t border-slate-100 text-center text-[8px] sm:text-[10px] text-slate-400">
        Documento emitido por OneElo • lookuplabs.com.br
      </div>
    </div>
  );

  const isMobileCnhActive = isMobile && isCnhMode;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-md sm:max-w-lg sm:rounded-3xl bg-slate-900 border-0 sm:border sm:border-slate-800 shadow-2xl min-h-screen sm:min-h-0 flex flex-col justify-between overflow-hidden text-white">
        
        {/* Top Header estilo CNH Digital / CDT */}
        <div className="bg-[#0B192C] px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              aria-label="Voltar"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm sm:text-base font-black tracking-wider uppercase">
                  Carteira de Membro
                </h3>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400">
                {currentTimestamp ? `Atualizado em: ${currentTimestamp}` : 'Documento Digital Válido'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMobile && (
              <button
                type="button"
                onClick={() => setIsCnhMode((prev) => !prev)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-[10.5px] text-slate-200 hover:bg-slate-700 font-semibold transition-colors"
                title={isCnhMode ? 'Mudar para visualização horizontal pequena' : 'Mudar para modo CNH ampliado'}
              >
                <RotateCw className="h-3 w-3 text-indigo-400" />
                <span>{isCnhMode ? 'Padrão' : 'Girar'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Banner Informativo estilo CNH (Verifique autenticidade...) */}
        <div className="bg-slate-950/60 px-4 py-2 border-b border-slate-800/60 text-center shrink-0">
          <p className="text-[11px] text-slate-300 flex items-center justify-center gap-1.5">
            {isMobileCnhActive ? (
              <>
                <span>Apresente com o celular deitado</span>
                <span className="text-indigo-400 font-semibold">• Deslize para verso</span>
              </>
            ) : (
              <span>Deslize para o lado para ver frente, verso e QR Code</span>
            )}
          </p>
        </div>

        {error && (
          <div className="mx-4 mt-3 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300 shrink-0">
            {error}
          </div>
        )}

        {/* Área Central: Carrossel de Cartões */}
        <div className="flex-1 flex flex-col items-center justify-center px-2 sm:px-4 py-2 sm:py-6 min-h-0">
          <div className="relative flex items-center justify-center w-full">
            {/* Seta Esquerda (Desktop) */}
            <button
              type="button"
              onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
              disabled={currentSlide === 0}
              className={`hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition-all mr-2 ${
                currentSlide === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
              aria-label="Anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Viewport do Slide: Se estiver no modo CNH no mobile, a viewport é alta (em pé) e o conteúdo dentro gira 90deg */}
            {isMobileCnhActive ? (
              <div
                style={{
                  height: 'clamp(390px, calc(100dvh - 195px), 530px)',
                  aspectRatio: '54 / 85.6',
                }}
                className="relative overflow-hidden select-none cursor-grab active:cursor-grabbing shadow-2xl rounded-xl"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div
                  className="flex transition-transform duration-300 ease-out h-full"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {/* Slide 0: Frente */}
                  <div className="w-full h-full shrink-0 relative flex items-center justify-center">
                    <div
                      style={{
                        width: 'clamp(390px, calc(100dvh - 195px), 530px)',
                        height: 'calc(clamp(390px, calc(100dvh - 195px), 530px) * (54 / 85.6))',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%) rotate(90deg)',
                      }}
                      className="absolute"
                    >
                      {renderFrontContent(true)}
                    </div>
                  </div>

                  {/* Slide 1: Verso */}
                  <div className="w-full h-full shrink-0 relative flex items-center justify-center">
                    <div
                      style={{
                        width: 'clamp(390px, calc(100dvh - 195px), 530px)',
                        height: 'calc(clamp(390px, calc(100dvh - 195px), 530px) * (54 / 85.6))',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%) rotate(90deg)',
                      }}
                      className="absolute"
                    >
                      {renderBackContent(true)}
                    </div>
                  </div>

                  {/* Slide 2: QR Code */}
                  <div className="w-full h-full shrink-0 relative flex items-center justify-center">
                    <div
                      style={{
                        width: 'clamp(390px, calc(100dvh - 195px), 530px)',
                        height: 'calc(clamp(390px, calc(100dvh - 195px), 530px) * (54 / 85.6))',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%) rotate(90deg)',
                      }}
                      className="absolute"
                    >
                      {renderQrContent(true)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Viewport Normal (Desktop ou Mobile modo padrão) */
              <div
                className="relative overflow-hidden w-[330px] sm:w-[350px] py-1 select-none cursor-grab active:cursor-grabbing"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div
                  className="flex transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  <div className="w-full shrink-0 flex justify-center">
                    <div style={{ width: '330px', height: '208px' }}>
                      {renderFrontContent(false)}
                    </div>
                  </div>
                  <div className="w-full shrink-0 flex justify-center">
                    <div style={{ width: '330px', height: '208px' }}>
                      {renderBackContent(false)}
                    </div>
                  </div>
                  <div className="w-full shrink-0 flex justify-center">
                    <div style={{ width: '330px', height: '208px' }}>
                      {renderQrContent(false)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Seta Direita (Desktop) */}
            <button
              type="button"
              onClick={() => setCurrentSlide((prev) => Math.min(2, prev + 1))}
              disabled={currentSlide === 2}
              className={`hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition-all ml-2 ${
                currentSlide === 2 ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
              aria-label="Próximo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Indicador de Bolinhas estilo CNH */}
          <div className="mt-3 sm:mt-5 flex items-center justify-center gap-2 py-1 shrink-0">
            {[0, 1, 2].map((idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                className={`transition-all duration-300 rounded-full cursor-pointer p-0 border-0 ${
                  currentSlide === idx
                    ? 'w-6 h-2 bg-blue-500 shadow-sm'
                    : 'w-2 h-2 bg-slate-600 hover:bg-slate-400'
                }`}
                aria-label={`Página ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Barra de Ações Inferior (normal vertical no rodapé) */}
        <div className="bg-[#0B192C] px-4 py-3.5 sm:px-6 sm:py-4 border-t border-slate-800 flex items-center justify-center sm:justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={handleEmitir}
            disabled={downloading}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50 transition-colors w-full sm:w-auto"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            {downloading ? 'Gerando PDF Oficial...' : 'Baixar PDF Oficial'}
          </button>
        </div>

      </div>
    </div>
  );
}
