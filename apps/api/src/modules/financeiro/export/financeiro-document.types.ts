import type {
  FinancialPaymentMethod,
  FinancialTransactionStatus,
  FinancialTransactionType,
} from '@prisma/client';
import type {
  DocumentHeaderInput,
  DocumentRenderOptions,
  RenderedDocument,
  RenderedNotModifiedDocument,
} from '../../../common/export';

export type FinanceiroDocumentFormat = 'pdf';

export interface FinanceiroFilterLabel {
  label: string;
  value: string;
}

export interface FinanceiroDocumentItem {
  id: string;
  type: FinancialTransactionType;
  status: FinancialTransactionStatus;
  date: Date;
  paidAt: Date | null;
  updatedAt: Date;
  amount: number;
  description: string | null;
  paymentMethod: FinancialPaymentMethod | null;
  counterpartyName: string | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
  account: { id: string; name: string };
  category: { id: string; name: string };
  evento: { id: string; titulo: string } | null;
  member: { id: string; nome: string } | null;
}

export interface FinanceiroDocumentTotals {
  count: number;
  confirmedCount: number;
  confirmedIncome: number;
  confirmedExpense: number;
  confirmedNet: number;
  pendingCount: number;
  pendingIncome: number;
  pendingExpense: number;
  pendingNet: number;
  draftCount: number;
  draftIncome: number;
  draftExpense: number;
  cancelledCount: number;
  cancelledIncome: number;
  cancelledExpense: number;
}

export interface FinanceiroDocumentInput extends DocumentHeaderInput {
  tenantId: string;
  organizationName: string;
  logoUrl?: string | null;
  issuedAt?: Date | string | null;
  periodo: {
    startDate?: string;
    endDate?: string;
  };
  filters: {
    status?: FinancialTransactionStatus;
    type?: FinancialTransactionType;
    accountId?: string;
    categoryId?: string;
    eventoId?: string;
    memberId?: string;
    recurringGroupId?: string;
    description?: string;
  };
  appliedFilterLabels: FinanceiroFilterLabel[];
  items: FinanceiroDocumentItem[];
  totals: FinanceiroDocumentTotals;
  truncated: boolean;
  totalMatchingCount: number;
}

export type FinanceiroRenderOptions = DocumentRenderOptions;

export type FinanceiroExportResult =
  | RenderedDocument
  | RenderedNotModifiedDocument;
