"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Layers, Upload, X } from "lucide-react";
import { CreationModeSelector } from "@/components/app/creation-mode-selector";
import { EventoSearchCombobox, getEventoDisplayName, type EventoOption } from "@/components/app/evento-search-combobox";
import { CheckboxField, InputField, SelectField } from "@/components/app/form-field";
import { getMembroPrintName, MembroSearchCombobox, type MembroOption } from "@/components/app/membro-search-combobox";
import { ModalError, ModalFooter, ModalShell } from "@/components/app/modal-shell";
import { StatusActionModal } from "@/components/app/status-action-modal";
import { api } from "@/lib/api";
import {
  AMOUNT_DISTRIBUTION_LABELS,
  FINANCIAL_BATCH_MAX_OCCURRENCES,
  RECURRENCE_FREQUENCY_LABELS,
  generateFinancialBatchOccurrences,
  type FinancialAmountDistributionMode,
  type FinancialBatchEndCondition,
  type FinancialRecurrenceFrequency,
} from "@/lib/financial-batch";
import {
  ACCOUNT_TYPE_LABELS,
  CATEGORY_TYPE_LABELS,
  FinancialAccount,
  FinancialAccountType,
  FinancialCategory,
  FinancialCategoryType,
  FinancialPaymentMethod,
  FinancialTransaction,
  FinancialTransactionStatus,
  FinancialTransactionType,
  PAYMENT_METHOD_LABELS,
  TRANSACTION_STATUS_LABELS,
  currencyFormatter,
  dateFormatter,
  financeiroEventosPath,
  getTransactionDisplayTitle,
  todayInputValue,
} from "./financeiro-shared";

type AccountFormData = {
  name: string;
  type: FinancialAccountType;
  initialBalance: string;
  active: boolean;
};

type CategoryFormData = {
  name: string;
  type: FinancialCategoryType;
  active: boolean;
  visibleToMembers: boolean;
};

export type TransactionFormData = {
  type: FinancialTransactionType;
  status: FinancialTransactionStatus;
  date: string;
  amount: string;
  accountId: string;
  categoryId: string;
  eventoId: string;
  description: string;
  paymentMethod: "" | FinancialPaymentMethod;
  counterpartyName: string;
  memberId: string;
  receiptFile?: File | null;
  removeReceipt?: boolean;
};

export type TransactionBatchFormData = {
  type: FinancialTransactionType;
  defaultStatus: "PENDING" | "DRAFT";
  accountId: string;
  categoryId: string;
  eventoId: string;
  description: string;
  paymentMethod: "" | FinancialPaymentMethod;
  counterpartyName: string;
  memberId: string;
  occurrences: Array<{
    date: string;
    amount: number;
    status: FinancialTransactionStatus;
    installmentNumber: number;
    totalInstallments: number;
  }>;
};

export const emptyTransactionForm = (): TransactionFormData => ({
  type: "INCOME",
  status: "CONFIRMED",
  date: todayInputValue(),
  amount: "",
  accountId: "",
  categoryId: "",
  eventoId: "",
  description: "",
  paymentMethod: "",
  counterpartyName: "",
  memberId: "",
  receiptFile: null,
  removeReceipt: false,
});

function withSelectedEvento(options: EventoOption[], selected: EventoOption | null) {
  if (!selected || options.some((option) => option.id === selected.id)) return options;
  return [selected, ...options];
}

