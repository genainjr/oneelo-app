"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { AlertTriangle, Check, Copy, QrCode } from "lucide-react";
import { CheckboxField, InputField, SelectField } from "@/components/app/form-field";
import { ModalError, ModalFooter, ModalShell } from "@/components/app/modal-shell";
import { Skeleton } from "@/components/app/skeleton";
import { useAuthUser } from "@/contexts/auth-user-context";
import { api } from "@/lib/api";
import {
  PIX_KEY_TYPE_LABELS,
  formatPixKeyForDisplay,
  sanitizeEmvAsciiText,
  tryGeneratePixBrCode,
  type PixKeyType,
} from "@/lib/pix-brcode";
import type { FinancialAccount, TenantPixConfigResponse } from "@/app/(dashboard)/financeiro/financeiro-shared";

interface PixConfigModalProps {
  isOpen: boolean;
  accounts: FinancialAccount[];
  onClose: () => void;
  onSaved: (pixEnabled: boolean) => void | Promise<void>;
}

interface PixConfigFormState {
  enabled: boolean;
  showOnPublicSite: boolean;
  pixKeyType: PixKeyType;
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  txidPrefix: string;
  defaultAccountId: string;
}

const KEY_PLACEHOLDERS: Record<PixKeyType, string> = {
  CPF: "000.000.000-00",
  CNPJ: "00.000.000/0001-00",
  EMAIL: "tesouraria@igreja.org.br",
  PHONE: "(11) 99999-8888",
  EVP: "00000000-0000-4000-8000-000000000000",
};

