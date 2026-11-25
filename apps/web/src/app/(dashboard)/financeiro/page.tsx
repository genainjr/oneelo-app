"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarDays, CheckCircle2, CircleDollarSign, Clock3, CreditCard, FileText, Pencil, Presentation, QrCode, ShieldCheck, Tags, Trash2, UserRound, WalletCards, XCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { EntityCard } from "@/components/app/entity-card";
import { getEventoDisplayName, type EventoOption } from "@/components/app/evento-search-combobox";
import { FilterActions, FilterShell } from "@/components/app/filter-shell";
import { PixConfigPanel } from "@/components/app/financeiro/pix-config-panel";
import { PixTelaoModal } from "@/components/app/financeiro/pix-telao-modal";
import { ReceiptPreviewModal } from "@/components/app/financeiro/receipt-preview-modal";
import { getMembroPrintName, type MembroOption } from "@/components/app/membro-search-combobox";
import { PageHeader } from "@/components/app/page-header";
import { PrimaryActionButton } from "@/components/app/primary-action-button";
import { Skeleton } from "@/components/app/skeleton";
import { StatCard } from "@/components/app/stat-card";
import { useAuthUser } from "@/contexts/auth-user-context";
import { useFilterState } from "@/hooks/use-filter-state";
import { api } from "@/lib/api";
import { AccountModal, CategoryModal, RejectContributionModal, TransactionConfirmModal, TransactionModal, TransactionStatusModal, type TransactionBatchFormData, type TransactionConfirmFormData, type TransactionFormData } from "./financeiro-modals";
import {
  ACCOUNT_TYPE_LABELS,
  ActiveBadge,
  FinanceInstallmentBadge,
  FinanceSourceBadge,
  FinanceStatusBadge,
  FinanceTypeBadge,
  FinanceiroTransactionFilterFields,
  FinancialAccount,
  FinancialAccountType,
  FinancialCategory,
  FinancialCategoryType,
  FinancialTransaction,
  FinancialTransactionFilterState,
  FinancialTransactionSource,
  FinancialTransactionStatus,
  PAYMENT_METHOD_LABELS,
  ROLE_LABELS,
  TenantPixConfig,
  TenantPixConfigResponse,
  currencyFormatter,
  dateFormatter,
  financeiroEventosPath,
  getTransactionDisplayTitle,
  matchTransactionSearch,
  toLocalDateInputValue,
  useFinanceiroData,
} from "./financeiro-shared";

type FinanceiroTab = "lancamentos" | "contas" | "categorias" | "pix";
type CategoryQuickFilter = "ALL" | "INCOME" | "EXPENSE" | "MEMBERS";

type ModalState =
  | { type: "account"; item: FinancialAccount | null }
  | { type: "category"; item: FinancialCategory | null }
  | { type: "transaction"; item: FinancialTransaction | null }
  | { type: "transaction-status"; item: FinancialTransaction }
  | { type: "transaction-confirm"; item: FinancialTransaction }
  | { type: "transaction-reject"; item: FinancialTransaction }
  | { type: "pix-telao" }
  | null;

type ConfirmState =
  | { type: "account"; item: FinancialAccount }
  | { type: "category"; item: FinancialCategory }
  | { type: "transaction"; item: FinancialTransaction }
  | null;

type FeedbackMessage = {
  type: "success" | "error";
  message: string;
} | null;

type TransactionFilterState = FinancialTransactionFilterState;

function currentMonthPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: toLocalDateInputValue(start),
    endDate: toLocalDateInputValue(end),
  };
}

const currentMonthFilters = currentMonthPeriod();

const initialTransactionFilters: TransactionFilterState = {
  description: "",
  type: "all",
  status: "all",
  source: "all",
  eventoId: "",
  memberId: "",
  startDate: currentMonthFilters.startDate,
  endDate: currentMonthFilters.endDate,
};

