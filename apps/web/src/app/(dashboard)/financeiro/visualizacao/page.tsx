"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, CalendarDays, CircleDollarSign, CreditCard, FileText, ShieldCheck, Tags, WalletCards } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { EntityCard } from "@/components/app/entity-card";
import { FilterInput, FilterSelect } from "@/components/app/filter-field";
import { FilterActions, FilterShell } from "@/components/app/filter-shell";
import { getMembroPrintName, MembroSearchCombobox, type MembroOption } from "@/components/app/membro-search-combobox";
import { PageHeader } from "@/components/app/page-header";
import { PrintDocumentHeader, PrintScheduleFooter } from "@/components/app/print-layout";
import { Skeleton } from "@/components/app/skeleton";
import { StatCard } from "@/components/app/stat-card";
import { useFilterState } from "@/hooks/use-filter-state";
import { api } from "@/lib/api";
import type { AuthUser } from "@/types";
import {
  FinanceStatusBadge,
  FinanceTypeBadge,
  FinancialTransactionStatus,
  FinancialTransactionType,
  PAYMENT_METHOD_LABELS,
  ROLE_LABELS,
  TRANSACTION_STATUS_LABELS,
  currencyFormatter,
  dateFormatter,
  useFinanceiroData,
} from "../financeiro-shared";

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

type TransactionFilterState = {
  description: string;
  type: "all" | FinancialTransactionType;
  status: "all" | FinancialTransactionStatus;
  memberId: string;
  startDate: string;
  endDate: string;
};

