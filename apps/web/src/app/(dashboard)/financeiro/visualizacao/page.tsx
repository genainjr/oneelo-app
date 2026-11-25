"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, CalendarDays, CircleDollarSign, CreditCard, FileText, LoaderCircle, Share2, ShieldCheck, Tags, WalletCards } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { EntityCard } from "@/components/app/entity-card";
import { getEventoDisplayName, type EventoOption } from "@/components/app/evento-search-combobox";
import { ExportShareErrorBanner, ExportSharePreparedBanner } from "@/components/app/export-share-dialog";
import { FilterActions, FilterShell } from "@/components/app/filter-shell";
import { getMembroPrintName, type MembroOption } from "@/components/app/membro-search-combobox";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/app/skeleton";
import { StatCard } from "@/components/app/stat-card";
import { useDocumentShare } from "@/hooks/use-document-share";
import { useFilterState } from "@/hooks/use-filter-state";
import { useAuthUser } from "@/contexts/auth-user-context";
import { api } from "@/lib/api";
import {
  FinanceInstallmentBadge,
  FinanceStatusBadge,
  FinanceTypeBadge,
  FinanceiroTransactionFilterFields,
  FinancialTransactionFilterState,
  PAYMENT_METHOD_LABELS,
  ROLE_LABELS,
  currencyFormatter,
  dateFormatter,
  financeiroEventosPath,
  getTransactionDisplayTitle,
  matchTransactionSearch,
  toLocalDateInputValue,
  useFinanceiroData,
} from "../financeiro-shared";

function currentMonthPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: toLocalDateInputValue(start),
    endDate: toLocalDateInputValue(end),
  };
}

type TransactionFilterState = FinancialTransactionFilterState;

