'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { ModalShell } from '@/components/app/modal-shell';
import { Copy, Check, QrCode, Download, ExternalLink, Sparkles, Smartphone } from 'lucide-react';

interface JoinLinkCardProps {
  slug?: string;
  tenantName?: string;
}

export function JoinLinkCard({ slug, tenantName }: JoinLinkCardProps) {
  const [copied, setCopied] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const churchName = tenantName || 'sua igreja';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://oneelo.vercel.app';
  const joinUrl = slug ? `${origin}/join/${slug}` : '';

  useEffect(() => {
    if (joinUrl && qrModalOpen) {
      QRCode.toDataURL(joinUrl, {
        width: 800,
        margin: 2,
        color: {
          dark: '#111827',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Erro ao gerar QR Code:', err));
    }
  }, [joinUrl, qrModalOpen]);

  async function handleCopy() {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  function handleDownloadQr() {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `qrcode-recepcao-${slug || 'igreja'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  if (!slug) return null;

  return (
    <>
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/20 to-indigo-50/40 p-6 shadow-xs">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                <Smartphone className="h-4 w-4" />
              </span>
              <h3 className="text-base font-semibold text-gray-900">
                Link Público de Boas-Vindas e Auto-Cadastro
              </h3>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                <Sparkles className="mr-1 h-3 w-3" />
                Ativo
              </span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Compartilhe o endereço público de acolhimento de <strong>{churchName}</strong> para que visitantes e novos membros façam o cadastro diretamente no smartphone durante os cultos.
            </p>

            {/* Caixa de exibição da URL */}
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/90 p-2 shadow-inner">
              <span className="truncate px-2 text-sm font-mono text-gray-700 select-all">
                {joinUrl}
              </span>
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 active:scale-95 transition-all"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-700">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-gray-500" />
                  <span>Copiar Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setQrModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 active:scale-95 transition-all"
            >
              <QrCode className="h-4 w-4 text-indigo-600" />
              <span>Ver QR Code</span>
            </button>

            <button
              type="button"
              onClick={() => window.open(joinUrl, '_blank')}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              title="Abrir página pública em nova aba"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Visualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal QR Code em Alta Resolução */}
      {qrModalOpen && (
        <ModalShell
          isOpen
          title="QR Code Oficial da Recepção"
          onClose={() => setQrModalOpen(false)}
          size="md"
        >
          <div className="space-y-6 p-6">
            <p className="text-sm text-gray-600 text-center">
              Aponte a câmera do celular para testar ou baixe a imagem em alta resolução para usar em telões, totens ou panfletos da igreja.
            </p>

            <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-gray-50/80 p-6 shadow-inner">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt={`QR Code para ${joinUrl}`}
                  className="h-64 w-64 rounded-xl border border-white shadow-sm bg-white p-2"
                />
              ) : (
                <div className="flex h-64 w-64 items-center justify-center rounded-xl bg-white border border-gray-200">
                  <span className="text-sm text-gray-400">Gerando QR Code...</span>
                </div>
              )}

              <p className="mt-3 font-mono text-xs text-gray-500 text-center break-all max-w-xs">
                {joinUrl}
              </p>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-900 space-y-1.5">
              <p className="font-semibold text-blue-950 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                Dica pastoral de acolhimento
              </p>
              <p>
                Projete este QR Code no telão do templo antes do início do culto e durante os avisos dominicais convidando os visitantes a preencherem a ficha pelo smartphone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-2xs hover:bg-gray-50"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleDownloadQr}
                disabled={!qrDataUrl}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Baixar Imagem PNG
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
}
