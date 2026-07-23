'use client';

import { ExportShell } from '@/components/app/export-shell';
import { useExport } from '@/hooks/use-export';
import {
  FinancialTransaction,
  PAYMENT_METHOD_LABELS,
  TRANSACTION_STATUS_LABELS,
  currencyFormatter,
  dateFormatter,
  useFinanceiroData,
} from '../financeiro-shared';

const ALL_FIELDS = [
  { key: 'date', label: 'Data' },
  { key: 'type', label: 'Tipo' },
  { key: 'status', label: 'Status' },
  { key: 'description', label: 'Descrição' },
  { key: 'account', label: 'Conta' },
  { key: 'category', label: 'Categoria' },
  { key: 'evento', label: 'Evento' },
  { key: 'amount', label: 'Valor' },
  { key: 'paymentMethod', label: 'Pagamento' },
  { key: 'counterpartyName', label: 'Pessoa/fornecedor' },
  { key: 'receiptUrl', label: 'Comprovante' },
];

const TRANSACTION_TYPE_LABEL: Record<FinancialTransaction['type'], string> = {
  INCOME: 'Entrada',
  EXPENSE: 'Despesa',
};

export default function FinanceiroExportacaoPage() {
  const {
    loadingPermission,
    loadingData,
    permissionError,
    dataError,
    transactions,
  } = useFinanceiroData();

  const exportHook = useExport(
    ALL_FIELDS,
    transactions,
    'financeiro',
    (transaction, field) => {
      if (field.key === 'date') return dateFormatter.format(new Date(transaction.date));
      if (field.key === 'type') return TRANSACTION_TYPE_LABEL[transaction.type];
      if (field.key === 'status') return TRANSACTION_STATUS_LABELS[transaction.status] ?? transaction.status;
      if (field.key === 'account') return transaction.account.name;
      if (field.key === 'category') return transaction.category.name;
      if (field.key === 'evento') return transaction.evento?.titulo ?? '';
      if (field.key === 'amount') return currencyFormatter.format(transaction.amount);
      if (field.key === 'paymentMethod') return transaction.paymentMethod ? PAYMENT_METHOD_LABELS[transaction.paymentMethod] : '';
      if (field.key === 'counterpartyName') return transaction.counterpartyName ?? '';
      if (field.key === 'receiptUrl') return transaction.receiptUrl ?? '';
      return (transaction as unknown as Record<string, unknown>)[field.key] as string ?? '';
    },
  );

  return (
    <ExportShell
      title="Exportação Financeira"
      description="Selecione os campos e baixe o extrato financeiro em CSV."
      fields={ALL_FIELDS}
      loading={loadingPermission || loadingData}
      totalItems={transactions.length}
      selectedFields={exportHook.selectedFields}
      onToggleField={exportHook.toggleField}
      onSelectAll={exportHook.selectAll}
      onClear={exportHook.clearAll}
      onExport={exportHook.handleExport}
      error={permissionError || dataError || exportHook.error}
    />
  );
}
