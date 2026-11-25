"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink, FileText, LoaderCircle, Lock, RefreshCw } from "lucide-react";
import { ModalError, ModalShell } from "@/components/app/modal-shell";
import { api } from "@/lib/api";

export interface PrivateReceiptSignedUrlResponse {
  url: string;
  expiresInSeconds: number;
  fileName: string | null;
  mimeType: string | null;
}

interface ReceiptPreviewModalProps {
  isOpen: boolean;
  endpoint: string | null;
  title?: string;
  fileName?: string | null;
  mimeType?: string | null;
  onClose: () => void;
}

function isImageFile(mimeType?: string | null, fileName?: string | null): boolean {
  if (mimeType?.startsWith("image/")) return true;
  if (fileName && /\.(?:jpe?g|png|webp)$/i.test(fileName)) return true;
  return false;
}

function isPdfFile(mimeType?: string | null, fileName?: string | null): boolean {
  if (mimeType === "application/pdf") return true;
  if (fileName && /\.pdf$/i.test(fileName)) return true;
  return false;
}

export function ReceiptPreviewModal({
  isOpen,
  endpoint,
  title = "Visualizar Comprovante",
  fileName,
  mimeType,
  onClose,
}: ReceiptPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<PrivateReceiptSignedUrlResponse | null>(null);

  const loadSignedUrl = useCallback(async () => {
    if (!endpoint) return;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const response = await api.get<PrivateReceiptSignedUrlResponse>(endpoint);
      setData(response);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar o link temporário do comprovante.",
      );
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (!isOpen || !endpoint) {
      setData(null);
      setError("");
      return;
    }
    void loadSignedUrl();
  }, [endpoint, isOpen, loadSignedUrl]);

  const resolvedFileName = data?.fileName || fileName || "comprovante";
  const resolvedMimeType = data?.mimeType || mimeType || null;
  const isImage = isImageFile(resolvedMimeType, resolvedFileName);
  const isPdf = isPdfFile(resolvedMimeType, resolvedFileName);

  return (
    <ModalShell
      isOpen={isOpen}
      title={title}
      description={resolvedFileName}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
            <Lock className="h-3.5 w-3.5 text-emerald-600" />
            Acesso privado temporário (5 min)
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Fechar
            </button>
            {data?.url && (
              <a
                href={data.url}
                target="_blank"
                rel="noopener noreferrer"
                download={resolvedFileName}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-hover"
              >
                {isPdf ? <Download className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                Abrir / Baixar
              </a>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4 p-6">
        <ModalError message={error} />

        {loading && (
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-6 text-center">
            <LoaderCircle className="h-7 w-7 animate-spin text-accent-ink" />
            <p className="text-sm font-medium text-gray-600">
              Gerando acesso seguro ao comprovante...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-100 bg-red-50/50 p-8 text-center">
            <FileText className="h-8 w-8 text-red-500" />
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void loadSignedUrl()}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && data?.url && isImage && (
          <div className="flex justify-center rounded-2xl border border-gray-100 bg-gray-50 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.url}
              alt={resolvedFileName}
              className="max-h-[62vh] w-auto rounded-xl object-contain shadow-sm"
            />
          </div>
        )}

        {!loading && data?.url && isPdf && (
          <div className="space-y-2">
            <iframe
              src={data.url}
              title={resolvedFileName}
              className="h-[60vh] w-full rounded-2xl border border-gray-200 bg-gray-50"
            />
            <p className="text-center text-xs text-gray-500">
              Em alguns celulares, use o botão <strong>Abrir / Baixar</strong> abaixo para visualizar o PDF em tela cheia.
            </p>
          </div>
        )}

        {!loading && data?.url && !isImage && !isPdf && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center">
            <FileText className="h-10 w-10 text-gray-400" />
            <p className="text-sm font-semibold text-gray-800">{resolvedFileName}</p>
            <p className="text-xs text-gray-500">
              Clique em <strong>Abrir / Baixar</strong> para acessar o comprovante.
            </p>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
