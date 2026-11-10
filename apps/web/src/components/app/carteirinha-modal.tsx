'use client';

import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ExternalLink,
  FileText,
  Loader2,
  QrCode,
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
  const [viewMode, setViewMode] = useState<'both' | 'front' | 'back'>('both');
  const [error, setError] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [validationUrl, setValidationUrl] = useState<string>('');
  const [currentTimestamp, setCurrentTimestamp] = useState<string>('');

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

        const isMobile =
          typeof window !== 'undefined' &&
          (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
            (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches));

        if (isMobile) {
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

  const renderFrontCard = () => (
    <div className="relative w-full max-w-[340px] aspect-[85.6/53.98] rounded-2xl border border-slate-200/90 bg-linear-to-br from-white via-slate-50 to-indigo-50/40 p-3.5 sm:p-4 shadow-md flex flex-col justify-between overflow-hidden text-slate-800 shrink-0">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2 max-w-[190px]">
          {churchLogoUrl ? (
            <img src={churchLogoUrl} alt={churchName} className="h-6 max-w-[90px] object-contain" />
          ) : (
            <span className="text-xs font-black tracking-tight text-slate-800 truncate uppercase">
              {churchName}
            </span>
          )}
        </div>
        <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[9px] font-black tracking-wider text-white uppercase shadow-2xs">
          Carteira de Membro
        </span>
      </div>

      <div className="flex items-center gap-3 my-auto">
        <div className="h-16 w-14 shrink-0 rounded-xl bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center shadow-inner">
          {membro.fotoUrl ? (
            <img src={membro.fotoUrl} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <span className="text-base font-extrabold text-slate-400">
              {displayName.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-extrabold text-slate-900 truncate">{displayName}</h4>
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{roleLabel}</p>
          <div className="mt-1">
            <span className="inline-block bg-indigo-50 border border-indigo-100/60 rounded px-1.5 py-0.5 text-[9.5px] font-bold text-indigo-700 truncate max-w-[180px]">
              {churchName}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center pt-2 border-t border-slate-100 text-[10px] text-slate-500">
        <span>Matrícula: <strong className="text-slate-800">{matricula}</strong></span>
      </div>
    </div>
  );

  const renderBackCard = () => (
    <div className="relative w-full max-w-[340px] aspect-[85.6/53.98] rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-md flex flex-col justify-between overflow-hidden text-slate-800 shrink-0">
      <div className="grid grid-cols-3 gap-2 h-full text-[10px]">
        <div className="col-span-2 space-y-1">
          <div>
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Nome Completo</span>
            <strong className="text-slate-800 text-[11px] truncate block">{membro.nome}</strong>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Nascimento</span>
              <span className="text-slate-700 font-semibold">{formatDate(membro.dataNascimento)}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Batismo</span>
              <span className="text-slate-700 font-semibold">{formatDate(membro.dataBatismo)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">CPF</span>
              <span className="text-slate-700 font-semibold">{membro.cpf || 'Não informado'}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Estado Civil</span>
              <span className="text-slate-700 font-semibold">{formatEstadoCivil(membro.estadoCivil, membro.sexo)}</span>
            </div>
          </div>
          <div>
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Validade</span>
            <strong className="text-slate-800 font-bold">31/12/{validadeAno}</strong>
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
                className="h-16 w-16 object-contain"
              />
              <span className="mt-0.5 text-[7.5px] font-bold text-indigo-600 group-hover:underline uppercase tracking-tight flex items-center gap-0.5">
                Validar ↗
              </span>
            </a>
          ) : (
            <div className="flex flex-col items-center">
              <QrCode className="h-12 w-12 text-slate-700" />
              <span className="mt-1 text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                Autenticidade
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-1.5 border-t border-slate-100 text-center text-[8px] text-slate-400">
        Documento eclesiástico emitido por OneElo • lookup.com.br
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl sm:rounded-3xl bg-slate-900 border-0 sm:border sm:border-slate-800 shadow-2xl min-h-screen sm:min-h-0 flex flex-col overflow-hidden text-white">
        
        {/* Top Header estilo CNH Digital / CDT */}
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

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Banner Informativo de Autenticação */}
        <div className="bg-slate-950/50 px-4 py-2 border-b border-slate-800/60 text-center">
          <p className="text-[11px] text-slate-300 flex items-center justify-center gap-1.5">
            <span>Aponte a câmera para o QR Code para verificar autenticidade online</span>
          </p>
        </div>

        {error && (
          <div className="mx-4 mt-3 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Alternador de Modo de Exibição */}
        <div className="mt-4 flex justify-center px-4">
          <div className="inline-flex rounded-xl bg-slate-800/90 p-1 border border-slate-700/60">
            <button
              type="button"
              onClick={() => setViewMode('both')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                viewMode === 'both' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Frente e Verso
            </button>
            <button
              type="button"
              onClick={() => setViewMode('front')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                viewMode === 'front' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Frente
            </button>
            <button
              type="button"
              onClick={() => setViewMode('back')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                viewMode === 'back' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Verso
            </button>
          </div>
        </div>

        {/* Área Central da Carteirinha Digital */}
        <div className="my-auto px-4 py-6 flex flex-col items-center justify-center overflow-x-auto">
          {viewMode === 'both' && (
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 w-full">
              {renderFrontCard()}
              {renderBackCard()}
            </div>
          )}

          {viewMode === 'front' && (
            <div className="flex justify-center w-full">
              {renderFrontCard()}
            </div>
          )}

          {viewMode === 'back' && (
            <div className="flex justify-center w-full">
              {renderBackCard()}
            </div>
          )}

          {/* Indicador de Paginação estilo CNH */}
          <div className="mt-4 flex items-center justify-center gap-1.5">
            <span
              onClick={() => setViewMode('both')}
              className={`h-2 rounded-full cursor-pointer transition-all ${
                viewMode === 'both' ? 'w-6 bg-indigo-500' : 'w-2 bg-slate-700'
              }`}
              title="Frente e Verso"
            />
            <span
              onClick={() => setViewMode('front')}
              className={`h-2 rounded-full cursor-pointer transition-all ${
                viewMode === 'front' ? 'w-6 bg-indigo-500' : 'w-2 bg-slate-700'
              }`}
              title="Frente"
            />
            <span
              onClick={() => setViewMode('back')}
              className={`h-2 rounded-full cursor-pointer transition-all ${
                viewMode === 'back' ? 'w-6 bg-indigo-500' : 'w-2 bg-slate-700'
              }`}
              title="Verso"
            />
          </div>
        </div>

        {/* Barra de Ações Inferior estilo CNH Digital */}
        <div className="bg-[#0B192C] px-4 py-4 sm:px-6 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-auto">
          <a
            href={validationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <ExternalLink className="h-4 w-4 text-emerald-400" />
            Testar Validação Digital
          </a>

          <button
            type="button"
            onClick={handleEmitir}
            disabled={downloading}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50 transition-colors"
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