export function PixConfigModal({
  isOpen,
  accounts,
  onClose,
  onSaved,
}: PixConfigModalProps) {
  const { user, setUser } = useAuthUser();
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [visibleIncomeCategoriesCount, setVisibleIncomeCategoriesCount] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedPreview, setCopiedPreview] = useState(false);

  const activeAccounts = useMemo(() => accounts.filter((acc) => acc.active), [accounts]);

  const [form, setForm] = useState<PixConfigFormState>({
    enabled: true,
    showOnPublicSite: false,
    pixKeyType: "CNPJ",
    pixKey: "",
    merchantName: "",
    merchantCity: "",
    txidPrefix: "",
    defaultAccountId: "",
  });

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoadingConfig(true);
    setError("");
    setCopiedPreview(false);

    api
      .get<TenantPixConfigResponse>("/api/financeiro/pix-config")
      .then((res) => {
        if (!active) return;
        setVisibleIncomeCategoriesCount(res.visibleIncomeCategoriesCount ?? 0);
        if (res.config) {
          setForm({
            enabled: res.config.enabled,
            showOnPublicSite: res.config.showOnPublicSite,
            pixKeyType: res.config.pixKeyType,
            pixKey: res.config.pixKey,
            merchantName: res.config.merchantName,
            merchantCity: res.config.merchantCity,
            txidPrefix: res.config.txidPrefix ?? "",
            defaultAccountId: res.config.defaultAccountId,
          });
        } else {
          const defaultPixAccount =
            activeAccounts.find((a) => a.type === "PIX") ?? activeAccounts[0];
          setForm({
            enabled: true,
            showOnPublicSite: false,
            pixKeyType: "CNPJ",
            pixKey: "",
            merchantName: res.suggestedMerchantName || "",
            merchantCity: res.suggestedMerchantCity || "",
            txidPrefix: "",
            defaultAccountId: defaultPixAccount?.id ?? "",
          });
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar a configuração PIX.",
        );
      })
      .finally(() => {
        if (active) setLoadingConfig(false);
      });

    return () => {
      active = false;
    };
  }, [activeAccounts, isOpen]);

  const previewResult = useMemo(
    () =>
      tryGeneratePixBrCode({
        pixKeyType: form.pixKeyType,
        pixKey: form.pixKey,
        merchantName: form.merchantName,
        merchantCity: form.merchantCity,
        txidPrefix: form.txidPrefix || null,
      }),
    [form.merchantCity, form.merchantName, form.pixKey, form.pixKeyType, form.txidPrefix],
  );

  useEffect(() => {
    let active = true;
    if (!isOpen || !previewResult.brCode) {
      setQrDataUrl(null);
      return;
    }

    QRCode.toDataURL(previewResult.brCode, {
      width: 220,
      margin: 1,
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
  }, [isOpen, previewResult.brCode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!form.defaultAccountId) {
      setError("Selecione a conta financeira padrão ativa para receber os lançamentos PIX.");
      return;
    }

    if (!previewResult.brCode) {
      setError(previewResult.error || "Revise os dados do PIX antes de salvar.");
      return;
    }

    setSaving(true);
    try {
      const response = await api.put<TenantPixConfigResponse>("/api/financeiro/pix-config", {
        enabled: form.enabled,
        showOnPublicSite: form.enabled ? form.showOnPublicSite : false,
        pixKeyType: form.pixKeyType,
        pixKey: form.pixKey.trim(),
        merchantName: form.merchantName.trim(),
        merchantCity: form.merchantCity.trim(),
        txidPrefix: form.txidPrefix.trim() || null,
        defaultAccountId: form.defaultAccountId,
      });

      const nextEnabled = Boolean(response.config?.enabled);
      setUser((current) =>
        current && current.tenant
          ? { ...current, tenant: { ...current.tenant, pixEnabled: nextEnabled } }
          : current,
      );

      const tenantSlug = user?.tenant?.slug;
      if (tenantSlug) {
        void fetch("/api/site/revalidate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: tenantSlug }),
        }).catch(() => undefined);
      }

      await onSaved(nextEnabled);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Não foi possível salvar a configuração PIX.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyPreviewCode() {
    if (!previewResult.brCode) return;
    try {
      await navigator.clipboard.writeText(previewResult.brCode);
      setCopiedPreview(true);
      setTimeout(() => setCopiedPreview(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <ModalShell
      isOpen={isOpen}
      title="Configurar PIX (Dízimos e Ofertas)"
      description="Defina a chave PIX oficial (EMVCo 0% taxa) usada no app dos membros, telão e site."
      onClose={onClose}
      size="lg"
      bodyClassName="[overflow-anchor:none]"
      footer={
        <ModalFooter
          onCancel={onClose}
          loading={saving}
          disabled={loadingConfig || activeAccounts.length === 0}
          primaryLabel="Salvar configuração PIX"
          form="finance-pix-config-form"
        />
      }
    >
      <form id="finance-pix-config-form" onSubmit={handleSubmit}>
        <ModalError message={error} />

        {loadingConfig ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-5 p-6">
            {activeAccounts.length === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800">
                Cadastre ao menos uma conta financeira ativa em <strong>Cadastros auxiliares</strong> antes de ativar o PIX.
              </div>
            )}

            {form.enabled && visibleIncomeCategoriesCount === 0 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  Nenhuma categoria de entrada está marcada como <strong>Visível para membros</strong>. Após salvar, abra <strong>Cadastros auxiliares → Categorias</strong> e marque ao menos uma (ex.: Dízimos, Ofertas) para habilitar o envio de comprovantes.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                id="pix-key-type"
                label="Tipo da chave PIX"
                required
                value={form.pixKeyType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    pixKeyType: event.target.value as PixKeyType,
                  }))
                }
              >
                {Object.entries(PIX_KEY_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>

              <InputField
                id="pix-key-value"
                label="Chave PIX"
                required
                value={form.pixKey}
                placeholder={KEY_PLACEHOLDERS[form.pixKeyType]}
                onChange={(event) =>
                  setForm((current) => ({ ...current, pixKey: event.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputField
                id="pix-merchant-name"
                label="Nome do recebedor (EMVCo)"
                required
                maxLength={60}
                value={form.merchantName}
                placeholder="Ex: Igreja Batista Central"
                helperText={`Emitido no QR: "${sanitizeEmvAsciiText(form.merchantName, 25) || "—"}" (máx. 25 chars ASCII)`}
                onChange={(event) =>
                  setForm((current) => ({ ...current, merchantName: event.target.value }))
                }
              />

              <InputField
                id="pix-merchant-city"
                label="Cidade do recebedor"
                required
                maxLength={40}
                value={form.merchantCity}
                placeholder="Ex: Sao Paulo"
                helperText={`Emitido no QR: "${sanitizeEmvAsciiText(form.merchantCity, 15) || "—"}" (máx. 15 chars ASCII)`}
                onChange={(event) =>
                  setForm((current) => ({ ...current, merchantCity: event.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                id="pix-default-account"
                label="Conta financeira padrão"
                required
                value={form.defaultAccountId}
                helperText="Os comprovantes enviados pelos membros entram como pendentes nesta conta."
                onChange={(event) =>
                  setForm((current) => ({ ...current, defaultAccountId: event.target.value }))
                }
              >
                <option value="">Selecione uma conta ativa</option>
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </SelectField>

              <InputField
                id="pix-txid-prefix"
                label="Prefixo TXID (opcional)"
                maxLength={25}
                value={form.txidPrefix}
                placeholder="Deixe vazio para usar ***"
                helperText="Apenas letras e números (1–25). Em branco usa *** (compatível com todos os bancos)."
                onChange={(event) =>
                  setForm((current) => ({ ...current, txidPrefix: event.target.value }))
                }
              />
            </div>

            <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
              <CheckboxField
                id="pix-enabled"
                label="Ativar Dízimos e Ofertas PIX para membros"
                helperText="Exibe o menu Contribuições e o atalho no Painel Pessoal para membros vinculados."
                checked={form.enabled}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    enabled: event.target.checked,
                    showOnPublicSite: event.target.checked ? current.showOnPublicSite : false,
                  }))
                }
              />

              <CheckboxField
                id="pix-show-public-site"
                label="Exibir seção de Dízimos e Ofertas no Site Público"
                helperText="Mostra o QR Code e a chave PIX em /[slug] (e no domínio próprio da igreja)."
                checked={form.enabled && form.showOnPublicSite}
                disabled={!form.enabled}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    showOnPublicSite: event.target.checked,
                  }))
                }
              />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-accent-ink" />
                  <h4 className="text-sm font-bold text-gray-900">Prévia do BRCode EMVCo</h4>
                </div>
                {previewResult.brCode && (
                  <button
                    type="button"
                    onClick={() => void handleCopyPreviewCode()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                  >
                    {copiedPreview ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copiar código
                      </>
                    )}
                  </button>
                )}
              </div>

              {previewResult.brCode && qrDataUrl ? (
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="Prévia QR Code PIX"
                    className="h-36 w-36 shrink-0 rounded-xl border border-gray-200 bg-white p-2"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5 text-xs text-gray-600">
                    <p className="font-semibold text-gray-900">
                      {PIX_KEY_TYPE_LABELS[form.pixKeyType]}:{" "}
                      {formatPixKeyForDisplay(form.pixKeyType, form.pixKey)}
                    </p>
                    <p className="break-all rounded-lg border border-gray-100 bg-gray-50 p-2 font-mono text-[11px] text-gray-600">
                      {previewResult.brCode}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
                  {previewResult.error || "Preencha os campos acima para validar o QR Code PIX."}
                </p>
              )}
            </div>
          </div>
        )}
      </form>
    </ModalShell>
  );
}
