"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CircleDollarSign, Landmark } from "lucide-react";
import { EventoSearchCombobox, getEventoDisplayName, type EventoOption } from "@/components/app/evento-search-combobox";
import { FilterInput, FilterSelect } from "@/components/app/filter-field";
import { getMembroPrintName, MembroSearchCombobox, type MembroOption } from "@/components/app/membro-search-combobox";
import { api } from "@/lib/api";
import { includesNormalizedText } from "@/lib/utils";
import { FinanceRole, type StatusEvento } from "@/types";

export type FinancePermissionSummary = {
  role: FinanceRole | null;
  hasManager: boolean;
  canBootstrap: boolean;
  canManage: boolean;
  canAccess: boolean;
};

export type FinancialAccountType = "CASH" | "BANK" | "PIX" | "OTHER";
export type FinancialCategoryType = "INCOME" | "EXPENSE";
export type FinancialTransactionType = "INCOME" | "EXPENSE";
export type FinancialTransactionStatus = "DRAFT" | "PENDING" | "CONFIRMED" | "CANCELLED";
export type FinancialPaymentMethod = "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "BANK_TRANSFER" | "BOLETO" | "CHECK" | "OTHER";

export type FinanceiroQueryFilters = {
  startDate?: string;
  endDate?: string;
  status?: "all" | FinancialTransactionStatus;
  type?: "all" | FinancialTransactionType;
  accountId?: string;
  categoryId?: string;
  eventoId?: string;
  memberId?: string;
  recurringGroupId?: string;
  limit?: number;
};

export type FinancialAccount = {
  id: string;
  name: string;
  type: FinancialAccountType;
  initialBalance: number;
  active: boolean;
};

export type FinancialCategory = {
  id: string;
  name: string;
  type: FinancialCategoryType;
  active: boolean;
};

export type FinancialTransaction = {
  id: string;
  type: FinancialTransactionType;
  status: FinancialTransactionStatus;
  date: string;
  paidAt?: string | null;
  amount: number;
  description?: string | null;
  paymentMethod?: FinancialPaymentMethod | null;
  eventoId?: string | null;
  evento?: { id: string; titulo: string; dataInicio: string; dataFim?: string | null; local?: string | null; status: StatusEvento } | null;
  counterpartyName?: string | null;
  recurringGroupId?: string | null;
  installmentNumber?: number | null;
  totalInstallments?: number | null;
  receiptUrl?: string | null;
  receiptFileName?: string | null;
  receiptMimeType?: string | null;
  memberId?: string | null;
  member?: { id: string; nome: string; email?: string | null; whatsapp?: string | null } | null;
  account: { id: string; name: string };
  category: { id: string; name: string };
};

export type FinancialSummary = {
  initialBalance: number;
  income: number;
  expense: number;
  balance: number;
  transactions: number;
  pendingIncome: number;
  pendingExpense: number;
  pendingCount: number;
};

export const ROLE_LABELS: Record<FinanceRole, string> = {
  FINANCE_VIEWER: "Visualizador",
  FINANCE_OPERATOR: "Operador",
  FINANCE_APPROVER: "Aprovador",
  FINANCE_MANAGER: "Gestor financeiro",
};

export const ACCOUNT_TYPE_LABELS: Record<FinancialAccountType, string> = {
  CASH: "Dinheiro",
  BANK: "Banco",
  PIX: "Pix",
  OTHER: "Outro",
};

export const CATEGORY_TYPE_LABELS: Record<FinancialCategoryType, string> = {
  INCOME: "Entrada",
  EXPENSE: "Saída",
};

export const TRANSACTION_TYPE_LABELS: Record<FinancialTransactionType, string> = {
  INCOME: "Entrada",
  EXPENSE: "Saída",
};

export const TRANSACTION_STATUS_LABELS: Record<FinancialTransactionStatus, string> = {
  DRAFT: "Rascunho",
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
};

export const PAYMENT_METHOD_LABELS: Record<FinancialPaymentMethod, string> = {
  PIX: "Pix",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  BANK_TRANSFER: "Transferência",
  BOLETO: "Boleto",
  CHECK: "Cheque",
  OTHER: "Outro",
};

export const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
});

