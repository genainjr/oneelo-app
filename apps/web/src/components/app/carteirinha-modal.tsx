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
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState<number>(0);
  const [touchDeltaY, setTouchDeltaY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [validationUrl, setValidationUrl] = useState<string>('');
  const [currentTimestamp, setCurrentTimestamp] = useState<string>('');

  // Estados de orientação mobile
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isNativeLandscape, setIsNativeLandscape] = useState<boolean>(false);
  const [presentationMode, setPresentationMode] = useState<boolean>(true);

  useEffect(() => {
    function handleResize() {
      if (typeof window === 'undefined') return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const mobileCheck =
        w < 640 || (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && (w < 1024 || h < 640));
      setIsMobile(mobileCheck);
      setIsNativeLandscape(w > h && mobileCheck);
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
        parametros: { memberId: membro.id },
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

  const renderFrontCard = (isLarge = false) => (
    <div
      style={{
        width: isLarge ? '390px' : '330px',
        height: isLarge ? '246px' : '208px',
        background: 'linear-gradient(135deg, #ffffff 15%, #f1f5f9 45%, #cbd5e1 75%, #94a3b8 100%)',
      }}
      className={`relative rounded-xl border border-slate-200/70 ${
        isLarge ? 'p-4' : 'p-3.5'
      } shadow-xl flex flex-col justify-between overflow-hidden text-slate-800 shrink-0 select-none box-border`}
    >
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
        <div className={`flex items-center gap-2 ${isLarge ? 'max-w-[240px]' : 'max-w-[190px]'}`}>
          {churchLogoUrl ? (
            <img
              src={churchLogoUrl}
              alt={churchName}
              className={`${isLarge ? 'h-7 max-w-[110px]' : 'h-6 max-w-[90px]'} object-contain`}
            />
          ) : (
            <span
              className={`${
                isLarge ? 'text-xs' : 'text-xs'
              } font-black tracking-tight text-slate-800 truncate uppercase`}
            >
              {churchName}
            </span>
          )}
        </div>
        <span
          className={`rounded-md bg-indigo-600 ${
            isLarge ? 'px-2.5 py-0.5 text-[9.5px]' : 'px-2 py-0.5 text-[9px]'
          } font-black tracking-wider text-white uppercase shadow-2xs`}
        >
          Carteira de Membro
        </span>
      </div>

      <div className="flex items-center gap-3.5 my-auto">
        <div
          className={`${
            isLarge ? 'h-18 w-15 rounded-xl' : 'h-16 w-14 rounded-xl'
          } shrink-0 bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center shadow-inner`}
        >
          {membro.fotoUrl ? (
            <img src={membro.fotoUrl} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <span className={`${isLarge ? 'text-lg' : 'text-base'} font-extrabold text-slate-400`}>
              {displayName.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4
            className={`${
              isLarge ? 'text-[15px]' : 'text-sm'
            } font-extrabold text-slate-900 truncate leading-snug`}
          >
            {displayName}
          </h4>
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{roleLabel}</p>
          <div className="mt-1">
            <span
              className={`inline-block bg-indigo-50 border border-indigo-100/60 rounded ${
                isLarge ? 'px-2 py-0.5 text-[10px]' : 'px-1.5 py-0.5 text-[9.5px]'
              } font-bold text-indigo-700 truncate ${isLarge ? 'max-w-[240px]' : 'max-w-[180px]'}`}
            >
              {churchName}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
        <span>
          Matrícula: <strong className="text-slate-800">{matricula}</strong>
        </span>
      </div>
    </div>
  );

  const renderBackCard = (isLarge = false) => (
    <div
      style={{
        width: isLarge ? '390px' : '330px',
        height: isLarge ? '246px' : '208px',
        backgroundColor: '#ffffff',
      }}
      className={`relative rounded-xl border border-slate-200/70 ${
        isLarge ? 'p-4' : 'p-3.5'
      } shadow-xl flex flex-col justify-between overflow-hidden text-slate-800 shrink-0 select-none box-border`}
    >
      <div className="grid grid-cols-3 gap-2 h-full text-[10px]">
        <div className="col-span-2 flex flex-col justify-between py-0.5">
          <div>
            <span className="text-[8.5px] text-slate-400 font-bold uppercase block leading-none mb-0.5">
              Nome Completo
            </span>
            <strong
              className={`text-slate-800 ${
                isLarge ? 'text-[11px]' : 'text-[10.5px]'
              } truncate block leading-tight`}
            >
              {membro.nome}
            </strong>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[9.5px]">
            <div>
              <span className="text-[8.5px] text-slate-400 font-bold uppercase block leading-none mb-0.5">
                Nascimento
              </span>
              <span className="text-slate-700 font-semibold">{formatDate(membro.dataNascimento)}</span>
            </div>
            <div>
              <span className="text-[8.5px] text-slate-400 font-bold uppercase block leading-none mb-0.5">
                Batismo
              </span>
              <span className="text-slate-700 font-semibold">{formatDate(membro.dataBatismo)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[9.5px]">
            <div>
              <span className="text-[8.5px] text-slate-400 font-bold uppercase block leading-none mb-0.5">
                CPF
              </span>
              <span className="text-slate-700 font-semibold">{membro.cpf || 'Não informado'}</span>
            </div>
            <div>
              <span className="text-[8.5px] text-slate-400 font-bold uppercase block leading-none mb-0.5">
                Estado Civil
              </span>
              <span className="text-slate-700 font-semibold">
                {formatEstadoCivil(membro.estadoCivil, membro.sexo)}
              </span>
            </div>
          </div>
          <div>
            <span className="text-[8.5px] text-slate-400 font-bold uppercase block leading-none mb-0.5">
              Validade
            </span>
            <strong className="text-slate-800 font-bold text-[10px]">31/12/{validadeAno}</strong>
          </div>
        </div>

        <div className="col-span-1 border-l border-dashed border-slate-200 pl-2 flex flex-col items-center justify-center text-center">
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
                className={`${isLarge ? 'h-18 w-18' : 'h-16 w-16'} object-contain`}
              />
              <span className="mt-0.5 text-[7.5px] font-bold text-indigo-600 group-hover:underline uppercase tracking-tight flex items-center gap-0.5">
                Validar ↗
              </span>
            </a>
          ) : (
            <div className="flex flex-col items-center">
              <QrCode className={`${isLarge ? 'h-14 w-14' : 'h-12 w-12'} text-slate-700`} />
              <span className="mt-1 text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                Autenticidade
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-1.5 border-t border-slate-100 text-center text-[8px] text-slate-400">
        Documento emitido por OneElo • lookuplabs.com.br
      </div>
    </div>
  );

  const renderQrCard = (isLarge = false) => (
    <div
      style={{
        width: isLarge ? '390px' : '330px',
        height: isLarge ? '246px' : '208px',
        backgroundColor: '#ffffff',
      }}
      className={`relative rounded-xl border border-slate-200/70 ${
        isLarge ? 'p-4' : 'p-3.5'
      } shadow-xl flex flex-col items-center justify-between overflow-hidden text-slate-800 shrink-0 select-none box-border text-center`}
    >
      <div className="w-full flex items-center justify-between pb-1.5 border-b border-slate-100">
        <span className="text-[10px] font-black tracking-wider text-slate-800 uppercase">
          QR Code de Autenticidade
        </span>
        <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[8.5px] font-black tracking-wider text-white uppercase shadow-2xs">
          Digital
        </span>
      </div>

      <div className="my-auto flex flex-col items-center justify-center">
        {qrCodeDataUrl ? (
          <img
            src={qrCodeDataUrl}
            alt="QR Code Autenticidade"
            className={`${isLarge ? 'h-32 w-32' : 'h-28 w-28'} object-contain`}
          />
        ) : (
          <QrCode className={`${isLarge ? 'h-28 w-28' : 'h-24 w-24'} text-slate-700`} />
        )}
        <span className="mt-1 text-[9px] font-bold text-slate-500 uppercase tracking-tight">
          Aponte a câmera para validar
        </span>
      </div>

      <div className="w-full pt-1.5 border-t border-slate-100 text-center text-[8px] text-slate-400">
        Documento emitido por OneElo • lookuplabs.com.br
      </div>
    </div>
  );

  const isRotated = isMobile && presentationMode && !isNativeLandscape;
  const isLandscapeLayout = (isMobile && presentationMode) || isNativeLandscape;

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
    setTouchDeltaX(0);
    setTouchDeltaY(0);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartX === null || touchStartY === null) return;
    setTouchDeltaX(e.targetTouches[0].clientX - touchStartX);
    setTouchDeltaY(e.targetTouches[0].clientY - touchStartY);
  }

  function handleTouchEnd() {
    if (touchStartX === null && touchStartY === null) return;

    if (isRotated) {
      // Quando rotacionado 90deg, o gesto horizontal da mão ao segurar o celular deitado
      // percorre o eixo Y físico do aparelho.
      const delta = Math.abs(touchDeltaY) > Math.abs(touchDeltaX) ? touchDeltaY : -touchDeltaX;
      if (delta < -35) {
        setCurrentSlide((prev) => Math.min(prev + 1, 2));
      } else if (delta > 35) {
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
      }
    } else {
      if (touchDeltaX < -40) {
        setCurrentSlide((prev) => Math.min(prev + 1, 2));
      } else if (touchDeltaX > 40) {
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
      }
    }

    setTouchStartX(null);
    setTouchStartY(null);
    setTouchDeltaX(0);
    setTouchDeltaY(0);
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

  // Se estiver em modo deitado no celular (rotacionado 90deg)
  if (isRotated) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950">
        <div
          style={{
            width: '100dvh',
            height: '100dvw',
            top: 0,
            left: 0,
            transformOrigin: 'top left',
            transform: 'rotate(90deg) translateY(-100%)',
            position: 'fixed',
          }}
          className="bg-[#0B192C] text-white flex flex-col justify-between overflow-hidden shadow-2xl select-none"
        >
          {/* Header Horizontal (ao longo do lado longo do celular) */}
          <div className="px-6 py-2.5 bg-[#071322] border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                aria-label="Voltar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-black tracking-wider uppercase">
                    Carteira de Membro
                  </h3>
                  <span className="bg-indigo-600/40 text-indigo-300 text-[9.5px] px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                    Modo Apresentação
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {currentTimestamp ? `Atualizado em: ${currentTimestamp}` : 'Documento Digital Válido'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPresentationMode(false)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 text-xs text-slate-200 hover:bg-slate-700 font-medium transition-colors"
                title="Mudar para visualização vertical"
              >
                <RotateCw className="h-3.5 w-3.5 text-indigo-400" />
                <span>Vertical</span>
              </button>
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

          {error && (
            <div className="mx-6 mt-2 rounded-xl border border-red-500/30 bg-red-950/40 p-2 text-xs text-red-300 shrink-0">
              {error}
            </div>
          )}

          {/* Área Central Landscape com Carrossel */}
          <div className="flex-1 flex flex-col items-center justify-center my-auto py-2">
            <div className="flex items-center justify-center w-full max-w-2xl px-4 gap-4">
              {/* Botão Anterior */}
              <button
                type="button"
                onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
                disabled={currentSlide === 0}
                className={`h-10 w-10 shrink-0 rounded-full bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-center shadow-lg transition-all ${
                  currentSlide === 0 ? 'opacity-30 pointer-events-none' : 'opacity-100'
                }`}
                aria-label="Anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {/* Viewport do Slide */}
              <div
                className="relative overflow-hidden w-[390px] h-[246px] rounded-xl select-none cursor-grab active:cursor-grabbing shadow-xl"
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
                  <div className="w-[390px] h-[246px] shrink-0 flex justify-center">
                    {renderFrontCard(true)}
                  </div>
                  <div className="w-[390px] h-[246px] shrink-0 flex justify-center">
                    {renderBackCard(true)}
                  </div>
                  <div className="w-[390px] h-[246px] shrink-0 flex justify-center">
                    {renderQrCard(true)}
                  </div>
                </div>
              </div>

              {/* Botão Próximo */}
              <button
                type="button"
                onClick={() => setCurrentSlide((prev) => Math.min(2, prev + 1))}
                disabled={currentSlide === 2}
                className={`h-10 w-10 shrink-0 rounded-full bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-center shadow-lg transition-all ${
                  currentSlide === 2 ? 'opacity-30 pointer-events-none' : 'opacity-100'
                }`}
                aria-label="Próximo"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Indicador de Bolinhas */}
            <div className="mt-3 flex items-center justify-center gap-2">
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
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Footer Horizontal */}
          <div className="px-6 py-2.5 bg-[#071322] border-t border-slate-800 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <span>💡</span>
              <span>Apresente o celular deitado na portaria / recepção</span>
            </span>
            <button
              type="button"
              onClick={handleEmitir}
              disabled={downloading}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {downloading ? 'Gerando PDF Oficial...' : 'Baixar PDF Oficial'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Layout Padrão Vertical (Desktop e Mobile com modo vertical ativado)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-md sm:max-w-lg sm:rounded-3xl bg-slate-900 border-0 sm:border sm:border-slate-800 shadow-2xl min-h-screen sm:min-h-0 flex flex-col overflow-hidden text-white">
        {/* Top Header */}
        <div className="bg-[#0B192C] px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-800 flex items-center justify-between">
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
                onClick={() => setPresentationMode(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] text-slate-200 hover:bg-slate-700 font-semibold transition-colors"
                title="Ativar modo apresentação deitado"
              >
                <RotateCw className="h-3 w-3 text-indigo-400" />
                <span>Deitado</span>
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

        {/* Banner Informativo */}
        <div className="bg-slate-950/50 px-4 py-2 border-b border-slate-800/60 text-center">
          <p className="text-[11px] text-slate-300 flex items-center justify-center gap-1.5">
            <span>Deslize para o lado para ver frente, verso e QR Code</span>
          </p>
        </div>

        {error && (
          <div className="mx-4 mt-3 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Área Central com Carrossel */}
        <div className="my-auto px-4 py-6 flex flex-col items-center justify-center">
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

            {/* Viewport do Slide */}
            <div
              className="relative overflow-hidden w-[340px] py-1 select-none cursor-grab active:cursor-grabbing"
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
                  {renderFrontCard(false)}
                </div>
                <div className="w-full shrink-0 flex justify-center">
                  {renderBackCard(false)}
                </div>
                <div className="w-full shrink-0 flex justify-center">
                  {renderQrCard(false)}
                </div>
              </div>
            </div>

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

          {/* Indicador de Bolinhas */}
          <div className="mt-5 flex items-center justify-center gap-2 py-1">
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

        {/* Barra de Ações Inferior */}
        <div className="bg-[#0B192C] px-4 py-4 sm:px-6 border-t border-slate-800 flex items-center justify-center sm:justify-end gap-3 mt-auto">
          <button
            type="button"
            onClick={handleEmitir}
            disabled={downloading}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50 transition-colors w-full sm:w-auto"
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
