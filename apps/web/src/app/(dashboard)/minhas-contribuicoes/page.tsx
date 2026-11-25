"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  FileText,
  HeartHandshake,
  Info,
  QrCode,
  RotateCcw,
  Trash2,
  Upload,
  UserRound,
  XCircle,
} from "lucide-react";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { EntityCard } from "@/components/app/entity-card";
import { InputField, SelectField, TextareaField } from "@/components/app/form-field";
import { ReceiptPreviewModal } from "@/components/app/financeiro/receipt-preview-modal";
import { ModalError, ModalFooter, ModalShell } from "@/components/app/modal-shell";
import { PageHeader } from "@/components/app/page-header";
import { PrimaryActionButton } from "@/components/app/primary-action-button";
import { Skeleton } from "@/components/app/skeleton";
import { StatCard } from "@/components/app/stat-card";
import { useAuthUser } from "@/contexts/auth-user-context";
import { api } from "@/lib/api";
import {
  PIX_KEY_TYPE_LABELS,
  formatPixKeyForDisplay,
  tryGeneratePixBrCode,
  type PixKeyType,
} from "@/lib/pix-brcode";
import {
  PAYMENT_METHOD_LABELS,
  currencyFormatter,
  dateFormatter,
  todayInputValue,
  type FinancialPaymentMethod,
  type FinancialTransactionSource,
  type FinancialTransactionStatus,
} from "../financeiro/financeiro-shared";

interface MemberPixCategory {
  id: string;
  name: string;
}

interface MemberPixInfoResponse {
  enabled: boolean;
  pix: {
    pixKeyType: PixKeyType;
    pixKey: string;
    merchantName: string;
    merchantCity: string;
    txidPrefix: string | null;
    brCode: string;
  } | null;
  categories: MemberPixCategory[];
}

interface MemberContributionItem {
  id: string;
  status: FinancialTransactionStatus;
  source: FinancialTransactionSource;
  date: string;
  paidAt: string | null;
  amount: number;
  description: string | null;
  paymentMethod: FinancialPaymentMethod | null;
  payerName: string | null;
  rejectionReason: string | null;
  hasReceipt: boolean;
  receiptFileName: string | null;
  receiptMimeType: string | null;
  canDelete: boolean;
  createdAt: string;
  category: { id: string; name: string };
}

interface MemberContributionsResponse {
  year: number;
  availableYears: number[];
  summary: {
    confirmedTotal: number;
    confirmedCount: number;
    pendingCount: number;
    rejectedCount: number;
  };
  items: MemberContributionItem[];
}

