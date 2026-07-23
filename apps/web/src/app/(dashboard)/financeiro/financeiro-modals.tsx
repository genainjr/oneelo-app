"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { EventoSearchCombobox, getEventoDisplayName, type EventoOption } from "@/components/app/evento-search-combobox";
import { InputField, SelectField } from "@/components/app/form-field";
import { getMembroPrintName, MembroSearchCombobox, type MembroOption } from "@/components/app/membro-search-combobox";
import { ModalError, ModalFooter, ModalShell } from "@/components/app/modal-shell";
import { StatusActionModal } from "@/components/app/status-action-modal";
import { api } from "@/lib/api";
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
  const [form, setForm] = useState<CategoryFormData>({ name: "", type: "INCOME", active: true });

  useEffect(() => {
    if (!isOpen) return;
    setForm(category ? { name: category.name, type: category.type, active: category.active } : { name: "", type: "INCOME", active: true });
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
          <SelectField id="finance-category-type" label="Tipo" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as FinancialCategoryType }))}>
            {Object.entries(CATEGORY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </SelectField>
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
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  transaction?: FinancialTransaction | null;
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
  loading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (data: TransactionFormData) => void | Promise<void>;
}) {
  const [form, setForm] = useState<TransactionFormData>(emptyTransactionForm);
  const [membros, setMembros] = useState<MembroOption[]>([]);
  const [membrosLoading, setMembrosLoading] = useState(false);
  const [eventos, setEventos] = useState<EventoOption[]>([]);
  const [eventosLoading, setEventosLoading] = useState(false);
  const [membroSearch, setMembroSearch] = useState("");
  const [eventoSearch, setEventoSearch] = useState("");
  const [selectedMembro, setSelectedMembro] = useState<MembroOption | null>(null);
  const [selectedEvento, setSelectedEvento] = useState<EventoOption | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const categoryOptions = useMemo(
    () => categories.filter((category) => category.active && category.type === form.type),
    [categories, form.type],
  );

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
    setEventosLoading(true);
    api.get<EventoOption[]>("/api/eventos?scope=MANAGE")
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
  }, [isOpen]);

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
    setSelectedMembro(member);
    setMembroSearch(counterpartyName);
    setSelectedEvento(evento);
    setEventoSearch(evento ? getEventoDisplayName(evento) : "");
  }, [isOpen, transaction]);

  return (
    <ModalShell
      isOpen={isOpen}
      title={transaction ? "Editar Lançamento" : "Novo Lançamento"}
      onClose={onClose}
      size="md"
      height={!transaction ? "viewport" : "auto"}
      bodyClassName="[overflow-anchor:none]"
      footer={<ModalFooter onCancel={onClose} loading={loading} primaryLabel="Salvar" form="finance-transaction-form" />}
    >
      <form id="finance-transaction-form" onSubmit={(event) => { event.preventDefault(); void onSubmit(form); }}>
        <ModalError message={error} />
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              id="finance-type"
              label="Tipo"
              required
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
              <option value="EXPENSE">Despesa</option>
            </SelectField>
            <SelectField id="finance-status" label="Status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as FinancialTransactionStatus }))}>
              <option value="CONFIRMED">Confirmado</option>
              <option value="DRAFT">Rascunho</option>
            </SelectField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField id="finance-date" label="Data" required type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
            <InputField id="finance-amount" label="Valor" required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
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
            ) : (
              <InputField id="finance-counterparty" label="Fornecedor" value={form.counterpartyName} onChange={(event) => setForm((current) => ({ ...current, counterpartyName: event.target.value, memberId: "" }))} />
            )}
          </div>
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
                {transaction?.receiptUrl && !form.removeReceipt && !form.receiptFile && (
                  <a href={transaction.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                    <FileText className="h-4 w-4" />
                    Abrir
                  </a>
                )}
                <button type="button" onClick={() => receiptInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                  <Upload className="h-4 w-4" />
                  {form.receiptFile || transaction?.receiptUrl ? "Trocar" : "Inserir"}
                </button>
                {(form.receiptFile || transaction?.receiptUrl) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (receiptInputRef.current) receiptInputRef.current.value = "";
                      setForm((current) => ({ ...current, receiptFile: null, removeReceipt: !!transaction?.receiptUrl }));
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
  const statusOptions = (["DRAFT", "CONFIRMED", "CANCELLED"] as const)
    .filter((option) => option !== transaction?.status)
    .map((option) => ({
      value: option,
      label: TRANSACTION_STATUS_LABELS[option],
      className: option === "CANCELLED"
        ? "border-red-600 bg-red-600 text-white hover:bg-red-700"
        : option === "CONFIRMED"
          ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
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
      description={transaction ? `Escolha o novo status do lançamento "${transaction.description || transaction.counterpartyName || "Lançamento financeiro"}".` : ""}
    />
  );
}
