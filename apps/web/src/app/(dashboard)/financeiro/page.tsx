"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, CircleDollarSign, Clock3, CreditCard, FileText, Pencil, ShieldCheck, Tags, Trash2, WalletCards } from "lucide-react";
import { CollapseButton } from "@/components/app/collapse-button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { EntityCard } from "@/components/app/entity-card";
import { FilterInput, FilterSelect } from "@/components/app/filter-field";
import { FilterActions, FilterShell } from "@/components/app/filter-shell";
import { getMembroPrintName, MembroSearchCombobox, type MembroOption } from "@/components/app/membro-search-combobox";
import { PageHeader } from "@/components/app/page-header";
import { PrimaryActionButton } from "@/components/app/primary-action-button";
import { Skeleton } from "@/components/app/skeleton";
import { useFilterState } from "@/hooks/use-filter-state";
import { api } from "@/lib/api";
import { AccountModal, CategoryModal, TransactionModal, TransactionStatusModal, type TransactionFormData } from "./financeiro-modals";
import {
  ACCOUNT_TYPE_LABELS,
  ActiveBadge,
  CATEGORY_TYPE_LABELS,
  FinanceStatusBadge,
  FinanceTypeBadge,
  FinancialAccount,
  FinancialAccountType,
  FinancialCategory,
  FinancialCategoryType,
  FinancialTransaction,
  FinancialTransactionStatus,
  FinancialTransactionType,
  PAYMENT_METHOD_LABELS,
  ROLE_LABELS,
  TRANSACTION_STATUS_LABELS,
  currencyFormatter,
  dateFormatter,
  useFinanceiroData,
} from "./financeiro-shared";

type ModalState =
  | { type: "account"; item: FinancialAccount | null }
  | { type: "category"; item: FinancialCategory | null }
  | { type: "transaction"; item: FinancialTransaction | null }
  | { type: "transaction-status"; item: FinancialTransaction }
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

type TransactionFilterState = {
  description: string;
  type: "all" | FinancialTransactionType;
  status: "all" | FinancialTransactionStatus;
  memberId: string;
  startDate: string;
  endDate: string;
};

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function currentMonthPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(end),
  };
}

const currentMonthFilters = currentMonthPeriod();

const initialTransactionFilters: TransactionFilterState = {
  description: "",
  type: "all",
  status: "all",
  memberId: "",
  startDate: currentMonthFilters.startDate,
  endDate: currentMonthFilters.endDate,
};

