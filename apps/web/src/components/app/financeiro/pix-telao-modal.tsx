"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, LoaderCircle, QrCode, X } from "lucide-react";
import { api } from "@/lib/api";
import {
  PIX_KEY_TYPE_LABELS,
  formatPixKeyForDisplay,
} from "@/lib/pix-brcode";
import type { TenantPixConfigResponse } from "@/app/(dashboard)/financeiro/financeiro-shared";

interface PixTelaoModalProps {
  isOpen: boolean;
  churchName: string;
  churchLogoUrl?: string | null;
  churchSlug?: string | null;
  onClose: () => void;
}

function loadCorsImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export function PixTelaoModal({
  isOpen,
  churchName,
  churchLogoUrl,
  churchSlug,
  onClose,
}: PixTelaoModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<TenantPixConfigResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [downloadingPng, setDownloadingPng] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    setError("");
    setData(null);
    setQrDataUrl(null);

    api
      .get<TenantPixConfigResponse>("/api/financeiro/pix-config")
      .then(async (res) => {
        if (!active) return;
        setData(res);
        if (res.brCode) {
          const url = await QRCode.toDataURL(res.brCode, {
            width: 512,
            margin: 2,
            errorCorrectionLevel: "M",
          });
          if (active) setQrDataUrl(url);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Não foi possível carregar o QR Code PIX.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const config = data?.config ?? null;
  const brCode = data?.brCode ?? null;
  const formattedKey = config ? formatPixKeyForDisplay(config.pixKeyType, config.pixKey) : "";

  async function handleCopyKey() {
    if (!config?.pixKey) return;
    try {
      await navigator.clipboard.writeText(config.pixKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      // ignore
    }
  }

  async function handleDownloadPng() {
    if (!config || !brCode) return;
    setDownloadingPng(true);
    try {
      const width = 1200;
      const height = 1520;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Fundo escuro de alto contraste para projeção/impressão
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, width, height);

      // Card central branco
      const cardX = 80;
      const cardY = 80;
      const cardW = width - 160;
      const cardH = height - 160;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 48);
      ctx.fill();

      let cursorY = cardY + 72;

      // Logo opcional com proteção contra Tainted Canvas (CORS)
      if (churchLogoUrl) {
        try {
          const logoImg = await loadCorsImage(churchLogoUrl);
          const logoSize = 112;
          const logoX = (width - logoSize) / 2;
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(logoX, cursorY, logoSize, logoSize, 24);
          ctx.clip();
          ctx.drawImage(logoImg, logoX, cursorY, logoSize, logoSize);
          ctx.restore();
          cursorY += logoSize + 28;
        } catch {
          // Fallback silencioso sem logo caso o CORS do storage bloqueie o canvas
        }
      }

      // Cabeçalho
      ctx.fillStyle = "#4f46e5";
      ctx.font = "700 28px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("DÍZIMOS E OFERTAS · PIX", width / 2, cursorY + 26);
      cursorY += 68;

      ctx.fillStyle = "#0f172a";
      ctx.font = "800 44px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(churchName.slice(0, 38), width / 2, cursorY + 20);
      cursorY += 72;

      // QR Code em canvas auxiliar (evita qualquer risco de taint)
      const qrSize = 720;
      const qrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(qrCanvas, brCode, {
        width: qrSize,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#09090b", light: "#ffffff" },
      });

      const qrX = (width - qrSize) / 2;
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(qrX - 24, cursorY - 24, qrSize + 48, qrSize + 48, 32);
      ctx.stroke();
      ctx.drawImage(qrCanvas, qrX, cursorY, qrSize, qrSize);
      cursorY += qrSize + 72;

      // Chave formatada
      ctx.fillStyle = "#64748b";
      ctx.font = "600 26px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(
        `Chave PIX (${PIX_KEY_TYPE_LABELS[config.pixKeyType]})`,
        width / 2,
        cursorY,
      );
      cursorY += 48;

      ctx.fillStyle = "#0f172a";
      ctx.font = "800 38px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(formattedKey, width / 2, cursorY);
      cursorY += 54;

      ctx.fillStyle = "#475569";
      ctx.font = "500 24px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(
        "Aponte a câmera do aplicativo do seu banco para contribuir",
        width / 2,
        cursorY,
      );

      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `pix-qrcode-${churchSlug || "igreja"}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setDownloadingPng(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modo Projeção Telão PIX"
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-white"
    >
      {/* Barra superior discreta */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
            <QrCode className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">Modo Projeção · Telão PIX</p>
            <p className="truncate text-xs text-zinc-400">
              Pressione ESC para sair da projeção
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {config && brCode && (
            <button
              type="button"
              onClick={() => void handleDownloadPng()}
              disabled={downloadingPng}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-hover disabled:opacity-60"
            >
              {downloadingPng ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>Baixar QR Code (PNG)</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar Telão PIX"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200 transition hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Área principal de projeção */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-zinc-300">
            <LoaderCircle className="h-8 w-8 animate-spin" />
            <p className="text-sm font-medium">Preparando projeção PIX...</p>
          </div>
        ) : error ? (
          <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-950/50 p-6 text-center text-sm text-red-200">
            {error}
          </div>
        ) : !config || !brCode || !qrDataUrl ? (
          <div className="max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center space-y-2">
            <QrCode className="mx-auto h-10 w-10 text-zinc-500" />
            <h3 className="text-lg font-bold text-white">PIX ainda não configurado</h3>
            <p className="text-sm text-zinc-400">
              Peça ao Gestor Financeiro para configurar a chave PIX da igreja em <strong>Configurar PIX</strong>.
            </p>
          </div>
        ) : (
          <div className="flex w-full max-w-4xl flex-col items-center gap-8 md:flex-row md:justify-center md:gap-12">
            <div className="rounded-3xl bg-white p-5 shadow-2xl shadow-black/60 sm:p-7">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt={`QR Code PIX ${churchName}`}
                className="h-64 w-64 sm:h-80 sm:w-80 md:h-96 md:w-96"
              />
            </div>

            <div className="flex max-w-md flex-col items-center text-center md:items-start md:text-left space-y-5">
              {churchLogoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={churchLogoUrl}
                  alt={churchName}
                  className="h-16 w-16 rounded-2xl border border-zinc-700 bg-white object-cover"
                />
              )}

              <div className="space-y-2">
                <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-300">
                  Dízimos e Ofertas · PIX
                </span>
                <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  {churchName}
                </h2>
                <p className="text-base text-zinc-300">
                  Aponte a câmera do aplicativo do seu banco para o QR Code ao lado ou utilize a chave abaixo:
                </p>
              </div>

              <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Chave {PIX_KEY_TYPE_LABELS[config.pixKeyType]}
                </p>
                <p className="break-all font-mono text-xl font-bold text-white sm:text-2xl">
                  {formattedKey}
                </p>
                <p className="text-xs text-zinc-400">
                  Recebedor: {config.merchantName} · {config.merchantCity}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleCopyKey()}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800"
              >
                {copiedKey ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" />
                    Chave copiada!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar chave PIX
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