interface ContributionFormState {
  categoryId: string;
  amount: string;
  date: string;
  payerName: string;
  description: string;
  file: File | null;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function getMemberStatusBadge(status: FinancialTransactionStatus) {
  if (status === "CONFIRMED") {
    return {
      label: "Confirmado",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (status === "CANCELLED") {
    return {
      label: "Recusado",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  return {
    label: "Em análise",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  };
}

export default function MinhasContribuicoesPage() {
  const { user, loadingUser } = useAuthUser();
  const hasLinkedMember = Boolean(user?.membro?.id);

  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [pixInfo, setPixInfo] = useState<MemberPixInfoResponse | null>(null);
  const [history, setHistory] = useState<MemberContributionsResponse | null>(null);

  // Estado do card PIX (valor opcional recalculado 100% no cliente)
  const [optionalAmountInput, setOptionalAmountInput] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<"brcode" | "key" | null>(null);

  // Modal de envio de comprovante
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ContributionFormState>({
    categoryId: "",
    amount: "",
    date: todayInputValue(),
    payerName: "",
    description: "",
    file: null,
  });

  // Visualização inline e cancelamento
  const [receiptPreview, setReceiptPreview] = useState<MemberContributionItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MemberContributionItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async (yearToLoad: number) => {
    setLoading(true);
    setError("");
    try {
      const [pixRes, historyRes] = await Promise.all([
        api.get<MemberPixInfoResponse>("/api/minhas-contribuicoes/pix"),
        api.get<MemberContributionsResponse>(`/api/minhas-contribuicoes?year=${yearToLoad}`),
      ]);
      setPixInfo(pixRes);
      setHistory(historyRes);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar suas contribuições.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loadingUser) return;
    if (!hasLinkedMember) {
      setLoading(false);
      return;
    }
    void loadData(selectedYear);
  }, [hasLinkedMember, loadData, loadingUser, selectedYear]);

  const parsedOptionalAmount = useMemo(() => {
    const cleaned = optionalAmountInput.trim().replace(",", ".");
    if (!cleaned) return null;
    const value = Number(cleaned);
    if (!Number.isFinite(value) || value < 0.01 || value > 9_999_999.99) {
      return Number.NaN;
    }
    return value;
  }, [optionalAmountInput]);

  const activeBrCode = useMemo(() => {
    if (!pixInfo?.enabled || !pixInfo.pix) return null;
    if (parsedOptionalAmount === null) return pixInfo.pix.brCode;
    if (Number.isNaN(parsedOptionalAmount)) return null;

    const generated = tryGeneratePixBrCode({
      pixKeyType: pixInfo.pix.pixKeyType,
      pixKey: pixInfo.pix.pixKey,
      merchantName: pixInfo.pix.merchantName,
      merchantCity: pixInfo.pix.merchantCity,
      txidPrefix: pixInfo.pix.txidPrefix,
      amount: parsedOptionalAmount,
    });
    return generated.brCode ?? pixInfo.pix.brCode;
  }, [parsedOptionalAmount, pixInfo]);

  useEffect(() => {
    if (!activeBrCode) {
      setQrDataUrl(null);
      return;
    }
    let active = true;
    QRCode.toDataURL(activeBrCode, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: "M",
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
  }, [activeBrCode]);

  function openSubmitModal(prefill?: Partial<ContributionFormState>) {
    const defaultCategoryId =
      prefill?.categoryId && pixInfo?.categories.some((c) => c.id === prefill.categoryId)
        ? prefill.categoryId
        : (pixInfo?.categories[0]?.id ?? "");

    const defaultAmount =
      prefill?.amount ??
      (parsedOptionalAmount !== null && !Number.isNaN(parsedOptionalAmount)
        ? parsedOptionalAmount.toFixed(2)
        : "");

    setFormError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setForm({
      categoryId: defaultCategoryId,
      amount: defaultAmount,
      date: prefill?.date ?? todayInputValue(),
      payerName: prefill?.payerName ?? "",
      description: prefill?.description ?? "",
      file: null,
    });
    setSubmitModalOpen(true);
  }

  async function handleCopyText(text: string, target: "brcode" | "key") {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(null), 2200);
    } catch {
      // ignore
    }
  }

  async function handleSubmitContribution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError("");

    if (!form.categoryId) {
      setFormError("Selecione a categoria da contribuição.");
      return;
    }
    const numericAmount = Number(form.amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0.01) {
      setFormError("Informe um valor maior que zero.");
      return;
    }
    if (!form.date) {
      setFormError("Informe a data da transferência PIX.");
      return;
    }
    if (!form.file) {
      setFormError("Anexe o comprovante da transferência (JPG, PNG, WEBP ou PDF).");
      return;
    }
    if (!ALLOWED_MIME_TYPES.has(form.file.type)) {
      setFormError("Formato inválido. Envie JPG, PNG, WEBP ou PDF.");
      return;
    }
    if (form.file.size > MAX_FILE_SIZE_BYTES) {
      setFormError("O comprovante deve ter no máximo 10 MB.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("categoryId", form.categoryId);
      formData.append("amount", String(numericAmount));
      formData.append("date", form.date);
      if (form.payerName.trim()) formData.append("payerName", form.payerName.trim());
      if (form.description.trim()) formData.append("description", form.description.trim());
      formData.append("file", form.file);

      await api.post("/api/minhas-contribuicoes", formData);
      setSubmitModalOpen(false);
      setFeedback({
        type: "success",
        message: "Comprovante enviado com sucesso! A tesouraria foi notificada para conferência.",
      });
      const submittedYear = Number(form.date.slice(0, 4)) || selectedYear;
      if (submittedYear !== selectedYear) {
        setSelectedYear(submittedYear);
      } else {
        await loadData(selectedYear);
      }
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Não foi possível enviar o comprovante.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setFeedback(null);
    try {
      await api.delete(`/api/minhas-contribuicoes/${deleteTarget.id}`);
      setDeleteTarget(null);
      setFeedback({
        type: "success",
        message: "Envio cancelado e comprovante removido com sucesso.",
      });
      await loadData(selectedYear);
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message:
          err instanceof Error ? err.message : "Não foi possível cancelar o envio.",
      });
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  if (loadingUser) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!hasLinkedMember) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <PageHeader
          title="Dízimos e Ofertas"
          description="Envie comprovantes PIX e acompanhe seu histórico anual de contribuições."
        />
        <EmptyState
          title="Conta sem cadastro de membro vinculado"
          description="O envio e histórico individual de contribuições requerem vínculo com um cadastro de membro ativo na igreja."
          icon={<HeartHandshake className="h-7 w-7" />}
          action={
            <Link
              href={user?.role === "BASIC" ? "/personal-panel" : "/dashboard"}
              className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-hover"
            >
              Voltar ao início
            </Link>
          }
        />
      </div>
    );
  }

  const canSubmitReceipt = Boolean(pixInfo?.enabled && (pixInfo.categories?.length ?? 0) > 0);
  const formattedKey = pixInfo?.pix
    ? formatPixKeyForDisplay(pixInfo.pix.pixKeyType, pixInfo.pix.pixKey)
    : "";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Dízimos e Ofertas"
        description="Contribua via PIX direto para a igreja, envie seu comprovante e acompanhe seu histórico privado."
        stackActionsOnMobile
        action={
          canSubmitReceipt ? (
            <PrimaryActionButton
              label="Enviar Comprovante"
              onClick={() => openSubmitModal()}
            />
          ) : undefined
        }
      />

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadData(selectedYear)}
            className="shrink-0 font-semibold underline hover:text-red-800"
          >
            Recarregar
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-sm ${
            feedback.type === "success"
              ? "border-emerald-100 bg-emerald-50 text-emerald-700"
              : "border-red-100 bg-red-50 text-red-700"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="shrink-0 font-semibold opacity-70 hover:opacity-100"
          >
            Fechar
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <>
          {/* Card PIX condicional */}
          {pixInfo?.enabled && pixInfo.pix ? (
            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-center">
                <div className="flex flex-col items-center md:col-span-4">
                  <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-xs">
                    {qrDataUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={qrDataUrl}
                        alt="QR Code PIX da igreja"
                        className="h-48 w-48 sm:h-52 sm:w-52"
                      />
                    ) : (
                      <div className="flex h-48 w-48 items-center justify-center text-gray-300">
                        <QrCode className="h-12 w-12" />
                      </div>
                    )}
                  </div>
                  <p className="mt-2.5 text-center text-xs text-gray-500">
                    {pixInfo.pix.merchantName} · {pixInfo.pix.merchantCity}
                  </p>
                </div>

                <div className="space-y-4 md:col-span-8">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-soft-border bg-accent-soft px-3 py-1 text-xs font-bold text-accent-ink">
                      <QrCode className="h-3.5 w-3.5" />
                      PIX Oficial · 0% de taxa
                    </span>
                    <h2 className="mt-2 text-lg font-bold text-gray-900 sm:text-xl">
                      Contribua pelo aplicativo do seu banco
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Leia o QR Code ou copie o código PIX abaixo. Se preferir, informe um valor opcional para já incluir no código.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                        Chave {PIX_KEY_TYPE_LABELS[pixInfo.pix.pixKeyType]}
                      </p>
                      <p className="mt-1 break-all font-mono text-sm font-bold text-gray-900">
                        {formattedKey}
                      </p>
                    </div>

                    <InputField
                      id="member-pix-optional-amount"
                      label="Valor opcional (R$)"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Ex: 100,00"
                      value={optionalAmountInput}
                      error={
                        Number.isNaN(parsedOptionalAmount)
                          ? "Informe um valor válido maior que zero."
                          : null
                      }
                      onChange={(event) => setOptionalAmountInput(event.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      disabled={!activeBrCode}
                      onClick={() => activeBrCode && void handleCopyText(activeBrCode, "brcode")}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-hover disabled:opacity-60 sm:flex-none"
                    >
                      {copiedTarget === "brcode" ? (
                        <>
                          <Check className="h-4 w-4" />
                          Código PIX copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copiar código PIX
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => pixInfo.pix && void handleCopyText(pixInfo.pix.pixKey, "key")}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      {copiedTarget === "key" ? (
                        <>
                          <Check className="h-4 w-4 text-emerald-600" />
                          Chave copiada
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copiar chave
                        </>
                      )}
                    </button>
                  </div>

                  {pixInfo.categories.length === 0 && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <span>
                        A tesouraria ainda não habilitou categorias para envio de comprovantes. Você já pode contribuir usando o PIX acima.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <div className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
              <span>
                O envio digital de novos comprovantes PIX não está ativo no momento. Seu histórico anual abaixo permanece disponível para consulta.
              </span>
            </div>
          )}

          {/* Resumo anual + filtro de ano */}
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Meu histórico anual</h2>
                <p className="text-sm text-gray-500">
                  Visualização privada com seus envios pelo portal e contribuições confirmadas pela tesouraria.
                </p>
              </div>
              <div className="w-full sm:w-40">
                <SelectField
                  id="contributions-year"
                  label="Ano"
                  hideLabel
                  value={String(selectedYear)}
                  onChange={(event) => setSelectedYear(Number(event.target.value))}
                >
                  {(history?.availableYears ?? [selectedYear]).map((year) => (
                    <option key={year} value={year}>
                      Ano {year}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatCard
                title={`Total confirmado em ${selectedYear}`}
                value={currencyFormatter.format(history?.summary.confirmedTotal ?? 0)}
                description={`${history?.summary.confirmedCount ?? 0} contribuição(ões) confirmada(s)`}
                icon={<CheckCircle2 className="h-5 w-5" />}
                color="emerald"
              />
              <StatCard
                title="Em análise"
                value={history?.summary.pendingCount ?? 0}
                description="Comprovantes aguardando conferência da tesouraria"
                icon={<Clock3 className="h-5 w-5" />}
                color="amber"
              />
            </div>

            {!history || history.items.length === 0 ? (
              <EmptyState
                title={`Nenhuma contribuição registrada em ${selectedYear}`}
                description={
                  canSubmitReceipt
                    ? "Após realizar seu PIX, clique em Enviar Comprovante para acompanhar o status aqui."
                    : "Quando houver contribuições confirmadas neste ano, elas aparecerão aqui."
                }
                icon={<HeartHandshake className="h-7 w-7" />}
              />
            ) : (
              <div className="space-y-3">
                {history.items.map((item) => {
                  const statusBadge = getMemberStatusBadge(item.status);
                  return (
                    <EntityCard
                      key={item.id}
                      className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5"
                    >
                      <div className="min-w-0 flex-1 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900">
                            {item.category.name}
                          </h3>
                          <span
                            className={`inline-flex shrink-0 rounded-lg border px-2.5 py-0.5 text-xs font-bold ${statusBadge.className}`}
                          >
                            {statusBadge.label}
                          </span>
                          <span className="text-sm font-extrabold text-gray-900">
                            {currencyFormatter.format(item.amount)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-gray-500">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                            Data: {dateFormatter.format(new Date(item.date))}
                          </span>
                          {item.paymentMethod && (
                            <span>
                              Forma: {PAYMENT_METHOD_LABELS[item.paymentMethod] ?? item.paymentMethod}
                            </span>
                          )}
                          {item.payerName && (
                            <span className="inline-flex items-center gap-1.5">
                              <UserRound className="h-3.5 w-3.5 text-gray-400" />
                              Titular: {item.payerName}
                            </span>
                          )}
                          {item.hasReceipt && (
                            <button
                              type="button"
                              onClick={() => setReceiptPreview(item)}
                              className="inline-flex items-center gap-1.5 font-semibold text-accent-ink hover:text-accent-ink-hover"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Ver comprovante
                            </button>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-xs text-gray-600">{item.description}</p>
                        )}

                        {item.status === "CANCELLED" && item.rejectionReason && (
                          <div className="flex flex-col gap-2 rounded-xl border border-rose-100 bg-rose-50/70 p-3 text-xs text-rose-800 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-2">
                              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                              <span>
                                <strong>Motivo da recusa:</strong> {item.rejectionReason}
                              </span>
                            </div>
                            {canSubmitReceipt && (
                              <button
                                type="button"
                                onClick={() =>
                                  openSubmitModal({
                                    categoryId: item.category.id,
                                    amount: String(item.amount),
                                    date: item.date.slice(0, 10),
                                    payerName: item.payerName ?? "",
                                    description: item.description ?? "",
                                  })
                                }
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 font-semibold text-rose-700 transition hover:bg-rose-50"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Enviar novamente
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {item.canDelete && (
                        <div className="flex justify-end sm:self-start">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Cancelar envio
                          </button>
                        </div>
                      )}
                    </EntityCard>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* Modal Enviar Comprovante */}
      <ModalShell
        isOpen={submitModalOpen}
        title="Enviar Comprovante PIX"
        description="Anexe o comprovante da transferência para conferência pela tesouraria."
        onClose={() => !submitting && setSubmitModalOpen(false)}
        size="md"
        bodyClassName="[overflow-anchor:none]"
        footer={
          <ModalFooter
            onCancel={() => setSubmitModalOpen(false)}
            loading={submitting}
            primaryLabel="Enviar Comprovante"
            form="member-contribution-form"
          />
        }
      >
        <form id="member-contribution-form" onSubmit={handleSubmitContribution}>
          <ModalError message={formError} />
          <div className="space-y-4 p-6">
            <SelectField
              id="contrib-category"
              label="Categoria"
              required
              value={form.categoryId}
              onChange={(event) =>
                setForm((current) => ({ ...current, categoryId: event.target.value }))
              }
            >
              <option value="">Selecione</option>
              {(pixInfo?.categories ?? []).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </SelectField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputField
                id="contrib-amount"
                label="Valor (R$)"
                required
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={form.amount}
                onChange={(event) =>
                  setForm((current) => ({ ...current, amount: event.target.value }))
                }
              />
              <InputField
                id="contrib-date"
                label="Data do PIX"
                required
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm((current) => ({ ...current, date: event.target.value }))
                }
              />
            </div>

            <InputField
              id="contrib-payer-name"
              label="Titular no comprovante"
              optionalLabel="opcional"
              maxLength={120}
              placeholder="Ex: Nome do cônjuge ou conta de origem"
              helperText="Preencha apenas se o PIX saiu da conta bancária de outra pessoa."
              value={form.payerName}
              onChange={(event) =>
                setForm((current) => ({ ...current, payerName: event.target.value }))
              }
            />

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <input
                ref={fileInputRef}
                id="contrib-receipt-file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  setForm((current) => ({ ...current, file: selected }));
                }}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Comprovante *
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {form.file
                      ? `${form.file.name} (${(form.file.size / 1024).toFixed(0)} KB)`
                      : "Foto, print ou PDF até 10 MB (JPG, PNG, WEBP ou PDF)."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-brand-foreground transition hover:bg-brand-hover"
                >
                  <Upload className="h-4 w-4" />
                  {form.file ? "Trocar arquivo" : "Selecionar arquivo"}
                </button>
              </div>
            </div>

            <TextareaField
              id="contrib-description"
              label="Observação"
              optionalLabel="opcional"
              rows={2}
              maxLength={300}
              placeholder="Ex: Referente ao mês de novembro"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </div>
        </form>
      </ModalShell>

      <ReceiptPreviewModal
        isOpen={Boolean(receiptPreview)}
        endpoint={
          receiptPreview ? `/api/minhas-contribuicoes/${receiptPreview.id}/receipt-url` : null
        }
        title="Meu Comprovante"
        fileName={receiptPreview?.receiptFileName}
        mimeType={receiptPreview?.receiptMimeType}
        onClose={() => setReceiptPreview(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Cancelar envio de comprovante"
        description="Este comprovante ainda está em análise pela tesouraria. Ao cancelar, o registro e o arquivo anexado serão removidos permanentemente."
        confirmLabel="Sim, cancelar envio"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