export function getTransactionTypeClass(type: FinancialTransactionType | FinancialCategoryType) {
  return type === "INCOME"
    ? "border-teal-200/80 bg-teal-50/70 text-teal-700"
    : "border-rose-200/80 bg-rose-50/70 text-rose-700";
}

export function getTransactionStatusClass(status: FinancialTransactionStatus) {
  if (status === "CANCELLED") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "PENDING") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "DRAFT") return "border-gray-200 bg-gray-100 text-gray-600";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function getCategoryTypeClass(type: FinancialCategoryType) {
  return getTransactionTypeClass(type);
}

export function formatInstallmentLabel(
  installmentNumber?: number | null,
  totalInstallments?: number | null,
) {
  if (!installmentNumber || !totalInstallments) return null;
  return `Parcela ${installmentNumber}/${totalInstallments}`;
}

export function FinanceTypeBadge({ type }: { type: FinancialTransactionType | FinancialCategoryType }) {
  return (
    <span className={`inline-flex shrink-0 rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${getTransactionTypeClass(type)}`}>
      {TRANSACTION_TYPE_LABELS[type]}
    </span>
  );
}

export function FinanceStatusBadge({ status }: { status: FinancialTransactionStatus }) {
  return (
    <span className={`inline-flex shrink-0 rounded-lg border px-2.5 py-0.5 text-xs font-bold ${getTransactionStatusClass(status)}`}>
      {TRANSACTION_STATUS_LABELS[status]}
    </span>
  );
}

export function FinanceInstallmentBadge({
  installmentNumber,
  totalInstallments,
}: {
  installmentNumber?: number | null;
  totalInstallments?: number | null;
}) {
  const label = formatInstallmentLabel(installmentNumber, totalInstallments);
  if (!label) return null;
  return (
    <span className="inline-flex shrink-0 rounded-lg border border-accent-soft-border bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-ink">
      {label}
    </span>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={active ? "inline-flex shrink-0 rounded-lg border border-emerald-150 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700" : "inline-flex shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-bold text-gray-600"}>
      {active ? "Ativa" : "Inativa"}
    </span>
  );
}

export function FinanceEntityIcon({ type }: { type: "account" | "category" | "transaction" }) {
  if (type === "account") return <Landmark className="h-5 w-5" />;
  if (type === "category") return <CircleDollarSign className="h-5 w-5" />;
  return <Banknote className="h-5 w-5" />;
}

export function getTransactionDisplayTitle(transaction: FinancialTransaction) {
  const description = transaction.description?.trim();
  if (description) return description;
  const eventTitle = transaction.evento?.titulo?.trim();
  if (eventTitle) return eventTitle;
  const counterpartyName = transaction.counterpartyName?.trim();
  if (counterpartyName) return counterpartyName;
  return `${TRANSACTION_TYPE_LABELS[transaction.type]} - ${transaction.category.name}`;
}

export function matchTransactionSearch(
  transaction: FinancialTransaction,
  search: string,
): boolean {
  const query = search.trim();
  if (!query) return true;

  const displayTitle = getTransactionDisplayTitle(transaction);
  const paymentLabel = transaction.paymentMethod
    ? PAYMENT_METHOD_LABELS[transaction.paymentMethod] ?? transaction.paymentMethod
    : null;
  const typeLabel = TRANSACTION_TYPE_LABELS[transaction.type];

  const searchable = [
    displayTitle,
    transaction.description,
    typeLabel,
    transaction.category?.name,
    transaction.account?.name,
    transaction.counterpartyName,
    transaction.evento?.titulo,
    transaction.member?.nome,
    paymentLabel,
  ]
    .filter(Boolean)
    .join(" ");

  return includesNormalizedText(searchable, query);
}


export function toLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayInputValue() {
  return toLocalDateInputValue(new Date());
}

export function financeiroEventoLookupPeriod(referenceDate = new Date()) {
  const start = new Date(referenceDate);
  start.setDate(start.getDate() - 60);
  const end = new Date(referenceDate);
  end.setDate(end.getDate() + 30);
  return {
    dataInicio: start.toISOString().slice(0, 10),
    dataFim: end.toISOString().slice(0, 10),
  };
}

export function financeiroEventosPath() {
  const period = financeiroEventoLookupPeriod();
  const params = new URLSearchParams(period);
  return `/api/eventos?${params.toString()}`;
}