export function AccountModal({
  isOpen,
  account,
  loading,
  error,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  account: FinancialAccount | null;
  loading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (data: AccountFormData) => void | Promise<void>;
}) {
  const [form, setForm] = useState<AccountFormData>({
    name: "",
    type: "CASH",
    initialBalance: "0",
    active: true,
  });

  useEffect(() => {
    if (!isOpen) return;
    setForm(account ? {
      name: account.name,
      type: account.type,
      initialBalance: String(account.initialBalance),
      active: account.active,
    } : {
      name: "",
      type: "CASH",
      initialBalance: "0",
      active: true,
    });
  }, [account, isOpen]);

  return (
    <ModalShell
      isOpen={isOpen}
      title={account ? "Editar Conta" : "Nova Conta"}
      onClose={onClose}
      size="md"
      bodyClassName="[overflow-anchor:none]"
      footer={<ModalFooter onCancel={onClose} loading={loading} primaryLabel="Salvar" form="finance-account-form" />}
    >
      <form id="finance-account-form" onSubmit={(event) => { event.preventDefault(); void onSubmit(form); }}>
        <ModalError message={error} />
        <div className="space-y-4 p-6">
          <InputField
            id="finance-account-name"
            label="Nome"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Ex: Caixa igreja"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField id="finance-account-type" label="Tipo" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as FinancialAccountType }))}>
              {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </SelectField>
            <InputField
              id="finance-account-initial-balance"
              label="Saldo inicial"
              type="number"
              min="0"
              step="0.01"
              value={form.initialBalance}
              onChange={(event) => setForm((current) => ({ ...current, initialBalance: event.target.value }))}
            />
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

export function CategoryModal({
  isOpen,
  category,
  loading,
  error,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  category: FinancialCategory | null;
  loading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (data: CategoryFormData) => void | Promise<void>;
}) {
  const [form, setForm] = useState<CategoryFormData>({
    name: "",
    type: "INCOME",
    active: true,
    visibleToMembers: false,
  });

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      category
        ? {
            name: category.name,
            type: category.type,
            active: category.active,
            visibleToMembers: Boolean(category.visibleToMembers && category.type === "INCOME"),
          }
        : { name: "", type: "INCOME", active: true, visibleToMembers: false },
    );
  }, [category, isOpen]);

  return (
    <ModalShell
      isOpen={isOpen}
      title={category ? "Editar Categoria" : "Nova Categoria"}
      onClose={onClose}
      size="md"
      bodyClassName="[overflow-anchor:none]"
      footer={<ModalFooter onCancel={onClose} loading={loading} primaryLabel="Salvar" form="finance-category-form" />}
    >
      <form id="finance-category-form" onSubmit={(event) => { event.preventDefault(); void onSubmit(form); }}>
        <ModalError message={error} />
        <div className="space-y-4 p-6">
          <InputField
            id="finance-category-name"
            label="Nome"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Ex: Dízimos"
          />
          <SelectField
            id="finance-category-type"
            label="Tipo"
            value={form.type}
            onChange={(event) => {
              const nextType = event.target.value as FinancialCategoryType;
              setForm((current) => ({
                ...current,
                type: nextType,
                visibleToMembers: nextType === "INCOME" ? current.visibleToMembers : false,
              }));
            }}
          >
            {Object.entries(CATEGORY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </SelectField>
          {form.type === "INCOME" && (
            <CheckboxField
              id="finance-category-visible-members"
              label="Visível para membros (Dízimos e Ofertas)"
              helperText="Permite que membros selecionem esta categoria ao enviar comprovante PIX."
              checked={form.visibleToMembers}
              onChange={(event) =>
                setForm((current) => ({ ...current, visibleToMembers: event.target.checked }))
              }
            />
          )}
        </div>
      </form>
    </ModalShell>
  );
}

export function TransactionModal({
  isOpen,
  transaction,
  accounts,
  categories,
  loading,
  error,
  canApproveStatus = true,
  onClose,
  onSubmit,
  onSubmitBatch,
  onOpenReceipt,
}: {
  isOpen: boolean;
  transaction?: FinancialTransaction | null;
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
  loading: boolean;
  error?: string;
  canApproveStatus?: boolean;
  onClose: () => void;
  onSubmit: (data: TransactionFormData) => void | Promise<void>;
  onSubmitBatch?: (data: TransactionBatchFormData) => void | Promise<void>;
  onOpenReceipt?: (transaction: FinancialTransaction) => void;
}) {
  const isMemberPortalTransaction = transaction?.source === "MEMBER_PORTAL";
  const [form, setForm] = useState<TransactionFormData>(emptyTransactionForm);
  const [createMode, setCreateMode] = useState<"single" | "batch">("single");
  const [frequency, setFrequency] = useState<FinancialRecurrenceFrequency>("MONTHLY");
  const [endCondition, setEndCondition] = useState<FinancialBatchEndCondition>("COUNT");
  const [occurrenceCount, setOccurrenceCount] = useState("12");
  const [untilDate, setUntilDate] = useState("");
  const [amountMode, setAmountMode] = useState<FinancialAmountDistributionMode>("REPEAT");
  const [batchDefaultStatus, setBatchDefaultStatus] = useState<"PENDING" | "DRAFT">("PENDING");
  const [confirmFirstInstallment, setConfirmFirstInstallment] = useState(false);
  const [excludedDateKeys, setExcludedDateKeys] = useState<Set<string>>(new Set());
  const [membros, setMembros] = useState<MembroOption[]>([]);
  const [membrosLoading, setMembrosLoading] = useState(false);
  const [eventos, setEventos] = useState<EventoOption[]>([]);
  const [eventosLoading, setEventosLoading] = useState(false);
  const [membroSearch, setMembroSearch] = useState("");
  const [eventoSearch, setEventoSearch] = useState("");
  const [selectedMembro, setSelectedMembro] = useState<MembroOption | null>(null);
  const [selectedEvento, setSelectedEvento] = useState<EventoOption | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const isBatchMode = !transaction && createMode === "batch" && Boolean(onSubmitBatch);

  const categoryOptions = useMemo(
    () => categories.filter((category) => category.active && category.type === form.type),
    [categories, form.type],
  );

  const parsedOccurrenceCount = useMemo(() => {
    const trimmed = occurrenceCount.trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) ? parsed : 0;
  }, [occurrenceCount]);

  const batchPreview = useMemo(() => {
    if (!isBatchMode) {
      return { occurrences: [], rawCount: 0, totalAmount: 0, error: null };
    }
    return generateFinancialBatchOccurrences({
      startDate: form.date,
      frequency,
      endCondition,
      count: parsedOccurrenceCount,
      untilDate,
      amountMode,
      amount: Number(form.amount || 0),
      excludedDateKeys,
      baseStatus: batchDefaultStatus,
      confirmFirst: Boolean(canApproveStatus && confirmFirstInstallment),
    });
  }, [
    amountMode,
    batchDefaultStatus,
    canApproveStatus,
    confirmFirstInstallment,
    endCondition,
    excludedDateKeys,
    form.amount,
    form.date,
    frequency,
    isBatchMode,
    parsedOccurrenceCount,
    untilDate,
  ]);

  useEffect(() => {
    if (!isOpen || form.type !== "INCOME") return;
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
  }, [form.type, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const currentEvento = transaction?.evento ?? null;
    setEventosLoading(true);
    api.get<EventoOption[]>(financeiroEventosPath())
      .then((data) => {
        if (active) {
          const options = Array.isArray(data) ? data.filter((evento) => evento.status !== "CANCELADO") : [];
          setEventos(withSelectedEvento(options, currentEvento));
        }
      })
      .catch(() => {
        if (active) setEventos(withSelectedEvento([], currentEvento));
      })
      .finally(() => {
        if (active) setEventosLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, transaction?.evento]);

  useEffect(() => {
    if (!isOpen) return;
    const member = transaction?.member ?? null;
    const evento = transaction?.evento ?? null;
    const counterpartyName = member?.nome ?? transaction?.counterpartyName ?? "";
    setForm(transaction ? {
      type: transaction.type,
      status: transaction.status === "CANCELLED" ? "CONFIRMED" : transaction.status,
      date: transaction.date.slice(0, 10),
      amount: String(transaction.amount),
      accountId: transaction.account.id,
      categoryId: transaction.category.id,
      description: transaction.description ?? "",
      eventoId: transaction.eventoId ?? transaction.evento?.id ?? "",
      paymentMethod: transaction.paymentMethod ?? "",
      counterpartyName,
      memberId: transaction.memberId ?? member?.id ?? "",
      receiptFile: null,
      removeReceipt: false,
    } : emptyTransactionForm());
    setCreateMode("single");
    setFrequency("MONTHLY");
    setEndCondition("COUNT");
    setOccurrenceCount("12");
    setUntilDate("");
    setAmountMode("REPEAT");
    setBatchDefaultStatus("PENDING");
    setConfirmFirstInstallment(false);
    setExcludedDateKeys(new Set());
    setSelectedMembro(member);
    setMembroSearch(counterpartyName);
    setSelectedEvento(evento);
    setEventoSearch(evento ? getEventoDisplayName(evento) : "");
  }, [isOpen, transaction]);

  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBatchMode && onSubmitBatch) {
      void onSubmitBatch({
        type: form.type,
        defaultStatus: batchDefaultStatus,
        accountId: form.accountId,
        categoryId: form.categoryId,
        eventoId: form.eventoId,
        description: form.description,
        paymentMethod: form.paymentMethod,
        counterpartyName: form.counterpartyName,
        memberId: form.memberId,
        occurrences: batchPreview.occurrences.map((occurrence) => ({
          date: occurrence.dateIso,
          amount: occurrence.amount,
          status: occurrence.status,
          installmentNumber: occurrence.installmentNumber,
          totalInstallments: occurrence.totalInstallments,
        })),
      });
      return;
    }
    void onSubmit(form);
  }

  const batchScheduleInvalid =
    isBatchMode && (Boolean(batchPreview.error) || batchPreview.occurrences.length === 0);

  return (
    <ModalShell
      isOpen={isOpen}
      title={transaction ? "Editar Lançamento" : "Novo Lançamento"}
      onClose={onClose}
      size={isBatchMode ? "lg" : "md"}
      height={!transaction ? "viewport" : "auto"}
      bodyClassName="[overflow-anchor:none]"
      footer={
        <ModalFooter
          onCancel={onClose}
          loading={loading}
          disabled={batchScheduleInvalid}
          primaryLabel={isBatchMode ? "Gerar Lote" : "Salvar"}
          form="finance-transaction-form"
        />
      }
    >
      <form id="finance-transaction-form" onSubmit={handleFormSubmit}>
        <ModalError message={error} />
        <div className="space-y-4 p-6">
          {!transaction && onSubmitBatch && (
            <CreationModeSelector
              legend="Forma de lançamento"
              options={[
                {
                  id: "single",
                  title: "Lançamento único",
                  description: "Registra uma única entrada ou saída.",
                },
                {
                  id: "batch",
                  title: "Recorrente / Parcelado",
                  description: "Gera várias ocorrências ou parcelas em lote.",
                },
              ]}
              selected={createMode}
              onChange={(mode) => {
                setCreateMode(mode);
                setExcludedDateKeys(new Set());
              }}
            />
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              id="finance-type"
              label="Tipo"
              required
              disabled={isMemberPortalTransaction}
              value={form.type}
              onChange={(event) => {
                const type = event.target.value as FinancialTransactionType;
                setForm((current) => ({
                  ...current,
                  type,
                  categoryId: "",
                  memberId: "",
                  counterpartyName: "",
                }));
                setSelectedMembro(null);
                setMembroSearch("");
              }}
            >
              <option value="INCOME">Entrada</option>
              <option value="EXPENSE">Saída</option>
            </SelectField>
            {isBatchMode ? (
              <SelectField
                id="finance-batch-default-status"
                label="Status inicial das parcelas"
                value={batchDefaultStatus}
                onChange={(event) =>
                  setBatchDefaultStatus(event.target.value as "PENDING" | "DRAFT")
                }
              >
                <option value="PENDING">{TRANSACTION_STATUS_LABELS.PENDING}</option>
                <option value="DRAFT">{TRANSACTION_STATUS_LABELS.DRAFT}</option>
              </SelectField>
            ) : (
              <SelectField
                id="finance-status"
                label="Status"
                disabled={isMemberPortalTransaction}
                helperText={
                  isMemberPortalTransaction
                    ? "Use Dar Baixa ou Recusar para concluir contribuições do membro."
                    : undefined
                }
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as FinancialTransactionStatus,
                  }))
                }
              >
                <option value="CONFIRMED">{TRANSACTION_STATUS_LABELS.CONFIRMED}</option>
                <option value="PENDING">{TRANSACTION_STATUS_LABELS.PENDING}</option>
                <option value="DRAFT">{TRANSACTION_STATUS_LABELS.DRAFT}</option>
              </SelectField>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField
              id="finance-date"
              label={isBatchMode ? "1º vencimento" : "Data"}
              required
              type="date"
              value={form.date}
              onChange={(event) => {
                const date = event.target.value;
                setForm((current) => ({ ...current, date }));
                if (isBatchMode) setExcludedDateKeys(new Set());
              }}
            />
            <InputField
              id="finance-amount"
              label={
                isBatchMode
                  ? amountMode === "SPLIT"
                    ? "Valor total"
                    : "Valor por parcela"
                  : "Valor"
              }
              required
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) =>
                setForm((current) => ({ ...current, amount: event.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField id="finance-account" label="Conta" required value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}>
              <option value="">Selecione</option>
              {accounts.filter((account) => account.active).map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </SelectField>
            <SelectField id="finance-category" label="Categoria" required value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
              <option value="">Selecione</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </SelectField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField id="finance-payment" label="Pagamento" value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value as TransactionFormData["paymentMethod"] }))}>
              <option value="">Selecione</option>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </SelectField>
            <InputField id="finance-description" label="Descrição" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Ex: Oferta do culto" />
          </div>
          <EventoSearchCombobox
            label="Evento"
            optionalLabel="opcional"
            placeholder="Buscar evento pelo nome..."
            loading={eventosLoading}
            options={eventos}
            selected={selectedEvento}
            search={eventoSearch}
            emptyMessage="Nenhum evento encontrado."
            selectedPrefix="Evento"
            onSearchChange={setEventoSearch}
            onSelect={(evento) => {
              setSelectedEvento(evento);
              setEventoSearch(getEventoDisplayName(evento));
              setForm((current) => ({ ...current, eventoId: evento.id }));
            }}
            onClear={() => {
              setSelectedEvento(null);
              setEventoSearch("");
              setForm((current) => ({ ...current, eventoId: "" }));
            }}
          />
          <div className="grid grid-cols-1 gap-4">
            {form.type === "INCOME" ? (
              isMemberPortalTransaction ? (
                <InputField
                  id="finance-member-readonly"
                  label="Membro vinculado"
                  value={transaction?.member?.nome || form.counterpartyName || "Membro"}
                  disabled
                  helperText={
                    transaction?.payerName
                      ? `Titular informado no comprovante: ${transaction.payerName}`
                      : "O vínculo do membro em contribuições do portal não pode ser alterado."
                  }
                  onChange={() => {}}
                />
              ) : (
                <MembroSearchCombobox
                  label="Membro"
                  optionalLabel="opcional"
                  placeholder="Buscar membro pelo nome..."
                  loading={membrosLoading}
                  options={membros}
                  selected={selectedMembro}
                  search={membroSearch}
                  emptyMessage="Nenhum membro encontrado."
                  selectedPrefix="Selecionado"
                  onSearchChange={(value) => {
                    setMembroSearch(value);
                    setSelectedMembro(null);
                    setForm((current) => ({ ...current, memberId: "", counterpartyName: value }));
                  }}
                  onSelect={(membro) => {
                    const membroPrintName = getMembroPrintName(membro);
                    setSelectedMembro(membro);
                    setMembroSearch(membroPrintName);
                    setForm((current) => ({ ...current, memberId: membro.id, counterpartyName: membroPrintName }));
                  }}
                  onClear={() => {
                    setSelectedMembro(null);
                    setMembroSearch("");
                    setForm((current) => ({ ...current, memberId: "", counterpartyName: "" }));
                  }}
                />
              )
            ) : (
              <InputField id="finance-counterparty" label="Fornecedor" value={form.counterpartyName} onChange={(event) => setForm((current) => ({ ...current, counterpartyName: event.target.value, memberId: "" }))} />
            )}
          </div>
          {isBatchMode ? (
            <section className="space-y-4 rounded-2xl border border-accent-soft-border bg-accent-soft/40 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent-ink">
                <Layers className="h-4 w-4 shrink-0" />
                <span>Recorrência e parcelamento</span>
              </div>

              <CreationModeSelector
                legend="Regra de valor"
                options={[
                  {
                    id: "REPEAT",
                    title: "Repetir valor",
                    description: AMOUNT_DISTRIBUTION_LABELS.REPEAT,
                  },
                  {
                    id: "SPLIT",
                    title: "Parcelar valor",
                    description: AMOUNT_DISTRIBUTION_LABELS.SPLIT,
                  },
                ]}
                selected={amountMode}
                onChange={(mode) => setAmountMode(mode)}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <SelectField
                  id="finance-batch-frequency"
                  label="Periodicidade"
                  value={frequency}
                  onChange={(event) => {
                    setFrequency(event.target.value as FinancialRecurrenceFrequency);
                    setExcludedDateKeys(new Set());
                  }}
                >
                  {Object.entries(RECURRENCE_FREQUENCY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </SelectField>

                <SelectField
                  id="finance-batch-end-condition"
                  label="Término"
                  value={endCondition}
                  onChange={(event) => {
                    setEndCondition(event.target.value as FinancialBatchEndCondition);
                    setExcludedDateKeys(new Set());
                  }}
                >
                  <option value="COUNT">Por quantidade</option>
                  <option value="UNTIL_DATE">Até data limite</option>
                </SelectField>

                {endCondition === "COUNT" ? (
                  <InputField
                    id="finance-batch-count"
                    label="Nº de parcelas"
                    required
                    type="number"
                    min="1"
                    max={FINANCIAL_BATCH_MAX_OCCURRENCES}
                    step="1"
                    value={occurrenceCount}
                    onChange={(event) => {
                      setOccurrenceCount(event.target.value);
                      setExcludedDateKeys(new Set());
                    }}
                  />
                ) : (
                  <InputField
                    id="finance-batch-until"
                    label="Data limite"
                    required
                    type="date"
                    min={form.date || undefined}
                    value={untilDate}
                    onChange={(event) => {
                      setUntilDate(event.target.value);
                      setExcludedDateKeys(new Set());
                    }}
                  />
                )}
              </div>

              {canApproveStatus && (
                <CheckboxField
                  id="finance-batch-confirm-first"
                  label="Marcar 1ª parcela como confirmada no ato"
                  helperText="Contabiliza apenas a 1ª ocorrência no saldo realizado; as demais ficam no status inicial escolhido."
                  checked={confirmFirstInstallment}
                  onChange={(event) => setConfirmFirstInstallment(event.target.checked)}
                />
              )}

              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-gray-800">Prévia das parcelas</p>
                    <p className="text-xs text-gray-500">
                      {batchPreview.occurrences.length} de {FINANCIAL_BATCH_MAX_OCCURRENCES} máx.
                      {batchPreview.occurrences.length > 0 && ` • Total ${currencyFormatter.format(batchPreview.totalAmount)}`}
                    </p>
                  </div>
                  {excludedDateKeys.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setExcludedDateKeys(new Set())}
                      className="text-xs font-semibold text-accent-ink hover:text-accent-ink-hover"
                    >
                      Restaurar removidas ({excludedDateKeys.size})
                    </button>
                  )}
                </div>

                {batchPreview.error ? (
                  <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{batchPreview.error}</p>
                ) : batchPreview.occurrences.length === 0 ? (
                  <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
                    Informe valor e período válidos para visualizar as ocorrências geradas.
                  </p>
                ) : (
                  <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                    {batchPreview.occurrences.map((occurrence) => (
                      <div
                        key={occurrence.dateKey}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="inline-flex shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                            {occurrence.installmentNumber}/{occurrence.totalInstallments}
                          </span>
                          <span className="font-medium text-gray-700">
                            {dateFormatter.format(new Date(`${occurrence.dateKey}T12:00:00Z`))}
                          </span>
                          {occurrence.status === "CONFIRMED" && (
                            <span className="inline-flex shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              Confirmada
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">
                            {currencyFormatter.format(occurrence.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setExcludedDateKeys((current) => {
                                const next = new Set(current);
                                next.add(occurrence.dateKey);
                                return next;
                              })
                            }
                            className="shrink-0 text-xs font-semibold text-rose-600 hover:text-rose-700"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  Os anexos de comprovante poderão ser inseridos individualmente após a criação de cada parcela.
                </p>
              </div>
            </section>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <input
                ref={receiptInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setForm((current) => ({ ...current, receiptFile: file, removeReceipt: false }));
                }}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-bold text-gray-900">Comprovante</p>
                  <p className="truncate text-xs text-gray-500">
                    {form.receiptFile?.name || (form.removeReceipt ? "Comprovante será removido" : transaction?.receiptFileName || "PDF, JPG, PNG ou WEBP até 10 MB.")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {transaction?.hasReceipt && !form.removeReceipt && !form.receiptFile && onOpenReceipt && (
                    <button
                      type="button"
                      onClick={() => onOpenReceipt(transaction)}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <FileText className="h-4 w-4" />
                      Visualizar
                    </button>
                  )}
                  {!isMemberPortalTransaction && (
                    <button type="button" onClick={() => receiptInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand-hover">
                      <Upload className="h-4 w-4" />
                      {form.receiptFile || transaction?.hasReceipt ? "Trocar" : "Inserir"}
                    </button>
                  )}
                  {!isMemberPortalTransaction && (form.receiptFile || transaction?.hasReceipt) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (receiptInputRef.current) receiptInputRef.current.value = "";
                        setForm((current) => ({ ...current, receiptFile: null, removeReceipt: !!transaction?.hasReceipt }));
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </form>
    </ModalShell>
  );
}

export function TransactionStatusModal({
  isOpen,
  transaction,
  loading,
  error,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  transaction: FinancialTransaction | null;
  loading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (status: FinancialTransactionStatus) => void | Promise<void>;
}) {
  const statusOptions = (["DRAFT", "PENDING", "CONFIRMED", "CANCELLED"] as const)
    .filter((option) => option !== transaction?.status)
    .map((option) => ({
      value: option,
      label: TRANSACTION_STATUS_LABELS[option],
      className: option === "CANCELLED"
        ? "border-red-600 bg-red-600 text-white hover:bg-red-700"
        : option === "CONFIRMED"
          ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
          : option === "PENDING"
            ? "border-amber-500 bg-amber-500 text-white hover:bg-amber-600"
            : "border-gray-500 bg-gray-500 text-white hover:bg-gray-600",
    }));

  return (
    <StatusActionModal
      isOpen={isOpen}
      title="Mudar status"
      onClose={onClose}
      loading={loading}
      error={error}
      options={statusOptions}
      onSelect={onSubmit}
      description={transaction ? `Escolha o novo status do lançamento "${getTransactionDisplayTitle(transaction)}".` : ""}
    />
  );
}

export type TransactionConfirmFormData = {
  paidAt: string;
  paymentMethod: "" | FinancialPaymentMethod;
  amount: string;
  accountId: string;
  categoryId: string;
};

export function TransactionConfirmModal({
  isOpen,
  transaction,
  accounts,
  categories,
  loading,
  error,
  onClose,
  onSubmit,
  onOpenReceipt,
}: {
  isOpen: boolean;
  transaction: FinancialTransaction | null;
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
  loading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (data: TransactionConfirmFormData) => void | Promise<void>;
  onOpenReceipt?: (transaction: FinancialTransaction) => void;
}) {
  const [form, setForm] = useState<TransactionConfirmFormData>({
    paidAt: todayInputValue(),
    paymentMethod: "",
    amount: "",
    accountId: "",
    categoryId: "",
  });

  useEffect(() => {
    if (!isOpen || !transaction) return;
    setForm({
      paidAt: todayInputValue(),
      paymentMethod: transaction.paymentMethod ?? "",
      amount: String(transaction.amount),
      accountId: transaction.account.id,
      categoryId: transaction.category.id,
    });
  }, [isOpen, transaction]);

  const accountOptions = useMemo(() => {
    const active = accounts.filter((acc) => acc.active);
    if (transaction && !active.some((acc) => acc.id === transaction.account.id)) {
      return [{ id: transaction.account.id, name: `${transaction.account.name} (inativa)` }, ...active];
    }
    return active;
  }, [accounts, transaction]);

  const categoryOptions = useMemo(() => {
    if (!transaction) return [];
    const matching = categories.filter((cat) => cat.active && cat.type === transaction.type);
    if (!matching.some((cat) => cat.id === transaction.category.id)) {
      return [{ id: transaction.category.id, name: `${transaction.category.name} (inativa)` }, ...matching];
    }
    return matching;
  }, [categories, transaction]);

  const titleLabel = transaction ? getTransactionDisplayTitle(transaction) : "";
  const installmentLabel =
    transaction?.installmentNumber && transaction?.totalInstallments
      ? ` (${transaction.installmentNumber}/${transaction.totalInstallments})`
      : "";

  return (
    <ModalShell
      isOpen={isOpen}
      title="Confirmar pagamento / Dar baixa"
      description={transaction ? `${titleLabel}${installmentLabel}` : undefined}
      onClose={onClose}
      size="md"
      bodyClassName="[overflow-anchor:none]"
      footer={
        <ModalFooter
          onCancel={onClose}
          loading={loading}
          primaryLabel="Confirmar baixa"
          form="finance-transaction-confirm-form"
        />
      }
    >
      <form
        id="finance-transaction-confirm-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(form);
        }}
      >
        <ModalError message={error} />
        <div className="space-y-4 p-6">
          {transaction?.source === "MEMBER_PORTAL" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-900">
              <div className="space-y-0.5">
                <p className="font-bold">Comprovante enviado via Portal do Membro</p>
                {transaction.member?.nome && <p>Membro: {transaction.member.nome}</p>}
                {transaction.payerName && <p>Titular no comprovante: {transaction.payerName}</p>}
              </div>
              {transaction.hasReceipt && onOpenReceipt && (
                <button
                  type="button"
                  onClick={() => onOpenReceipt(transaction)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 font-semibold text-indigo-700 transition hover:bg-indigo-50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Ver comprovante
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField
              id="finance-confirm-paid-at"
              label="Data de liquidação"
              required
              type="date"
              value={form.paidAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, paidAt: event.target.value }))
              }
            />
            <InputField
              id="finance-confirm-amount"
              label="Valor liquidado"
              required
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) =>
                setForm((current) => ({ ...current, amount: event.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              id="finance-confirm-account"
              label="Conta financeira"
              required
              value={form.accountId}
              onChange={(event) =>
                setForm((current) => ({ ...current, accountId: event.target.value }))
              }
            >
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="finance-confirm-category"
              label="Categoria"
              required
              value={form.categoryId}
              onChange={(event) =>
                setForm((current) => ({ ...current, categoryId: event.target.value }))
              }
            >
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectField>
          </div>

          <SelectField
            id="finance-confirm-payment-method"
            label="Forma de pagamento"
            value={form.paymentMethod}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                paymentMethod: event.target.value as TransactionConfirmFormData["paymentMethod"],
              }))
            }
          >
            <option value="">Selecione</option>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </SelectField>
        </div>
      </form>
    </ModalShell>
  );
}

export function RejectContributionModal({
  isOpen,
  transaction,
  loading,
  error,
  onClose,
  onSubmit,
  onOpenReceipt,
}: {
  isOpen: boolean;
  transaction: FinancialTransaction | null;
  loading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (rejectionReason: string) => void | Promise<void>;
  onOpenReceipt?: (transaction: FinancialTransaction) => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setReason("");
  }, [isOpen, transaction?.id]);

  return (
    <ModalShell
      isOpen={isOpen}
      title="Recusar comprovante"
      description={
        transaction
          ? `${transaction.member?.nome || getTransactionDisplayTitle(transaction)} · ${currencyFormatter.format(transaction.amount)}`
          : undefined
      }
      onClose={onClose}
      size="md"
      bodyClassName="[overflow-anchor:none]"
      footer={
        <ModalFooter
          onCancel={onClose}
          loading={loading}
          disabled={reason.trim().length < 5}
          primaryLabel="Recusar comprovante"
          form="finance-reject-contribution-form"
        />
      }
    >
      <form
        id="finance-reject-contribution-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(reason.trim());
        }}
      >
        <ModalError message={error} />
        <div className="space-y-4 p-6">
          {transaction?.hasReceipt && onOpenReceipt && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {transaction.receiptFileName || "Comprovante anexado"}
                </p>
                {transaction.payerName && (
                  <p className="text-gray-500">Titular informado: {transaction.payerName}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpenReceipt(transaction)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-semibold text-gray-700 transition hover:bg-gray-100"
              >
                <FileText className="h-3.5 w-3.5" />
                Ver comprovante
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="finance-rejection-reason"
              className="block text-xs font-bold uppercase tracking-wider text-gray-600"
            >
              Motivo da recusa <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="finance-rejection-reason"
              rows={4}
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex: Imagem ilegível, valor divergente do extrato bancário ou comprovante duplicado."
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-accent-ring focus:outline-none focus:ring-2 focus:ring-accent-soft-border"
            />
            <p className="text-xs text-gray-500">
              O membro será notificado com este motivo e poderá enviar um novo comprovante ({reason.trim().length}/500).
            </p>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
