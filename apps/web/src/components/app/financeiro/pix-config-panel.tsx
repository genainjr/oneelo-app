"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Presentation,
  QrCode,
  Save,
  ShieldCheck,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { CheckboxField, InputField, SelectField } from "@/components/app/form-field";
import { Skeleton } from "@/components/app/skeleton";
import { StatusBadge } from "@/components/app/status-badge";
import { useAuthUser } from "@/contexts/auth-user-context";
import { api } from "@/lib/api";
import {
  PIX_KEY_TYPE_LABELS,
  formatPixKeyForDisplay,
  sanitizeEmvAsciiText,
  tryGeneratePixBrCode,
  type PixKeyType,
} from "@/lib/pix-brcode";
import type {
  FinancialAccount,
  FinancialCategory,
  TenantPixConfig,
  TenantPixConfigResponse,
} from "@/app/(dashboard)/financeiro/financeiro-shared";

interface PixConfigPanelProps {
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
  canManage: boolean;
  onOpenTelao: () => void;
  onGoToAccounts: () => void;
  onGoToCategories: () => void;
  onSaved: (config: TenantPixConfig | null) => void | Promise<void>;
  onConfigLoaded?: (config: TenantPixConfig | null) => void;
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

export function PixConfigPanel({
  accounts,
  categories,
  canManage,
  onOpenTelao,
  onGoToAccounts,
  onGoToCategories,
  onSaved,
  onConfigLoaded,
}: PixConfigPanelProps) {
  const { user, setUser } = useAuthUser();
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedConfig, setSavedConfig] = useState<TenantPixConfig | null>(null);
  const [apiVisibleCategoriesCount, setApiVisibleCategoriesCount] = useState<number | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedPreview, setCopiedPreview] = useState(false);

  const activeAccounts = useMemo(() => accounts.filter((acc) => acc.active), [accounts]);

  const visibleIncomeCategoriesCount = useMemo(() => {
    if (categories.length > 0) {
      return categories.filter(
        (category) =>
          category.active && category.type === "INCOME" && Boolean(category.visibleToMembers),
      ).length;
    }
    return apiVisibleCategoriesCount ?? 0;
  }, [apiVisibleCategoriesCount, categories]);

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
    let active = true;
    setLoadingConfig(true);
    setError("");
    setCopiedPreview(false);

    api
      .get<TenantPixConfigResponse>("/api/financeiro/pix-config")
      .then((res) => {
        if (!active) return;
        setSavedConfig(res.config ?? null);
        setApiVisibleCategoriesCount(res.visibleIncomeCategoriesCount ?? 0);
        onConfigLoaded?.(res.config ?? null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!form.defaultAccountId && activeAccounts.length > 0 && !savedConfig) {
      const defaultPixAccount =
        activeAccounts.find((a) => a.type === "PIX") ?? activeAccounts[0];
      setForm((current) => ({
        ...current,
        defaultAccountId: defaultPixAccount?.id ?? "",
      }));
    }
  }, [activeAccounts, form.defaultAccountId, savedConfig]);

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
    if (!previewResult.brCode) {
      setQrDataUrl(null);
      return;
    }

    QRCode.toDataURL(previewResult.brCode, {
      width: 240,
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
  }, [previewResult.brCode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
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

      const nextConfig = response.config ?? null;
      const nextEnabled = Boolean(nextConfig?.enabled);
      setSavedConfig(nextConfig);
      onConfigLoaded?.(nextConfig);

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

      await onSaved(nextConfig);
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

  if (loadingConfig) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 lg:col-span-7">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 lg:col-span-5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mx-auto h-48 w-48 rounded-2xl" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (!canManage && !savedConfig) {
    return (
      <EmptyState
        title="Pix ainda não configurado"
        description="Peça ao Gestor Financeiro para cadastrar a chave Pix da igreja e habilitar o QR Code para membros, telão e site."
        icon={<QrCode className="h-7 w-7" />}
      />
    );
  }

  const defaultAccountName =
    savedConfig?.defaultAccount?.name ||
    accounts.find((acc) => acc.id === form.defaultAccountId)?.name ||
    "—";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Coluna principal: formulário (gestor) ou resumo read-only (demais perfis) */}
      <div className="lg:col-span-7">
        {canManage ? (
          <form
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs"
          >
            <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Chave PIX oficial (Dízimos e Ofertas)
                  </h3>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Padrão EMVCo (0% de taxa) exibido na Área do Membro, Telão de Culto e Site Público.
                  </p>
                </div>
                {savedConfig ? (
                  <StatusBadge
                    label={savedConfig.enabled ? "PIX ativo" : "PIX desativado"}
                    className={
                      savedConfig.enabled
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border border-gray-200 bg-gray-100 text-gray-600"
                    }
                  />
                ) : (
                  <StatusBadge
                    label="Não configurado"
                    className="border border-amber-200 bg-amber-50 text-amber-700"
                  />
                )}
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {activeAccounts.length === 0 && (
                <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                      Cadastre ao menos uma conta financeira ativa antes de ativar o PIX.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onGoToAccounts}
                    className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                  >
                    Ir para Contas
                  </button>
                </div>
              )}

              {form.enabled && visibleIncomeCategoriesCount === 0 && (
                <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                      Nenhuma categoria de entrada está marcada como <strong>Visível para membros</strong>. Marque ao menos uma (ex.: Dízimos, Ofertas) para habilitar o envio de comprovantes.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onGoToCategories}
                    className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                  >
                    Ir para Categorias
                  </button>
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
            </div>

            <div className="flex flex-col-reverse items-stretch justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
              <button
                type="submit"
                disabled={saving || activeAccounts.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{saving ? "Salvando..." : "Salvar configuração PIX"}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs">
            <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Chave PIX oficial da igreja
                  </h3>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Dados configurados para Dízimos e Ofertas digitais.
                  </p>
                </div>
                <StatusBadge
                  label={savedConfig?.enabled ? "PIX ativo" : "PIX desativado"}
                  className={
                    savedConfig?.enabled
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border border-gray-200 bg-gray-100 text-gray-600"
                  }
                />
              </div>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Tipo de chave
                  </dt>
                  <dd className="mt-1 text-sm font-bold text-gray-900">
                    {PIX_KEY_TYPE_LABELS[form.pixKeyType]}
                  </dd>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Chave PIX
                  </dt>
                  <dd className="mt-1 break-all text-sm font-bold text-gray-900">
                    {formatPixKeyForDisplay(form.pixKeyType, form.pixKey)}
                  </dd>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Recebedor / Cidade
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-800">
                    {form.merchantName} · {form.merchantCity}
                  </dd>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Conta padrão
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-800">
                    {defaultAccountName}
                  </dd>
                </div>
              </dl>

              <div className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <span>
                  Apenas usuários com permissão de <strong>Gestor Financeiro</strong> podem alterar a chave PIX e a visibilidade nos canais. Você pode projetar ou baixar o QR Code usando o <strong>Telão PIX</strong>.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Coluna lateral: Prévia ao vivo do QR Code EMVCo e atalho do Telão */}
      <div className="lg:col-span-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
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
            <div className="space-y-4">
              <div className="flex flex-col items-center rounded-2xl border border-gray-100 bg-gray-50/70 p-5 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="Prévia QR Code PIX"
                  className="h-48 w-48 rounded-xl border border-gray-200 bg-white p-2.5 shadow-2xs"
                />
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {PIX_KEY_TYPE_LABELS[form.pixKeyType]}
                </p>
                <p className="mt-0.5 break-all text-sm font-bold text-gray-900">
                  {formatPixKeyForDisplay(form.pixKeyType, form.pixKey)}
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-600">Código Copia e Cola</p>
                <p className="break-all rounded-xl border border-gray-100 bg-gray-50 p-3 font-mono text-[11px] leading-relaxed text-gray-600">
                  {previewResult.brCode}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={onOpenTelao}
                  disabled={!savedConfig?.enabled}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-accent-soft-border bg-accent-soft px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-soft-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Presentation className="h-4 w-4" />
                  <span>Abrir Telão PIX (Projeção / PNG)</span>
                </button>
                {!savedConfig?.enabled && (
                  <p className="mt-2 text-center text-xs text-gray-500">
                    Salve a configuração com o PIX ativo para liberar o Modo Telão.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 p-6 text-center text-xs text-gray-500">
              {previewResult.error || "Preencha os campos ao lado para gerar e validar o QR Code PIX."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