const emptySummary: FinancialSummary = {
  initialBalance: 0,
  income: 0,
  expense: 0,
  balance: 0,
  transactions: 0,
  pendingIncome: 0,
  pendingExpense: 0,
  pendingCount: 0,
};

function buildTransactionsUrl(filters?: FinanceiroQueryFilters) {
  const params = new URLSearchParams();
  if (filters?.startDate) params.set("startDate", filters.startDate);
  if (filters?.endDate) params.set("endDate", filters.endDate);
  if (filters?.status && filters.status !== "all") params.set("status", filters.status);
  if (filters?.type && filters.type !== "all") params.set("type", filters.type);
  if (filters?.accountId) params.set("accountId", filters.accountId);
  if (filters?.categoryId) params.set("categoryId", filters.categoryId);
  if (filters?.eventoId) params.set("eventoId", filters.eventoId);
  if (filters?.memberId) params.set("memberId", filters.memberId);
  if (filters?.recurringGroupId) params.set("recurringGroupId", filters.recurringGroupId);
  params.set("limit", String(filters?.limit ?? 500));
  return `/api/financeiro/transactions?${params.toString()}`;
}

function buildSummaryUrl(filters?: FinanceiroQueryFilters) {
  const params = new URLSearchParams();
  if (filters?.startDate) params.set("startDate", filters.startDate);
  if (filters?.endDate) params.set("endDate", filters.endDate);
  if (filters?.accountId) params.set("accountId", filters.accountId);
  const query = params.toString();
  return query ? `/api/financeiro/summary?${query}` : "/api/financeiro/summary";
}

export function useFinanceiroData(filters?: FinanceiroQueryFilters) {
  const [summary, setSummary] = useState<FinancePermissionSummary | null>(null);
  const [loadingPermission, setLoadingPermission] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [dataError, setDataError] = useState("");
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary>(emptySummary);

  const stableFilters = useMemo<FinanceiroQueryFilters | undefined>(
    () =>
      filters
        ? {
            startDate: filters.startDate,
            endDate: filters.endDate,
            status: filters.status,
            type: filters.type,
            accountId: filters.accountId,
            categoryId: filters.categoryId,
            eventoId: filters.eventoId,
            memberId: filters.memberId,
            recurringGroupId: filters.recurringGroupId,
            limit: filters.limit,
          }
        : undefined,
    [
      filters?.accountId,
      filters?.categoryId,
      filters?.endDate,
      filters?.eventoId,
      filters?.limit,
      filters?.memberId,
      filters?.recurringGroupId,
      filters?.startDate,
      filters?.status,
      filters?.type,
    ],
  );

  const loadPermission = useCallback(async () => {
    setLoadingPermission(true);
    setPermissionError("");
    try {
      setSummary(await api.get<FinancePermissionSummary>("/api/financeiro/permissions/me"));
    } catch (err: unknown) {
      setPermissionError(err instanceof Error ? err.message : "Não foi possível verificar seu acesso financeiro.");
    } finally {
      setLoadingPermission(false);
    }
  }, []);

  const loadData = useCallback(async (overrideFilters?: FinanceiroQueryFilters) => {
    const activeFilters = overrideFilters ?? stableFilters;
    setLoadingData(true);
    setDataError("");
    try {
      const [accountsData, categoriesData, transactionsData, summaryData] = await Promise.all([
        api.get<FinancialAccount[]>("/api/financeiro/accounts"),
        api.get<FinancialCategory[]>("/api/financeiro/categories"),
        api.get<FinancialTransaction[]>(buildTransactionsUrl(activeFilters)),
        api.get<FinancialSummary>(buildSummaryUrl(activeFilters)),
      ]);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
      setFinancialSummary(summaryData);
    } catch (err: unknown) {
      setDataError(err instanceof Error ? err.message : "Não foi possível carregar os dados financeiros.");
    } finally {
      setLoadingData(false);
    }
  }, [stableFilters]);

  useEffect(() => {
    void loadPermission();
  }, [loadPermission]);

  useEffect(() => {
    if (!summary?.role) return;
    void loadData();
  }, [loadData, summary?.role]);

  const activeAccounts = useMemo(() => accounts.filter((account) => account.active), [accounts]);
  const activeCategories = useMemo(() => categories.filter((category) => category.active), [categories]);

  return {
    summary,
    loadingPermission,
    loadingData,
    permissionError,
    dataError,
    accounts,
    categories,
    transactions,
    financialSummary,
    activeAccounts,
    activeCategories,
    canManage: summary?.canManage ?? false,
    reloadPermission: loadPermission,
    reloadData: loadData,
    setDataError,
  };
}