export default function FinanceiroVisualizacaoPage() {
  const initialPeriod = useMemo(() => currentMonthPeriod(), []);
  const initialTransactionFilters = useMemo<TransactionFilterState>(() => ({
    description: "",
    type: "all",
    status: "all",
    memberId: "",
    startDate: initialPeriod.startDate,
    endDate: initialPeriod.endDate,
  }), [initialPeriod.endDate, initialPeriod.startDate]);
  const {
    summary,
    loadingPermission,
    loadingData,
    permissionError,
    dataError,
    transactions,
    financialSummary,
    reloadData,
  } = useFinanceiroData();

  const [appliedTransactionFilters, setAppliedTransactionFilters] = useState<TransactionFilterState>(initialTransactionFilters);
  const [membros, setMembros] = useState<MembroOption[]>([]);
  const [membrosLoading, setMembrosLoading] = useState(false);
  const [membroFilterSearch, setMembroFilterSearch] = useState("");
  const [selectedMembroFilter, setSelectedMembroFilter] = useState<MembroOption | null>(null);
  const [tenantName, setTenantName] = useState("One Elo");
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);
  const [printedAt, setPrintedAt] = useState(() => new Date());

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
    api.get<AuthUser>("/api/auth/me")
      .then((currentUser) => {
        setTenantName(currentUser.tenant?.nome || "One Elo");
        setTenantLogoUrl(currentUser.tenant?.logoUrl ?? null);
      })
      .catch(() => {
        setTenantName("One Elo");
        setTenantLogoUrl(null);
      });
  }, []);

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

  const filteredTransactions = useMemo(
    () => transactions.filter((transaction) => {
      const descriptionSearch = appliedTransactionFilters.description.trim().toLowerCase();
      if (descriptionSearch) {
        const searchable = [
          transaction.description,
          transaction.counterpartyName,
          transaction.paymentMethod,
          transaction.account.name,
          transaction.category.name,
        ].filter(Boolean).join(" ").toLowerCase();
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

  const printPeriod = useMemo(() => {
    if (appliedTransactionFilters.startDate || appliedTransactionFilters.endDate) {
      const start = appliedTransactionFilters.startDate ? dateFormatter.format(new Date(`${appliedTransactionFilters.startDate}T00:00:00`)) : "Início";
      const end = appliedTransactionFilters.endDate ? dateFormatter.format(new Date(`${appliedTransactionFilters.endDate}T00:00:00`)) : "Atual";
      return `${start} - ${end}`;
    }

    if (filteredTransactions.length === 0) return "Sem período";

    const first = filteredTransactions[0];
    const last = filteredTransactions[filteredTransactions.length - 1];
    return `${dateFormatter.format(new Date(first.date))} - ${dateFormatter.format(new Date(last.date))}`;
  }, [appliedTransactionFilters.endDate, appliedTransactionFilters.startDate, filteredTransactions]);

  function clearTransactionFilters() {
    setSelectedMembroFilter(null);
    setMembroFilterSearch("");
    handleClearTransactionFilters();
  }

  function handlePrint() {
    setPrintedAt(new Date());
    window.setTimeout(() => window.print(), 0);
  }

  if (loadingPermission) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
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
        <PageHeader title="Visualização Financeira" description="Antes de visualizar dados financeiros, defina o primeiro gestor financeiro do tenant." />
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
    <div className="p-6">
      <div className="no-print space-y-6">
      <PageHeader
        title="Visualização Financeira"
        description={`Acesso atual: ${summary.role ? ROLE_LABELS[summary.role] : "Sem acesso"}. Consulte saldo, entradas, despesas e extrato.`}
        action={(
          <button
            type="button"
            onClick={handlePrint}
            disabled={loadingData || filteredTransactions.length === 0}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Imprimir
          </button>
        )}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Saldo" value={currencyFormatter.format(financialSummary.balance)} description={`Saldo inicial ${currencyFormatter.format(financialSummary.initialBalance)}`} icon={<WalletCards className="h-5 w-5" />} color="indigo" />
        <StatCard title="Entradas" value={currencyFormatter.format(financialSummary.income)} description={`${financialSummary.transactions} lançamentos no extrato`} icon={<CircleDollarSign className="h-5 w-5" />} color="emerald" />
        <StatCard title="Despesas" value={currencyFormatter.format(financialSummary.expense)} description="Cancelados não entram no saldo" icon={<Banknote className="h-5 w-5" />} color="rose" />
      </div>

      {dataError && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <span>{dataError}</span>
          <button type="button" onClick={() => void reloadData()} className="shrink-0 font-semibold underline underline-offset-2">
            Recarregar
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
              label="De"
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
            <FilterInput label="Até" type="date" min={transactionFilterState.startDate || undefined} value={transactionFilterState.endDate} onChange={(event) => setTransactionFilterField("endDate", event.target.value)} />
          </div>
        </FilterShell>

        {loadingData ? (
          <div className="space-y-4">{Array.from({ length: 2 }).map((_, index) => <EntityCard key={index} loading />)}</div>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState title="Nenhum lançamento encontrado" description="Ajuste os filtros para localizar outros lançamentos." />
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
              </EntityCard>
            ))}
          </div>
        )}
      </section>
      </div>

      <div className="print-area print-document hidden" aria-hidden="true">
        <section className="print-page">
          <PrintDocumentHeader
            organizationName={tenantName}
            documentTitle="Extrato Financeiro"
            period={printPeriod}
            logoUrl={tenantLogoUrl}
          />
          <div className="print-table-frame">
            <table className="print-schedule-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Conta</th>
                  <th>Categoria</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="print-empty">Nenhum lançamento encontrado.</td>
                  </tr>
                ) : filteredTransactions.map((item) => (
                  <tr key={item.id}>
                    <td>{dateFormatter.format(new Date(item.date))}</td>
                    <td>{item.description || item.counterpartyName || "Lançamento financeiro"}</td>
                    <td>{item.type === "INCOME" ? "Entrada" : "Despesa"}</td>
                    <td>{TRANSACTION_STATUS_LABELS[item.status]}</td>
                    <td>{item.account.name}</td>
                    <td>{item.category.name}</td>
                    <td>{currencyFormatter.format(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PrintScheduleFooter printedAt={printedAt} />
        </section>
      </div>
    </div>
  );
}
