'use client';

import { useState, useEffect } from 'react';
import { Download, FileText, Image as ImageIcon, Loader2, QrCode, ShieldCheck, X } from 'lucide-react';
import QRCode from 'qrcode';
import { api } from '@/lib/api';
import { downloadFile } from '@/hooks/use-document-share';
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
  const [downloading, setDownloading] = useState<'pdf' | 'png' | null>(null);
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [error, setError] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [validationUrl, setValidationUrl] = useState<string>('');

  useEffect(() => {
    if (!membro?.id) return;
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

  async function handleEmitir(formato: 'PDF' | 'PNG') {
    if (!membro) return;
    setDownloading(formato.toLowerCase() as any);
    setError(null);

    try {
      // Cria job de geração
      const job = await api.post<{ id: string; status: string; downloadUrl?: string }>('/api/documents/jobs', {
        tipoDocumento: 'CARTEIRINHA_INDIVIDUAL',
        formato,
        parametros: { memberId: membro.id },
      });

      // Poll rápido se ainda estiver processando
      let currentJob = job;
      let attempts = 0;
      while (currentJob.status !== 'COMPLETED' && currentJob.status !== 'FAILED' && attempts < 15) {
        await new Promise((r) => setTimeout(r, 1500));
        attempts += 1;
        currentJob = await api.get<{ id: string; status: string; downloadUrl?: string }>(
          `/api/documents/jobs/${job.id}`,
        );
      }

      if (currentJob.status === 'COMPLETED' && currentJob.downloadUrl) {
        // Baixa o arquivo gerado via link direto para evitar restrições de CORS no browser
        const extension = formato === 'PDF' ? 'pdf' : 'png';
        const fileName = `carteirinha-${membro.nome.toLowerCase().replace(/\s+/g, '-')}.${extension}`;
        const link = document.createElement('a');
        link.href = currentJob.downloadUrl;
        link.download = fileName;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        throw new Error('Tempo de geração expirou. Consulte a Central de Documentos.');
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao emitir carteirinha.');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-bold text-gray-900">Carteirinha Oficial de Membro</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Alternador de Lado (Frente / Verso) */}
        <div className="mt-4 flex justify-center">
          <div className="inline-flex rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setActiveSide('front')}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                activeSide === 'front' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Frente
            </button>
            <button
              type="button"
              onClick={() => setActiveSide('back')}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                activeSide === 'back' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Verso
            </button>
          </div>
        </div>

        {/* Pré-visualização do Cartão (Proporção CR80) */}
        <div className="mt-5 flex justify-center">
          <div className="relative w-full max-w-[340px] aspect-[85.6/53.98] rounded-2xl border border-slate-200 bg-linear-to-br from-white via-slate-50 to-indigo-50/30 p-4 shadow-md flex flex-col justify-between overflow-hidden">
            {activeSide === 'front' ? (
              <>
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
                  <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[9px] font-black tracking-wider text-white uppercase">
                    Membro
                  </span>
                </div>

                <div className="flex items-center gap-3 my-auto">
                  <div className="h-16 w-14 shrink-0 rounded-xl bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center">
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
                    <p className="mt-1 text-[10px] text-slate-500 truncate">{churchName}</p>
                  </div>
                </div>

                <div className="flex items-center pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                  <span>Matrícula: <strong className="text-slate-800">{matricula}</strong></span>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 h-full text-[10px]">
                  <div className="col-span-2 space-y-1.5">
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
                        <span className="text-slate-700 font-semibold">{membro.estadoCivil || 'Não informado'}</span>
                      </div>
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
                  Documento eclesiástico válido mediante confirmação oficial no OneElo.
                </div>
              </>
            )}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleEmitir('PDF')}
            disabled={downloading !== null}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {downloading === 'pdf' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Baixar PDF (CR80)
          </button>

          <button
            type="button"
            onClick={() => handleEmitir('PNG')}
            disabled={downloading !== null}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {downloading === 'png' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4 text-indigo-600" />
            )}
            Baixar Imagem (PNG)
          </button>
        </div>
      </div>
    </div>
  );
}