export type FinancialTransactionFilterState = {
  description: string;
  type: "all" | FinancialTransactionType;
  status: "all" | FinancialTransactionStatus;
  eventoId: string;
  memberId: string;
  startDate: string;
  endDate: string;
};

export function FinanceiroTransactionFilterFields({
  filters,
  onFieldChange,
  onStartDateChange,
  eventos,
  eventosLoading,
  selectedEvento,
  eventoSearch,
  onEventoSearchChange,
  onEventoSelect,
  onEventoClear,
  membros,
  membrosLoading,
  selectedMembro,
  membroSearch,
  onMembroSearchChange,
  onMembroSelect,
  onMembroClear,
}: {
  filters: FinancialTransactionFilterState;
  onFieldChange: <K extends keyof FinancialTransactionFilterState>(
    key: K,
    value: FinancialTransactionFilterState[K],
  ) => void;
  onStartDateChange: (startDate: string) => void;
  eventos: EventoOption[];
  eventosLoading: boolean;
  selectedEvento: EventoOption | null;
  eventoSearch: string;
  onEventoSearchChange: (value: string) => void;
  onEventoSelect: (evento: EventoOption) => void;
  onEventoClear: () => void;
  membros: MembroOption[];
  membrosLoading: boolean;
  selectedMembro: MembroOption | null;
  membroSearch: string;
  onMembroSearchChange: (value: string) => void;
  onMembroSelect: (membro: MembroOption) => void;
  onMembroClear: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
      <div className="xl:col-span-3">
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(event) =>
            onFieldChange("status", event.target.value as FinancialTransactionFilterState["status"])
          }
        >
          <option value="all">Todos</option>
          {Object.entries(TRANSACTION_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </FilterSelect>
      </div>
      <div className="xl:col-span-3">
        <FilterSelect
          label="Tipo"
          value={filters.type}
          onChange={(event) =>
            onFieldChange("type", event.target.value as FinancialTransactionFilterState["type"])
          }
        >
          <option value="all">Todos</option>
          <option value="INCOME">Entradas</option>
          <option value="EXPENSE">Saídas</option>
        </FilterSelect>
      </div>
      <div className="xl:col-span-3">
        <FilterInput
          label="A partir de (Data)"
          type="date"
          value={filters.startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
        />
      </div>
      <div className="xl:col-span-3">
        <FilterInput
          label="Até (Data)"
          type="date"
          min={filters.startDate || undefined}
          value={filters.endDate}
          onChange={(event) => onFieldChange("endDate", event.target.value)}
        />
      </div>
      <div className="md:col-span-2 xl:col-span-4">
        <FilterInput
          type="search"
          label="Descrição"
          value={filters.description}
          onChange={(event) => onFieldChange("description", event.target.value)}
          placeholder="Buscar por descrição..."
        />
      </div>
      <div className="xl:col-span-4">
        <EventoSearchCombobox
          label="Evento"
          optionalLabel="opcional"
          placeholder="Todos"
          loading={eventosLoading}
          options={eventos}
          selected={selectedEvento}
          search={eventoSearch}
          emptyMessage="Nenhum evento encontrado."
          selectedPrefix="Evento"
          onSearchChange={onEventoSearchChange}
          onSelect={(evento) => {
            onEventoSelect(evento);
            onEventoSearchChange(getEventoDisplayName(evento));
          }}
          onClear={onEventoClear}
        />
      </div>
      <div className="xl:col-span-4">
        <MembroSearchCombobox
          label="Membro"
          optionalLabel="opcional"
          placeholder="Todos"
          loading={membrosLoading}
          options={membros}
          selected={selectedMembro}
          search={membroSearch}
          emptyMessage="Nenhum membro encontrado."
          selectedPrefix="Selecionado"
          onSearchChange={onMembroSearchChange}
          onSelect={(membro) => {
            onMembroSelect(membro);
            onMembroSearchChange(getMembroPrintName(membro));
          }}
          onClear={onMembroClear}
        />
      </div>
    </div>
  );
}
