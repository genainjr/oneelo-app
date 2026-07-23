"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CircleDollarSign, Landmark } from "lucide-react";
import { api } from "@/lib/api";
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
export type FinancialTransactionStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";
export type FinancialPaymentMethod = "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "BANK_TRANSFER" | "BOLETO" | "CHECK" | "OTHER";

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
  amount: number;
  description?: string | null;
  paymentMethod?: FinancialPaymentMethod | null;
  eventoId?: string | null;
  evento?: { id: string; titulo: string; dataInicio: string; dataFim?: string | null; local?: string | null; status: StatusEvento } | null;
  counterpartyName?: string | null;
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
  EXPENSE: "Despesa",
};

export const TRANSACTION_TYPE_LABELS: Record<FinancialTransactionType, string> = {
  INCOME: "Entrada",
  EXPENSE: "Despesa",
};

export const TRANSACTION_STATUS_LABELS: Record<FinancialTransactionStatus, string> = {
  DRAFT: "Rascunho",
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

export function getTransactionTypeClass(type: FinancialTransactionType) {
  return type === "INCOME" ? "border-emerald-150 bg-emerald-50 text-emerald-700" : "border-rose-150 bg-rose-50 text-rose-700";
}

export function getTransactionStatusClass(status: FinancialTransactionStatus) {
  if (status === "CANCELLED") return "border-rose-150 bg-rose-50 text-rose-700";
  if (status === "DRAFT") return "border-amber-150 bg-amber-50 text-amber-700";
  return "border-emerald-150 bg-emerald-50 text-emerald-700";
}

export function getCategoryTypeClass(type: FinancialCategoryType) {
  return "border-gray-200 bg-gray-50 text-gray-600";
}

export function FinanceTypeBadge({ type }: { type: FinancialTransactionType | FinancialCategoryType }) {
  return (
    <span className={`inline-flex shrink-0 rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${getCategoryTypeClass(type)}`}>
      {type === "INCOME" ? "Entrada" : "Despesa"}
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

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

const emptySummary: FinancialSummary = {
  initialBalance: 0,
  income: 0,
  expense: 0,
  balance: 0,
  transactions: 0,
};

export function useFinanceiroData() {
  const [summary, setSummary] = useState<FinancePermissionSummary | null>(null);
  const [loadingPermission, setLoadingPermission] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [dataError, setDataError] = useState("");
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary>(emptySummary);

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

  const loadData = useCallback(async () => {
    setLoadingData(true);
    setDataError("");
    try {
      const [accountsData, categoriesData, transactionsData, summaryData] = await Promise.all([
        api.get<FinancialAccount[]>("/api/financeiro/accounts"),
        api.get<FinancialCategory[]>("/api/financeiro/categories"),
        api.get<FinancialTransaction[]>("/api/financeiro/transactions"),
        api.get<FinancialSummary>("/api/financeiro/summary"),
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
  }, []);

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