export default function FinanceiroVisualizacaoPage() {
  const initialPeriod = useMemo(() => currentMonthPeriod(), []);
  const initialTransactionFilters = useMemo<TransactionFilterState>(() => ({
    description: "",
    type: "all",
    status: "all",
    eventoId: "",
    memberId: "",
    startDate: initialPeriod.startDate,
    endDate: initialPeriod.endDate,
  }), [initialPeriod.endDate, initialPeriod.startDate]);
  const [appliedTransactionFilters, setAppliedTransactionFilters] = useState<TransactionFilterState>(initialTransactionFilters);
  const {
    summary,
    loadingPermission,
    loadingData,
    permissionError,
    dataError,
    transactions,
    financialSummary,
    reloadData,
  } = useFinanceiroData(appliedTransactionFilters);
  const [membros, setMembros] = useState<MembroOption[]>([]);
  const [membrosLoading, setMembrosLoading] = useState(false);
  const [eventos, setEventos] = useState<EventoOption[]>([]);
  const [eventosLoading, setEventosLoading] = useState(false);
  const [membroFilterSearch, setMembroFilterSearch] = useState("");
  const [eventoFilterSearch, setEventoFilterSearch] = useState("");
  const [selectedMembroFilter, setSelectedMembroFilter] = useState<MembroOption | null>(null);
  const [selectedEventoFilter, setSelectedEventoFilter] = useState<EventoOption | null>(null);
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);

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

  const { user: currentUser } = useAuthUser();

  useEffect(() => {
    setTenantLogoUrl(currentUser?.tenant?.logoUrl ?? null);
  }, [currentUser]);

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

  const filteredTransactions = useMemo(
    () => transactions.filter((transaction) => {
      if (!matchTransactionSearch(transaction, appliedTransactionFilters.description)) return false;
      if (appliedTransactionFilters.status !== "all" && transaction.status !== appliedTransactionFilters.status) return false;
      if (appliedTransactionFilters.type !== "all" && transaction.type !== appliedTransactionFilters.type) return false;
      if (appliedTransactionFilters.eventoId && transaction.eventoId !== appliedTransactionFilters.eventoId) return false;
      if (appliedTransactionFilters.memberId && transaction.memberId !== appliedTransactionFilters.memberId) return false;
      const transactionDate = transaction.date.slice(0, 10);
      if (appliedTransactionFilters.startDate && transactionDate < appliedTransactionFilters.startDate) return false;
      if (appliedTransactionFilters.endDate && transactionDate > appliedTransactionFilters.endDate) return false;
      return true;
    }).sort((first, second) => new Date(first.date).getTime() - new Date(second.date).getTime()),
    [appliedTransactionFilters, transactions],
  );

  const exportFilter = useMemo(() => {
    const filter: Record<string, string> = {};
    if (appliedTransactionFilters.startDate) filter.startDate = appliedTransactionFilters.startDate;
    if (appliedTransactionFilters.endDate) filter.endDate = appliedTransactionFilters.endDate;
    if (appliedTransactionFilters.status && appliedTransactionFilters.status !== "all") {
      filter.status = appliedTransactionFilters.status;
    }
    if (appliedTransactionFilters.type && appliedTransactionFilters.type !== "all") {
      filter.type = appliedTransactionFilters.type;
    }
    if (appliedTransactionFilters.eventoId) filter.eventoId = appliedTransactionFilters.eventoId;
    if (appliedTransactionFilters.memberId) filter.memberId = appliedTransactionFilters.memberId;
    const trimmedDescription = appliedTransactionFilters.description.trim();
    if (trimmedDescription) filter.description = trimmedDescription;
    return filter;
  }, [appliedTransactionFilters]);

  const defaultPdfFileName = useMemo(() => {
    const { startDate, endDate } = appliedTransactionFilters;
    if (startDate && endDate) {
      if (startDate === endDate) return `extrato-financeiro-${startDate}.pdf`;
      const startMatch = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const endMatch = endDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (startMatch && endMatch && startMatch[1] === endMatch[1] && startMatch[2] === endMatch[2]) {
        const lastDay = new Date(Date.UTC(Number(startMatch[1]), Number(startMatch[2]), 0)).getUTCDate();
        if (Number(startMatch[3]) === 1 && Number(endMatch[3]) === lastDay) {
          return `extrato-financeiro-${startMatch[1]}-${startMatch[2]}.pdf`;
        }
      }
      return `extrato-financeiro-${startDate}-a-${endDate}.pdf`;
    }
    if (startDate) return `extrato-financeiro-a-partir-de-${startDate}.pdf`;
    if (endDate) return `extrato-financeiro-ate-${endDate}.pdf`;
    return "extrato-financeiro.pdf";
  }, [appliedTransactionFilters]);

  const {
    exporting,
    exportError,
    preparedFiles,
    handleExportPdf,
    handleFallbackShare,
    downloadAllFiles,
  } = useDocumentShare({
    endpoint: "/api/financeiro/exportacao",
    filter: exportFilter,
    tenantLogoUrl,
    documentTitle: "Extrato Financeiro",
    defaultPdfFileName,
    resetDependencies: [filteredTransactions],
  });

  function clearTransactionFilters() {
    setSelectedMembroFilter(null);
    setMembroFilterSearch("");
    setSelectedEventoFilter(null);
    setEventoFilterSearch("");
    handleClearTransactionFilters();
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
          action={<Link href="/configuracoes" className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-hover">Ir para Configurações</Link>}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Visualização Financeira"
        description={`Acesso atual: ${summary.role ? ROLE_LABELS[summary.role] : "Sem acesso"}. Consulte saldo, entradas, saídas e extrato.`}
        action={(
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleExportPdf()}
              disabled={loadingData || isTransactionDebouncing || filteredTransactions.length === 0 || exporting !== null}
              aria-label="Compartilhar"
              title="Compartilhar"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-brand-foreground hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            </button>
          </div>
        )}
      />

      <ExportSharePreparedBanner
        preparedFiles={preparedFiles}
        onShare={handleFallbackShare}
        onDownload={downloadAllFiles}
      />

      <ExportShareErrorBanner error={exportError} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <StatCard compact title="Saldo" value={currencyFormatter.format(financialSummary.balance)} description={`Saldo inicial ${currencyFormatter.format(financialSummary.initialBalance)}`} icon={<WalletCards className="h-5 w-5" />} color="brand" loading={loadingData} />
        <StatCard compact title="Entradas" value={currencyFormatter.format(financialSummary.income)} description={`${financialSummary.transactions} confirmado(s) no extrato`} icon={<CircleDollarSign className="h-5 w-5" />} color="emerald" loading={loadingData} />
        <StatCard compact title="Saídas" value={currencyFormatter.format(financialSummary.expense)} description="Cancelados não entram no saldo" icon={<Banknote className="h-5 w-5" />} color="rose" loading={loadingData} />
        <StatCard compact title="A Receber" value={currencyFormatter.format(financialSummary.pendingIncome)} description="Contas pendentes de entrada" icon={<CircleDollarSign className="h-5 w-5" />} color="amber" loading={loadingData} />
        <StatCard compact title="A Pagar" value={currencyFormatter.format(financialSummary.pendingExpense)} description={`${financialSummary.pendingCount} pendência(s) no período`} icon={<Banknote className="h-5 w-5" />} color="amber" loading={loadingData} />
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
          <EmptyState title="Nenhum lançamento encontrado" description="Ajuste os filtros para localizar outros lançamentos." />
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
                        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
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
                    {item.receiptUrl && (
                      <a href={item.receiptUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 text-accent-ink hover:text-accent-ink-hover">
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
  );
}