export default function FinanceiroPage() {
  const { user: currentUser } = useAuthUser();
  const [appliedTransactionFilters, setAppliedTransactionFilters] = useState<TransactionFilterState>(initialTransactionFilters);
  const {
    summary,
    loadingPermission,
    loadingData,
    permissionError,
    dataError,
    accounts,
    categories,
    transactions,
    financialSummary,
    canManage,
    reloadData,
    setDataError,
  } = useFinanceiroData(appliedTransactionFilters);

  const [activeTab, setActiveTab] = useState<FinanceiroTab>("lancamentos");
  const [pixConfig, setPixConfig] = useState<TenantPixConfig | null>(null);
  const [categoryQuickFilter, setCategoryQuickFilter] = useState<CategoryQuickFilter>("ALL");
  const [modal, setModal] = useState<ModalState>(null);
  const [receiptPreview, setReceiptPreview] = useState<FinancialTransaction | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState<FeedbackMessage>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [membros, setMembros] = useState<MembroOption[]>([]);
  const [membrosLoading, setMembrosLoading] = useState(false);
  const [eventos, setEventos] = useState<EventoOption[]>([]);
  const [eventosLoading, setEventosLoading] = useState(false);
  const [membroFilterSearch, setMembroFilterSearch] = useState("");
  const [eventoFilterSearch, setEventoFilterSearch] = useState("");
  const [selectedMembroFilter, setSelectedMembroFilter] = useState<MembroOption | null>(null);
  const [selectedEventoFilter, setSelectedEventoFilter] = useState<EventoOption | null>(null);

  const canCreateTransaction = summary?.role === "FINANCE_OPERATOR" || summary?.role === "FINANCE_APPROVER" || summary?.role === "FINANCE_MANAGER";
  const canCancelTransaction = summary?.role === "FINANCE_APPROVER" || summary?.role === "FINANCE_MANAGER";

  const {
    formState: transactionFilterState,
    setFormState: setTransactionFilterState,
    setField: setTransactionFilterField,
    handleClear: handleClearTransactionFilters,
    handleSubmit: handleTransactionFilterSubmit,
    isDebouncing: isTransactionDebouncing,
  } = useFilterState({
    initialState: initialTransactionFilters,
    debounceFields: ["description"],
    debounceMs: 350,
    onApply: setAppliedTransactionFilters,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = (params.get("tab") || "").toLowerCase();
    const sourceParam = params.get("source");
    const statusParam = params.get("status");
    const validSource: FinancialTransactionSource | null =
      sourceParam === "TREASURY" || sourceParam === "MEMBER_PORTAL" ? sourceParam : null;
    const validStatus: FinancialTransactionStatus | null =
      statusParam === "DRAFT" ||
      statusParam === "PENDING" ||
      statusParam === "CONFIRMED" ||
      statusParam === "CANCELLED"
        ? statusParam
        : null;

    if (validSource || validStatus) {
      setActiveTab("lancamentos");
      const nextFilters: TransactionFilterState = {
        ...initialTransactionFilters,
        ...(validSource ? { source: validSource } : {}),
        ...(validStatus ? { status: validStatus } : {}),
        ...(validSource === "MEMBER_PORTAL" && validStatus === "PENDING"
          ? { startDate: "", endDate: "" }
          : {}),
      };
      setTransactionFilterState(nextFilters);
      setAppliedTransactionFilters(nextFilters);
      return;
    }

    if (
      tabParam === "lancamentos" ||
      tabParam === "contas" ||
      tabParam === "categorias" ||
      tabParam === "pix"
    ) {
      setActiveTab(tabParam);
    }
  }, [setTransactionFilterState]);

  useEffect(() => {
    if (!summary?.role) return;
    let active = true;
    api
      .get<TenantPixConfigResponse>("/api/financeiro/pix-config")
      .then((res) => {
        if (active) setPixConfig(res.config ?? null);
      })
      .catch(() => {
        if (active) setPixConfig(null);
      });

    return () => {
      active = false;
    };
  }, [summary?.role]);

  function openPendingMemberQueue() {
    const queueFilters: TransactionFilterState = {
      ...initialTransactionFilters,
      source: "MEMBER_PORTAL",
      status: "PENDING",
      type: "all",
      startDate: "",
      endDate: "",
    };
    setSelectedMembroFilter(null);
    setMembroFilterSearch("");
    setSelectedEventoFilter(null);
    setEventoFilterSearch("");
    setTransactionFilterState(queueFilters);
    setAppliedTransactionFilters(queueFilters);
  }

  useEffect(() => {
    if (!summary?.role) return;
    let active = true;
    setMembrosLoading(true);
    api.get<MembroOption[]>("/api/membros?status=ATIVO")
      .then((data) => {
        if (active) setMembros(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setMembros([]);
      })
      .finally(() => {
        if (active) setMembrosLoading(false);
      });

    return () => {
      active = false;
    };
  }, [summary?.role]);

  useEffect(() => {
    if (!summary?.role) return;
    let active = true;
    setEventosLoading(true);
    api.get<EventoOption[]>(financeiroEventosPath())
      .then((data) => {
        if (active) setEventos(Array.isArray(data) ? data.filter((evento) => evento.status !== "CANCELADO") : []);
      })
      .catch(() => {
        if (active) setEventos([]);
      })
      .finally(() => {
        if (active) setEventosLoading(false);
      });

    return () => {
      active = false;
    };
  }, [summary?.role]);

  function clearTransactionFilters() {
    setSelectedMembroFilter(null);
    setMembroFilterSearch("");
    setSelectedEventoFilter(null);
    setEventoFilterSearch("");
    handleClearTransactionFilters();
  }

  const filteredTransactions = useMemo(
    () => transactions.filter((transaction) => {
      if (!matchTransactionSearch(transaction, appliedTransactionFilters.description)) return false;
      if (appliedTransactionFilters.status !== "all" && transaction.status !== appliedTransactionFilters.status) return false;
      if (appliedTransactionFilters.type !== "all" && transaction.type !== appliedTransactionFilters.type) return false;
      if (appliedTransactionFilters.source !== "all" && (transaction.source ?? "TREASURY") !== appliedTransactionFilters.source) return false;
      if (appliedTransactionFilters.eventoId && transaction.eventoId !== appliedTransactionFilters.eventoId) return false;
      if (appliedTransactionFilters.memberId && transaction.memberId !== appliedTransactionFilters.memberId) return false;
      const transactionDate = transaction.date.slice(0, 10);
      if (appliedTransactionFilters.startDate && transactionDate < appliedTransactionFilters.startDate) return false;
      if (appliedTransactionFilters.endDate && transactionDate > appliedTransactionFilters.endDate) return false;
      return true;
    }).sort((first, second) => new Date(first.date).getTime() - new Date(second.date).getTime()),
    [appliedTransactionFilters, transactions],
  );

  const filteredCategories = useMemo(
    () =>
      categories.filter((category) => {
        if (categoryQuickFilter === "INCOME") return category.type === "INCOME";
        if (categoryQuickFilter === "EXPENSE") return category.type === "EXPENSE";
        if (categoryQuickFilter === "MEMBERS") {
          return category.type === "INCOME" && Boolean(category.visibleToMembers);
        }
        return true;
      }),
    [categories, categoryQuickFilter],
  );

  const accountColumns = useMemo<Column<FinancialAccount>[]>(() => [
    {
      key: "name",
      header: "Conta",
      render: (item) => (
        <div className="min-w-0 space-y-2">
          <p className="break-words text-sm font-bold leading-6 text-gray-800">{item.name}</p>
          <div className="flex flex-wrap items-center gap-2">
            <ActiveBadge active={item.active} />
            <span className="inline-flex shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-600">{ACCOUNT_TYPE_LABELS[item.type]}</span>
            {pixConfig?.enabled && pixConfig.defaultAccountId === item.id && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-accent-soft-border bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-ink">
                <QrCode className="h-3 w-3" />
                Conta padrão PIX
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "initialBalance",
      header: "Saldo inicial",
      render: (item) => currencyFormatter.format(item.initialBalance),
    },
    {
      key: "actions",
      header: "Ações",
      className: "text-right",
      render: (item) => canManage ? (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => { setFormError(""); setModal({ type: "account", item }); }}
            className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-blue-600 transition-all hover:border-blue-200 hover:bg-blue-50"
            title="Editar"
          >
            <Pencil className="h-4 w-4 text-blue-600" />
          </button>
          {item.active && (
            <button
              type="button"
              onClick={() => setConfirm({ type: "account", item })}
              className="flex items-center justify-center rounded-xl border border-red-100 p-2 text-red-500 transition-all hover:bg-red-50"
              title="Inativar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : null,
    },
  ], [canManage, pixConfig?.defaultAccountId, pixConfig?.enabled]);

  const categoryColumns = useMemo<Column<FinancialCategory>[]>(() => [
    {
      key: "name",
      header: "Categoria",
      render: (item) => (
        <div className="min-w-0 space-y-2">
          <p className="break-words text-sm font-bold leading-6 text-gray-800">{item.name}</p>
          <div className="flex flex-wrap items-center gap-2">
            <ActiveBadge active={item.active} />
            <FinanceTypeBadge type={item.type} />
            {item.type === "INCOME" && item.visibleToMembers && (
              <span className="inline-flex shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                Visível p/ membros
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      className: "text-right",
      render: (item) => canManage ? (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => { setFormError(""); setModal({ type: "category", item }); }}
            className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-blue-600 transition-all hover:border-blue-200 hover:bg-blue-50"
            title="Editar"
          >
            <Pencil className="h-4 w-4 text-blue-600" />
          </button>
          {item.active && (
            <button
              type="button"
              onClick={() => setConfirm({ type: "category", item })}
              className="flex items-center justify-center rounded-xl border border-red-100 p-2 text-red-500 transition-all hover:bg-red-50"
              title="Inativar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : null,
    },
  ], [canManage]);

  async function saveAccount(data: { name: string; type: FinancialAccountType; initialBalance: string; active: boolean }) {
    if (!data.name.trim()) {
      setFormError("Informe o nome da conta.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = { name: data.name.trim(), type: data.type, initialBalance: Number(data.initialBalance || 0), active: data.active };
      const editingAccount = modal?.type === "account" ? modal.item : null;
      if (editingAccount) await api.patch(`/api/financeiro/accounts/${editingAccount.id}`, payload);
      else await api.post("/api/financeiro/accounts", payload);
      setModal(null);
      setFeedback({ type: "success", message: editingAccount ? "Conta atualizada com sucesso." : "Conta criada com sucesso." });
      await reloadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar conta.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory(data: { name: string; type: FinancialCategoryType; active: boolean; visibleToMembers: boolean }) {
    if (!data.name.trim()) {
      setFormError("Informe o nome da categoria.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: data.name.trim(),
        type: data.type,
        active: data.active,
        visibleToMembers: data.type === "INCOME" ? data.visibleToMembers : false,
      };
      const editingCategory = modal?.type === "category" ? modal.item : null;
      if (editingCategory) await api.patch(`/api/financeiro/categories/${editingCategory.id}`, payload);
      else await api.post("/api/financeiro/categories", payload);
      setModal(null);
      setFeedback({ type: "success", message: editingCategory ? "Categoria atualizada com sucesso." : "Categoria criada com sucesso." });
      await reloadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar categoria.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTransaction(data: TransactionFormData) {
    if (!data.accountId) {
      setFormError("Selecione a conta do lançamento.");
      return;
    }
    if (!data.categoryId) {
      setFormError("Selecione a categoria do lançamento.");
      return;
    }
    if (!data.amount || Number(data.amount) <= 0) {
      setFormError("Informe um valor maior que zero.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const { receiptFile, removeReceipt, ...transactionData } = data;
      const payload = {
        ...transactionData,
        eventoId: transactionData.eventoId || null,
        paymentMethod: transactionData.paymentMethod || null,
        amount: Number(data.amount),
        date: new Date(`${data.date}T12:00:00`).toISOString(),
      };
      const editingTransaction = modal?.type === "transaction" ? modal.item : null;
      const savedTransaction = editingTransaction
        ? await api.patch<FinancialTransaction>(`/api/financeiro/transactions/${editingTransaction.id}`, payload)
        : await api.post<FinancialTransaction>("/api/financeiro/transactions", payload);
      if (receiptFile) {
        const formData = new FormData();
        formData.append("file", receiptFile);
        await api.post(`/api/financeiro/transactions/${savedTransaction.id}/receipt`, formData);
      } else if (removeReceipt && editingTransaction?.hasReceipt) {
        await api.delete(`/api/financeiro/transactions/${savedTransaction.id}/receipt`);
      }
      setModal(null);
      setFeedback({ type: "success", message: editingTransaction ? "Lançamento atualizado com sucesso." : "Lançamento criado com sucesso." });
      await reloadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar lançamento.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTransactionBatch(data: TransactionBatchFormData) {
    if (!data.accountId) {
      setFormError("Selecione a conta do lançamento.");
      return;
    }
    if (!data.categoryId) {
      setFormError("Selecione a categoria do lançamento.");
      return;
    }
    if (!data.occurrences.length) {
      setFormError("Gere pelo menos uma parcela válida antes de salvar.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        type: data.type,
        defaultStatus: data.defaultStatus,
        accountId: data.accountId,
        categoryId: data.categoryId,
        ...(data.eventoId ? { eventoId: data.eventoId } : {}),
        ...(data.memberId && data.type === "INCOME" ? { memberId: data.memberId } : {}),
        ...(data.description.trim() ? { description: data.description.trim() } : {}),
        paymentMethod: data.paymentMethod || null,
        ...(data.counterpartyName.trim() ? { counterpartyName: data.counterpartyName.trim() } : {}),
        occurrences: data.occurrences.map((occurrence) => ({
          date: occurrence.date,
          amount: occurrence.amount,
          status: occurrence.status,
          installmentNumber: occurrence.installmentNumber,
          totalInstallments: occurrence.totalInstallments,
        })),
      };
      const response = await api.post<{ recurringGroupId: string; count: number }>("/api/financeiro/transactions/batch", payload);
      setModal(null);
      setFeedback({ type: "success", message: `${response.count} lançamento(s) gerado(s) em lote com sucesso.` });
      await reloadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erro ao gerar lançamentos em lote.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTransactionStatus(status: FinancialTransactionStatus) {
    if (modal?.type !== "transaction-status") return;
    setSaving(true);
    setFormError("");
    try {
      if (status === "CANCELLED") await api.patch(`/api/financeiro/transactions/${modal.item.id}/cancel`, {});
      else if (status === "CONFIRMED" && modal.item.status !== "CONFIRMED") await api.patch(`/api/financeiro/transactions/${modal.item.id}/confirm`, {});
      else await api.patch(`/api/financeiro/transactions/${modal.item.id}`, { status });
      setModal(null);
      setFeedback({ type: "success", message: "Status do lançamento atualizado com sucesso." });
      await reloadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Não foi possível alterar o status do lançamento.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmTransactionSettlement(data: TransactionConfirmFormData) {
    if (modal?.type !== "transaction-confirm") return;
    if (!data.paidAt) {
      setFormError("Informe a data de liquidação.");
      return;
    }
    if (!data.amount || Number(data.amount) <= 0) {
      setFormError("Informe um valor liquidado maior que zero.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await api.patch(`/api/financeiro/transactions/${modal.item.id}/confirm`, {
        paidAt: new Date(`${data.paidAt}T12:00:00`).toISOString(),
        paymentMethod: data.paymentMethod || null,
        amount: Number(data.amount),
        accountId: data.accountId || undefined,
        categoryId: data.categoryId || undefined,
      });
      setModal(null);
      setFeedback({ type: "success", message: "Pagamento confirmado e saldo atualizado com sucesso." });
      await reloadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Não foi possível confirmar o pagamento.");
    } finally {
      setSaving(false);
    }
  }

  async function rejectMemberContribution(rejectionReason: string) {
    if (modal?.type !== "transaction-reject") return;
    setSaving(true);
    setFormError("");
    try {
      await api.patch(`/api/financeiro/transactions/${modal.item.id}/reject`, {
        rejectionReason,
      });
      setModal(null);
      setFeedback({ type: "success", message: "Comprovante recusado e membro notificado." });
      await reloadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Não foi possível recusar o comprovante.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmAction() {
    if (!confirm) return;
    setConfirming(true);
    setDataError("");
    try {
      if (confirm.type === "account") await api.delete(`/api/financeiro/accounts/${confirm.item.id}`);
      if (confirm.type === "category") await api.delete(`/api/financeiro/categories/${confirm.item.id}`);
      if (confirm.type === "transaction") await api.patch(`/api/financeiro/transactions/${confirm.item.id}/cancel`, {});
      const successMessage = confirm.type === "account"
        ? "Conta inativada com sucesso."
        : confirm.type === "category"
          ? "Categoria inativada com sucesso."
          : "Lançamento cancelado com sucesso.";
      setConfirm(null);
      setFeedback({ type: "success", message: successMessage });
      await reloadData();
    } catch (err: unknown) {
      setDataError(err instanceof Error ? err.message : "Não foi possível concluir a ação.");
    } finally {
      setConfirming(false);
    }
  }

  if (loadingPermission) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (permissionError) {
    return (
      <div className="p-6">
        <EmptyState title="Não foi possível carregar o financeiro" description={permissionError} icon={<CircleDollarSign className="h-7 w-7" />} />
      </div>
    );
  }

  if (!summary?.canAccess) {
    return (
      <div className="p-6">
        <EmptyState title="Acesso financeiro não liberado" description="Seu usuário não possui permissão específica para acessar o módulo financeiro." icon={<ShieldCheck className="h-7 w-7" />} />
      </div>
    );
  }

  if (summary.canBootstrap && !summary.hasManager) {
    return (
      <div className="p-6">
        <PageHeader title="Financeiro" description="Antes de registrar dados financeiros, defina o primeiro gestor financeiro do tenant." />
        <EmptyState
          title="Configure o primeiro gestor financeiro"
          description="Acesse Configurações > Usuários, edite o usuário responsável e marque Gestor financeiro em Permissões específicas."
          icon={<ShieldCheck className="h-7 w-7" />}
          action={<Link href="/configuracoes" className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-hover">Ir para Configurações</Link>}
        />
      </div>
    );
  }

  const headerAction = (() => {
    if (activeTab === "lancamentos" && canCreateTransaction) {
      return (
        <PrimaryActionButton
          label="Novo Lançamento"
          onClick={() => {
            setFormError("");
            setModal({ type: "transaction", item: null });
          }}
        />
      );
    }
    if (activeTab === "contas" && canManage) {
      return (
        <PrimaryActionButton
          label="Nova Conta"
          onClick={() => {
            setFormError("");
            setModal({ type: "account", item: null });
          }}
        />
      );
    }
    if (activeTab === "categorias" && canManage) {
      return (
        <PrimaryActionButton
          label="Nova Categoria"
          onClick={() => {
            setFormError("");
            setModal({ type: "category", item: null });
          }}
        />
      );
    }
    if (activeTab === "pix" && summary.role) {
      return (
        <button
          type="button"
          onClick={() => setModal({ type: "pix-telao" })}
          disabled={!pixConfig?.enabled}
          title={
            pixConfig?.enabled
              ? "Abrir projeção em tela cheia e download PNG"
              : "Ative a chave PIX para abrir o Modo Telão"
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 max-sm:w-full"
        >
          <Presentation className="h-4 w-4" />
          <span>Telão PIX</span>
        </button>
      );
    }
    return undefined;
  })();

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Financeiro"
        description={`Gerencie lançamentos, contas, categorias e Pix da igreja. Acesso atual: ${summary.role ? ROLE_LABELS[summary.role] : "Sem acesso"}.`}
        stackActionsOnMobile
        action={headerAction}
      />

      {/* Abas do módulo financeiro (padrão ODS: Central de Notificações / Membros) */}
      <div className="border-b border-gray-200">
        <div className="grid grid-cols-2 gap-2 pb-2 sm:flex sm:gap-6 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab("lancamentos")}
            className={`min-h-11 justify-center rounded-xl px-3 text-sm font-semibold transition-all flex items-center gap-2 sm:min-h-0 sm:rounded-none sm:border-b-2 sm:px-1 sm:py-3.5 ${
              activeTab === "lancamentos"
                ? "bg-accent-soft text-accent-ink sm:bg-transparent sm:border-accent-ink sm:text-accent-ink"
                : "text-gray-500 hover:text-gray-700 sm:border-transparent"
            }`}
          >
            <CircleDollarSign className="h-4 w-4 shrink-0" />
            <span>Lançamentos</span>
            {financialSummary.pendingMemberCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white shadow-2xs">
                {financialSummary.pendingMemberCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("contas")}
            className={`min-h-11 justify-center rounded-xl px-3 text-sm font-semibold transition-all flex items-center gap-2 sm:min-h-0 sm:rounded-none sm:border-b-2 sm:px-1 sm:py-3.5 ${
              activeTab === "contas"
                ? "bg-accent-soft text-accent-ink sm:bg-transparent sm:border-accent-ink sm:text-accent-ink"
                : "text-gray-500 hover:text-gray-700 sm:border-transparent"
            }`}
          >
            <WalletCards className="h-4 w-4 shrink-0" />
            <span>Contas</span>
            <span className="text-xs font-semibold opacity-70">({accounts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("categorias")}
            className={`min-h-11 justify-center rounded-xl px-3 text-sm font-semibold transition-all flex items-center gap-2 sm:min-h-0 sm:rounded-none sm:border-b-2 sm:px-1 sm:py-3.5 ${
              activeTab === "categorias"
                ? "bg-accent-soft text-accent-ink sm:bg-transparent sm:border-accent-ink sm:text-accent-ink"
                : "text-gray-500 hover:text-gray-700 sm:border-transparent"
            }`}
          >
            <Tags className="h-4 w-4 shrink-0" />
            <span>Categorias</span>
            <span className="text-xs font-semibold opacity-70">({categories.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("pix")}
            className={`min-h-11 justify-center rounded-xl px-3 text-sm font-semibold transition-all flex items-center gap-2 sm:min-h-0 sm:rounded-none sm:border-b-2 sm:px-1 sm:py-3.5 ${
              activeTab === "pix"
                ? "bg-accent-soft text-accent-ink sm:bg-transparent sm:border-accent-ink sm:text-accent-ink"
                : "text-gray-500 hover:text-gray-700 sm:border-transparent"
            }`}
          >
            <QrCode className="h-4 w-4 shrink-0" />
            <span>Pix</span>
            {pixConfig?.enabled && (
              <span className="h-2 w-2 rounded-full bg-emerald-500" title="PIX ativo" />
            )}
          </button>
        </div>
      </div>

      {dataError && (
        <div className="flex items-center justify-between rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <span>{dataError}</span>
          <button type="button" onClick={() => reloadData()} className="font-semibold underline hover:text-red-800">
            Recarregar
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={`flex items-center justify-between rounded-2xl border p-4 text-sm ${
            feedback.type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-red-100 bg-red-50 text-red-700"
          }`}
        >
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="font-semibold opacity-70 hover:opacity-100">
            Fechar
          </button>
        </div>
      )}

      {activeTab === "lancamentos" && (
        <>
          {financialSummary.pendingMemberCount > 0 && (
            <button
              type="button"
              onClick={openPendingMemberQueue}
              className="flex w-full flex-col items-start justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50 sm:flex-row sm:items-center"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                  <AlertCircle className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-indigo-950">
                    {financialSummary.pendingMemberCount === 1
                      ? "1 comprovante de membro aguardando conferência"
                      : `${financialSummary.pendingMemberCount} comprovantes de membros aguardando conferência`}
                  </p>
                  <p className="text-xs text-indigo-700">
                    Total em análise: {currencyFormatter.format(financialSummary.pendingMemberAmount)} · Clique para abrir a fila completa de conciliação.
                  </p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs">
                Conferir fila
              </span>
            </button>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              title="Saldo realizado"
              value={currencyFormatter.format(financialSummary.balance)}
              description={`${financialSummary.transactions} confirmado(s) • Saldo inicial ${currencyFormatter.format(financialSummary.initialBalance)}`}
              icon={<WalletCards className="h-5 w-5" />}
              color="brand"
              loading={loadingData}
            />
            <StatCard
              title="A receber (Pendente)"
              value={currencyFormatter.format(financialSummary.pendingIncome)}
              description={
                financialSummary.pendingMemberCount > 0
                  ? `${financialSummary.pendingMemberCount} comprovante(s) de membros (${currencyFormatter.format(financialSummary.pendingMemberAmount)})`
                  : "Entradas aguardando recebimento no período"
              }
              icon={<CircleDollarSign className="h-5 w-5" />}
              color="emerald"
              loading={loadingData}
            />
            <StatCard
              title="A pagar (Pendente)"
              value={currencyFormatter.format(financialSummary.pendingExpense)}
              description={`${financialSummary.pendingCount} pendência(s) no período`}
              icon={<Clock3 className="h-5 w-5" />}
              color="amber"
              loading={loadingData}
            />
          </div>

          <section className="space-y-4">
        <FilterShell
          onSubmit={handleTransactionFilterSubmit}
          actions={
            <FilterActions
              clearLabel="Limpar"
              reloadLabel="Recarregar"
              onClear={clearTransactionFilters}
              onReload={() => void reloadData()}
              loading={loadingData}
              isDebouncing={isTransactionDebouncing}
            />
          }
        >
          <FinanceiroTransactionFilterFields
            filters={transactionFilterState}
            onFieldChange={(key, value) => setTransactionFilterField(key, value)}
            onStartDateChange={(startDate) =>
              setTransactionFilterState((current) => ({
                ...current,
                startDate,
                endDate: startDate && current.endDate && current.endDate < startDate ? startDate : current.endDate,
              }))
            }
            eventos={eventos}
            eventosLoading={eventosLoading}
            selectedEvento={selectedEventoFilter}
            eventoSearch={eventoFilterSearch}
            onEventoSearchChange={(value) => {
              setEventoFilterSearch(value);
              setSelectedEventoFilter(null);
              setTransactionFilterField("eventoId", "");
            }}
            onEventoSelect={(evento) => {
              setSelectedEventoFilter(evento);
              setEventoFilterSearch(getEventoDisplayName(evento));
              setTransactionFilterField("eventoId", evento.id);
            }}
            onEventoClear={() => {
              setSelectedEventoFilter(null);
              setEventoFilterSearch("");
              setTransactionFilterField("eventoId", "");
            }}
            membros={membros}
            membrosLoading={membrosLoading}
            selectedMembro={selectedMembroFilter}
            membroSearch={membroFilterSearch}
            onMembroSearchChange={(value) => {
              setMembroFilterSearch(value);
              setSelectedMembroFilter(null);
              setTransactionFilterField("memberId", "");
            }}
            onMembroSelect={(membro) => {
              setSelectedMembroFilter(membro);
              setMembroFilterSearch(getMembroPrintName(membro));
              setTransactionFilterField("memberId", membro.id);
            }}
            onMembroClear={() => {
              setSelectedMembroFilter(null);
              setMembroFilterSearch("");
              setTransactionFilterField("memberId", "");
            }}
          />
        </FilterShell>
        {loadingData ? (
          <div className="space-y-4">{Array.from({ length: 2 }).map((_, index) => <EntityCard key={index} loading />)}</div>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState title="Nenhum lançamento encontrado" description="Crie um lançamento ou ajuste os filtros." />
        ) : (
          <div className="space-y-4">
            {filteredTransactions.map((item) => (
              <EntityCard key={item.id} className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="min-w-0 space-y-2">
                    <h3 className="break-words text-base font-bold leading-6 tracking-tight text-gray-800 sm:text-lg">
                      {getTransactionDisplayTitle(item)}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <FinanceStatusBadge status={item.status} />
                      <FinanceTypeBadge type={item.type} />
                      <FinanceSourceBadge source={item.source} />
                      <FinanceInstallmentBadge installmentNumber={item.installmentNumber} totalInstallments={item.totalInstallments} />
                    </div>
                  </div>
                  <div className="grid gap-2 text-xs font-medium text-gray-500 sm:grid-cols-2 xl:grid-cols-5">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="truncate">Data: {dateFormatter.format(new Date(item.date))}</span>
                    </span>
                    {item.status === "CONFIRMED" && item.paidAt && (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span className="truncate">Liquidado em: {dateFormatter.format(new Date(item.paidAt))}</span>
                      </span>
                    )}
                    <span className="flex min-w-0 items-center gap-1.5">
                      <WalletCards className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="truncate">Conta: {item.account.name}</span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Tags className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="truncate">Categoria: {item.category.name}</span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <CircleDollarSign className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="truncate">Valor: {currencyFormatter.format(item.amount)}</span>
                    </span>
                    {item.paymentMethod && (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="truncate">Pagamento: {PAYMENT_METHOD_LABELS[item.paymentMethod] ?? item.paymentMethod}</span>
                      </span>
                    )}
                    {item.evento && (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="truncate">Evento: {item.evento.titulo}</span>
                      </span>
                    )}
                    {item.payerName && (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="truncate">Titular: {item.payerName}</span>
                      </span>
                    )}
                    {item.hasReceipt && (
                      <button
                        type="button"
                        onClick={() => setReceiptPreview(item)}
                        className="flex min-w-0 items-center gap-1.5 text-left text-accent-ink hover:text-accent-ink-hover"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Comprovante: {item.receiptFileName || "Visualizar"}</span>
                      </button>
                    )}
                  </div>
                  {item.rejectionReason && (
                    <p className="rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2 text-xs text-rose-700">
                      <strong>Motivo da recusa:</strong> {item.rejectionReason}
                    </p>
                  )}
                </div>
                <div className="flex w-full justify-end sm:w-auto md:self-start">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {canCancelTransaction && (item.status === "PENDING" || item.status === "DRAFT") && (
                      <button
                        type="button"
                        onClick={() => { setFormError(""); setModal({ type: "transaction-confirm", item }); }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-100"
                        title="Dar Baixa / Confirmar Pagamento"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Dar Baixa
                      </button>
                    )}
                    {canCancelTransaction && item.source === "MEMBER_PORTAL" && item.status === "PENDING" && (
                      <button
                        type="button"
                        onClick={() => { setFormError(""); setModal({ type: "transaction-reject", item }); }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-all hover:bg-rose-100"
                        title="Recusar comprovante com motivo"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Recusar
                      </button>
                    )}
                    {canCancelTransaction && item.status !== "CANCELLED" && !(item.source === "MEMBER_PORTAL" && item.status === "PENDING") && (
                      <button
                        type="button"
                        onClick={() => { setFormError(""); setModal({ type: "transaction-status", item }); }}
                        className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50"
                        title="Mudar status"
                        aria-label="Mudar status"
                      >
                        {item.status === "DRAFT" || item.status === "PENDING" ? (
                          <Clock3 className="h-4 w-4 text-amber-600" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        )}
                      </button>
                    )}
                    {canCreateTransaction && item.status !== "CANCELLED" && (
                      <button
                        type="button"
                        onClick={() => { setFormError(""); setModal({ type: "transaction", item }); }}
                        className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-blue-600 transition-all hover:border-blue-200 hover:bg-blue-50"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4 text-blue-600" />
                      </button>
                    )}
                    {canCancelTransaction && item.status !== "CANCELLED" && !(item.source === "MEMBER_PORTAL" && item.status === "PENDING") && (
                      <button
                        type="button"
                        onClick={() => setConfirm({ type: "transaction", item })}
                        className="flex items-center justify-center rounded-xl border border-red-100 p-2 text-red-500 transition-all hover:bg-red-50"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </EntityCard>
            ))}
          </div>
        )}
          </section>
        </>
      )}

      {activeTab === "contas" && (
        <section className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Contas e caixas</h3>
            <p className="mt-0.5 text-sm text-gray-500">
              Locais bancários, caixas físicos e contas PIX onde o dinheiro da igreja é movimentado.
            </p>
          </div>
          <DataTable
            columns={accountColumns}
            data={accounts}
            loading={loadingData}
            itemsPerPage={10}
            emptyTitle="Nenhuma conta cadastrada"
            emptyDescription="Crie uma conta para começar a registrar lançamentos financeiros."
          />
        </section>
      )}

      {activeTab === "categorias" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">Categorias</h3>
              <p className="mt-0.5 text-sm text-gray-500">
                Organize entradas e saídas e defina quais entradas ficam disponíveis para os membros no envio de comprovantes PIX.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "ALL", label: "Todas" },
                  { id: "INCOME", label: "Entradas" },
                  { id: "EXPENSE", label: "Saídas" },
                  { id: "MEMBERS", label: "Visíveis p/ membros" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setCategoryQuickFilter(option.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    categoryQuickFilter === option.id
                      ? "bg-accent-soft text-accent-ink ring-1 ring-accent-soft-border"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200/70"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <DataTable
            columns={categoryColumns}
            data={filteredCategories}
            loading={loadingData}
            itemsPerPage={10}
            emptyTitle="Nenhuma categoria encontrada"
            emptyDescription={
              categoryQuickFilter === "ALL"
                ? "Crie categorias para classificar lançamentos financeiros."
                : "Nenhuma categoria corresponde ao filtro selecionado."
            }
          />
        </section>
      )}

      {activeTab === "pix" && (
        <PixConfigPanel
          accounts={accounts}
          categories={categories}
          canManage={canManage}
          onOpenTelao={() => setModal({ type: "pix-telao" })}
          onGoToAccounts={() => setActiveTab("contas")}
          onGoToCategories={() => setActiveTab("categorias")}
          onConfigLoaded={setPixConfig}
          onSaved={async (savedConfig) => {
            setPixConfig(savedConfig);
            setFeedback({ type: "success", message: "Configuração PIX salva com sucesso." });
            await reloadData();
          }}
        />
      )}

      <AccountModal isOpen={modal?.type === "account"} account={modal?.type === "account" ? modal.item : null} loading={saving} error={formError} onClose={() => setModal(null)} onSubmit={saveAccount} />
      <CategoryModal isOpen={modal?.type === "category"} category={modal?.type === "category" ? modal.item : null} loading={saving} error={formError} onClose={() => setModal(null)} onSubmit={saveCategory} />
      <TransactionModal
        isOpen={modal?.type === "transaction"}
        transaction={modal?.type === "transaction" ? modal.item : null}
        accounts={accounts}
        categories={categories}
        loading={saving}
        error={formError}
        canApproveStatus={canCancelTransaction}
        onClose={() => setModal(null)}
        onSubmit={saveTransaction}
        onSubmitBatch={saveTransactionBatch}
        onOpenReceipt={(tx) => setReceiptPreview(tx)}
      />
      <TransactionStatusModal isOpen={modal?.type === "transaction-status"} transaction={modal?.type === "transaction-status" ? modal.item : null} loading={saving} error={formError} onClose={() => setModal(null)} onSubmit={saveTransactionStatus} />
      <TransactionConfirmModal
        isOpen={modal?.type === "transaction-confirm"}
        transaction={modal?.type === "transaction-confirm" ? modal.item : null}
        accounts={accounts}
        categories={categories}
        loading={saving}
        error={formError}
        onClose={() => setModal(null)}
        onSubmit={confirmTransactionSettlement}
        onOpenReceipt={(tx) => setReceiptPreview(tx)}
      />
      <RejectContributionModal
        isOpen={modal?.type === "transaction-reject"}
        transaction={modal?.type === "transaction-reject" ? modal.item : null}
        loading={saving}
        error={formError}
        onClose={() => setModal(null)}
        onSubmit={rejectMemberContribution}
        onOpenReceipt={(tx) => setReceiptPreview(tx)}
      />
      <PixTelaoModal
        isOpen={modal?.type === "pix-telao"}
        churchName={currentUser?.tenant?.nome || "Igreja"}
        churchLogoUrl={currentUser?.tenant?.logoUrl}
        churchSlug={currentUser?.tenant?.slug}
        onClose={() => setModal(null)}
      />
      <ReceiptPreviewModal
        isOpen={Boolean(receiptPreview)}
        endpoint={receiptPreview ? `/api/financeiro/transactions/${receiptPreview.id}/receipt-url` : null}
        title="Comprovante do Lançamento"
        fileName={receiptPreview?.receiptFileName}
        mimeType={receiptPreview?.receiptMimeType}
        onClose={() => setReceiptPreview(null)}
      />
      <ConfirmDialog
        isOpen={!!confirm}
        title={confirm?.type === "transaction" ? "Excluir lançamento" : "Inativar registro"}
        description={confirm?.type === "transaction" ? "O lançamento será cancelado e deixará de compor o saldo." : "O registro será inativado e não ficará disponível para novos lançamentos."}
        confirmLabel={confirm?.type === "transaction" ? "Excluir" : "Inativar"}
        loading={confirming}
        onCancel={() => setConfirm(null)}
        onConfirm={confirmAction}
      />
    </div>
  );
}