export default function FinanceiroPage() {
  const {
    summary,
    loadingPermission,
    loadingData,
    permissionError,
    dataError,
    accounts,
    categories,
    transactions,
    canManage,
    reloadData,
    setDataError,
  } = useFinanceiroData();

  const [modal, setModal] = useState<ModalState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState<FeedbackMessage>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [appliedTransactionFilters, setAppliedTransactionFilters] = useState<TransactionFilterState>(initialTransactionFilters);
  const [auxiliaryCollapsed, setAuxiliaryCollapsed] = useState(true);
  const [membros, setMembros] = useState<MembroOption[]>([]);
  const [membrosLoading, setMembrosLoading] = useState(false);
  const [membroFilterSearch, setMembroFilterSearch] = useState("");
  const [selectedMembroFilter, setSelectedMembroFilter] = useState<MembroOption | null>(null);

  const canCreateTransaction = summary?.role === "FINANCE_OPERATOR" || summary?.role === "FINANCE_APPROVER" || summary?.role === "FINANCE_MANAGER";
  const canCancelTransaction = summary?.role === "FINANCE_APPROVER" || summary?.role === "FINANCE_MANAGER";

  const {
    formState: transactionFilterState,
    setFormState: setTransactionFilterState,
    setField: setTransactionFilterField,
    handleClear: handleClearTransactionFilters,
    handleSubmit: handleTransactionFilterSubmit,
  } = useFilterState({
    initialState: initialTransactionFilters,
    onApply: setAppliedTransactionFilters,
  });

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

  function clearTransactionFilters() {
    setSelectedMembroFilter(null);
    setMembroFilterSearch("");
    handleClearTransactionFilters();
  }

  const filteredTransactions = useMemo(
    () => transactions.filter((transaction) => {
      const descriptionSearch = appliedTransactionFilters.description.trim().toLowerCase();
      if (descriptionSearch) {
        const searchable = (transaction.description || "").toLowerCase();
        if (!searchable.includes(descriptionSearch)) return false;
      }
      if (appliedTransactionFilters.status !== "all" && transaction.status !== appliedTransactionFilters.status) return false;
      if (appliedTransactionFilters.type !== "all" && transaction.type !== appliedTransactionFilters.type) return false;
      if (appliedTransactionFilters.memberId && transaction.memberId !== appliedTransactionFilters.memberId) return false;
      const transactionDate = transaction.date.slice(0, 10);
      if (appliedTransactionFilters.startDate && transactionDate < appliedTransactionFilters.startDate) return false;
      if (appliedTransactionFilters.endDate && transactionDate > appliedTransactionFilters.endDate) return false;
      return true;
    }).sort((first, second) => new Date(first.date).getTime() - new Date(second.date).getTime()),
    [appliedTransactionFilters, transactions],
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
            className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50"
            title="Editar"
          >
            <Pencil className="h-4 w-4 text-indigo-500" />
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
  ], [canManage]);

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
            className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50"
            title="Editar"
          >
            <Pencil className="h-4 w-4 text-indigo-500" />
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

  async function saveCategory(data: { name: string; type: FinancialCategoryType; active: boolean }) {
    if (!data.name.trim()) {
      setFormError("Informe o nome da categoria.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = { name: data.name.trim(), type: data.type, active: data.active };
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
      } else if (removeReceipt && editingTransaction?.receiptUrl) {
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

  async function saveTransactionStatus(status: FinancialTransactionStatus) {
    if (modal?.type !== "transaction-status") return;
    setSaving(true);
    setFormError("");
    try {
      if (status === "CANCELLED") await api.patch(`/api/financeiro/transactions/${modal.item.id}/cancel`, {});
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
          action={<Link href="/configuracoes" className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">Ir para Configurações</Link>}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Financeiro"
        description={`Gerencie os lançamentos financeiros. Acesso atual: ${summary.role ? ROLE_LABELS[summary.role] : "Sem acesso"}.`}
        stackActionsOnMobile
        action={canCreateTransaction ? (
          <PrimaryActionButton label="Novo Lançamento" onClick={() => { setFormError(""); setModal({ type: "transaction", item: null }); }} />
        ) : undefined}
      />

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

      <section className="space-y-4">
        <FilterShell
          onSubmit={handleTransactionFilterSubmit}
          actions={<FilterActions submitLabel="Filtrar" clearLabel="Limpar" onClear={clearTransactionFilters} />}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <FilterSelect label="Status" value={transactionFilterState.status} onChange={(event) => setTransactionFilterField("status", event.target.value as TransactionFilterState["status"])}>
              <option value="all">Todos</option>
              {Object.entries(TRANSACTION_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </FilterSelect>
            <FilterSelect label="Tipo" value={transactionFilterState.type} onChange={(event) => setTransactionFilterField("type", event.target.value as TransactionFilterState["type"])}>
              <option value="all">Todos</option>
              <option value="INCOME">Entradas</option>
              <option value="EXPENSE">Despesas</option>
            </FilterSelect>
            <FilterInput label="Descrição" value={transactionFilterState.description} onChange={(event) => setTransactionFilterField("description", event.target.value)} placeholder="Buscar" />
            <MembroSearchCombobox
              label="Membro"
              optionalLabel="opcional"
              placeholder="Todos"
              loading={membrosLoading}
              options={membros}
              selected={selectedMembroFilter}
              search={membroFilterSearch}
              emptyMessage="Nenhum membro encontrado."
              selectedPrefix="Selecionado"
              onSearchChange={(value) => {
                setMembroFilterSearch(value);
                setSelectedMembroFilter(null);
                setTransactionFilterField("memberId", "");
              }}
              onSelect={(membro) => {
                setSelectedMembroFilter(membro);
                setMembroFilterSearch(getMembroPrintName(membro));
                setTransactionFilterField("memberId", membro.id);
              }}
              onClear={() => {
                setSelectedMembroFilter(null);
                setMembroFilterSearch("");
                setTransactionFilterField("memberId", "");
              }}
            />
            <FilterInput
              label="A partir de (Data)"
              type="date"
              value={transactionFilterState.startDate}
              onChange={(event) => {
                const startDate = event.target.value;
                setTransactionFilterState((current) => ({
                  ...current,
                  startDate,
                  endDate: startDate && current.endDate && current.endDate < startDate ? startDate : current.endDate,
                }));
              }}
            />
            <FilterInput label="Até (Data)" type="date" min={transactionFilterState.startDate || undefined} value={transactionFilterState.endDate} onChange={(event) => setTransactionFilterField("endDate", event.target.value)} />
          </div>
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
                      {item.description || item.counterpartyName || "Lançamento financeiro"}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <FinanceStatusBadge status={item.status} />
                      <FinanceTypeBadge type={item.type} />
                    </div>
                  </div>
                  <div className="grid gap-2 text-xs font-medium text-gray-500 sm:grid-cols-2 xl:grid-cols-5">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="truncate">Data: {dateFormatter.format(new Date(item.date))}</span>
                    </span>
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
                    {item.receiptUrl && (
                      <a href={item.receiptUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 text-indigo-600 hover:text-indigo-700">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Comprovante: {item.receiptFileName || "Abrir"}</span>
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex w-full justify-end sm:w-auto md:self-start">
                  <div className="flex items-center justify-end gap-2">
                    {canCancelTransaction && item.status !== "CANCELLED" && (
                      <button
                        type="button"
                        onClick={() => { setFormError(""); setModal({ type: "transaction-status", item }); }}
                        className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50"
                        title="Mudar status"
                        aria-label="Mudar status"
                      >
                        {item.status === "DRAFT" ? (
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
                        className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4 text-indigo-500" />
                      </button>
                    )}
                    {canCancelTransaction && item.status !== "CANCELLED" && (
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

      <section className="space-y-5 border-t border-gray-100 pt-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Cadastros auxiliares</h2>
            <p className="mt-1 text-sm text-gray-500">Contas e categorias usadas nos lançamentos financeiros.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <CollapseButton
              collapsed={auxiliaryCollapsed}
              onToggle={() => setAuxiliaryCollapsed((current) => !current)}
              collapseLabel="Ocultar cadastros"
              expandLabel="Mostrar cadastros"
            />
          </div>
        </div>

        {!auxiliaryCollapsed && <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Contas e caixas</h3>
                <p className="mt-1 text-sm text-gray-500">Locais onde o dinheiro será movimentado.</p>
              </div>
              {canManage && (
                <PrimaryActionButton
                  label="Nova Conta"
                  onClick={() => { setFormError(""); setModal({ type: "account", item: null }); }}
                />
              )}
            </div>
            <DataTable
              columns={accountColumns}
              data={accounts}
              loading={loadingData}
              showHeader={false}
              itemsPerPage={2}
              emptyTitle="Nenhuma conta cadastrada"
              emptyDescription="Crie uma conta para começar a registrar lançamentos."
            />
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Categorias</h3>
                <p className="mt-1 text-sm text-gray-500">Organização das entradas e despesas.</p>
              </div>
              {canManage && (
                <PrimaryActionButton
                  label="Nova Categoria"
                  onClick={() => { setFormError(""); setModal({ type: "category", item: null }); }}
                />
              )}
            </div>
            <DataTable
              columns={categoryColumns}
              data={categories}
              loading={loadingData}
              showHeader={false}
              itemsPerPage={2}
              emptyTitle="Nenhuma categoria cadastrada"
              emptyDescription="Crie categorias para classificar lançamentos."
            />
          </section>
        </div>}
      </section>

      <AccountModal isOpen={modal?.type === "account"} account={modal?.type === "account" ? modal.item : null} loading={saving} error={formError} onClose={() => setModal(null)} onSubmit={saveAccount} />
      <CategoryModal isOpen={modal?.type === "category"} category={modal?.type === "category" ? modal.item : null} loading={saving} error={formError} onClose={() => setModal(null)} onSubmit={saveCategory} />
      <TransactionModal isOpen={modal?.type === "transaction"} transaction={modal?.type === "transaction" ? modal.item : null} accounts={accounts} categories={categories} loading={saving} error={formError} onClose={() => setModal(null)} onSubmit={saveTransaction} />
      <TransactionStatusModal isOpen={modal?.type === "transaction-status"} transaction={modal?.type === "transaction-status" ? modal.item : null} loading={saving} error={formError} onClose={() => setModal(null)} onSubmit={saveTransactionStatus} />
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
