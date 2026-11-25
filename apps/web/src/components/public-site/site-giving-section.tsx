'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowRight, Check, Copy, HeartHandshake, LogIn, QrCode } from 'lucide-react';
import type { PublicSitePix } from '@/lib/api-website';
import { PIX_KEY_TYPE_LABELS, formatPixKeyForDisplay } from '@/lib/pix-brcode';

interface SiteGivingSectionProps {
  churchName: string;
  pix: PublicSitePix | null | undefined;
  membersLoginHref: string;
}

export function SiteGivingSection({
  churchName,
  pix,
  membersLoginHref,
}: SiteGivingSectionProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'brcode' | 'key' | null>(null);

  useEffect(() => {
    if (!pix?.brCode) {
      setQrDataUrl(null);
      return;
    }
    let active = true;
    QRCode.toDataURL(pix.brCode, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#09090b', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [pix?.brCode]);

  if (!pix) return null;

  const formattedKey = formatPixKeyForDisplay(pix.pixKeyType, pix.pixKey);
  const separator = membersLoginHref.includes('?') ? '&' : '?';
  const sendReceiptHref = `${membersLoginHref}${separator}redirect=${encodeURIComponent('/minhas-contribuicoes')}`;

  async function handleCopy(text: string, type: 'brcode' | 'key') {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2200);
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <section
      id="contribuir"
      aria-labelledby="contribuir-titulo"
      className="scroll-mt-20 border-b border-zinc-800/90 bg-zinc-950 py-16 text-zinc-100 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
          <div className="min-w-0 space-y-5 lg:col-span-6">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--site-accent-text)]">
              <HeartHandshake className="h-4 w-4" aria-hidden="true" />
              <span>Generosidade & Gratidão</span>
            </div>

            <h2
              id="contribuir-titulo"
              className="text-[clamp(1.75rem,1.35rem+1.6vw,2.5rem)] font-extrabold tracking-[-0.025em] text-white [text-wrap:balance]"
            >
              Dízimos e Ofertas via PIX
            </h2>

            <p className="max-w-[52ch] text-sm leading-relaxed text-zinc-300 [text-wrap:pretty] sm:text-base">
              Sua generosidade sustenta os projetos sociais, missionários e o cuidado pastoral da{' '}
              <span className="font-semibold text-white">{churchName}</span>. Contribua de forma
              simples, direta e sem taxas utilizando o QR Code ou a chave PIX oficial.
            </p>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">
                  Chave {PIX_KEY_TYPE_LABELS[pix.pixKeyType]}
                </span>
                <span className="text-xs text-zinc-500">
                  {pix.merchantName} · {pix.merchantCity}
                </span>
              </div>

              <p className="break-all font-mono text-base font-bold text-white sm:text-lg">
                {formattedKey}
              </p>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => void handleCopy(pix.brCode, 'brcode')}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--site-accent)] px-5 py-2.5 text-sm font-bold text-[var(--site-accent-foreground)] shadow-sm transition hover:bg-[var(--site-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  {copiedType === 'brcode' ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      <span>Código PIX copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      <span>Copiar PIX (Copia e Cola)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => void handleCopy(pix.pixKey, 'key')}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:border-[var(--site-accent-border-strong)] hover:text-white"
                >
                  {copiedType === 'key' ? (
                    <>
                      <Check className="h-4 w-4 text-[var(--site-accent-text)]" aria-hidden="true" />
                      <span>Chave copiada!</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="h-4 w-4 text-[var(--site-accent-text)]" aria-hidden="true" />
                      <span>Copiar chave</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="mx-auto max-w-md rounded-3xl border border-zinc-800 bg-[#111115] p-6 shadow-2xl sm:p-8">
              <div className="flex flex-col items-center text-center space-y-5">
                <div className="rounded-2xl bg-white p-4 shadow-lg">
                  {qrDataUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={qrDataUrl}
                      alt={`QR Code PIX de ${churchName}`}
                      className="h-52 w-52 sm:h-60 sm:w-60"
                    />
                  ) : (
                    <div className="flex h-52 w-52 items-center justify-center text-zinc-400 sm:h-60 sm:w-60">
                      <QrCode className="h-12 w-12" />
                    </div>
                  )}
                </div>

                <p className="text-xs leading-relaxed text-zinc-400">
                  Abra o aplicativo do seu banco, escolha <strong>PIX → Ler QR Code</strong> e informe o valor desejado.
                </p>

                <div className="w-full border-t border-zinc-800/90 pt-5 space-y-2.5">
                  <p className="text-xs font-medium text-zinc-300">
                    Já é membro? Envie seu comprovante e acompanhe seu histórico anual na Área de Membros.
                  </p>
                  <a
                    href={sendReceiptHref}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--site-accent-border)] bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-[var(--site-accent-border-strong)] hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-accent-ring)]"
                  >
                    <LogIn className="h-4 w-4 text-[var(--site-accent-text)]" aria-hidden="true" />
                    <span>Enviar comprovante na Área de Membros</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
