import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AcaoAuditoria,
  FinanceRole,
  FinancialCategoryType,
  FinancialPaymentMethod,
  FinancialTransactionSource,
  FinancialTransactionStatus,
  FinancialTransactionType,
  NotificationAudienceType,
  NotificationOrigin,
  Prisma,
  StatusMembro,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import {
  getFinancialReceiptPath,
  validateFinancialReceiptUpload,
} from '../../common/storage/image-upload';
import {
  includesNormalizedText,
  normalizeSearchText,
} from '../../common/utils/search-text';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import type { Multer } from 'multer';
import { NotificationDispatchService } from '../notifications/services/notification-dispatch.service';
import { FinanceAuthorizationService } from './finance-authorization.service';
import { ConfirmFinancialTransactionDto } from './dto/confirm-financial-transaction.dto';
import { CreateFinancialTransactionDto } from './dto/create-financial-transaction.dto';
import { CreateFinancialTransactionsBatchDto } from './dto/create-financial-transactions-batch.dto';
import { ExportFinanceiroDto } from './dto/export-financeiro.dto';
import { RejectFinancialTransactionDto } from './dto/reject-financial-transaction.dto';
import { UpdateFinancialTransactionDto } from './dto/update-financial-transaction.dto';
import type {
  FinanceiroDocumentInput,
  FinanceiroDocumentItem,
  FinanceiroDocumentTotals,
  FinanceiroFilterLabel,
} from './export/financeiro-document.types';

export const FINANCEIRO_TYPE_LABELS: Record<FinancialTransactionType, string> = {
  INCOME: 'Entrada',
  EXPENSE: 'Saída',
};

export const FINANCEIRO_STATUS_LABELS: Record<FinancialTransactionStatus, string> = {
  DRAFT: 'Rascunho',
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
};

export const FINANCEIRO_SOURCE_LABELS: Record<FinancialTransactionSource, string> = {
  TREASURY: 'Tesouraria',
  MEMBER_PORTAL: 'Portal do Membro',
};

export const FINANCEIRO_PAYMENT_METHOD_LABELS: Record<FinancialPaymentMethod, string> = {
  PIX: 'Pix',
  CASH: 'Dinheiro',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  BANK_TRANSFER: 'Transferência',
  BOLETO: 'Boleto',
  CHECK: 'Cheque',
  OTHER: 'Outro',
};

export function getFinancialTransactionDisplayTitle(transaction: {
  description?: string | null;
  type: FinancialTransactionType;
  counterpartyName?: string | null;
  evento?: { titulo?: string | null } | null;
  category: { name: string };
}): string {
  const description = transaction.description?.trim();
  if (description) return description;
  const eventTitle = transaction.evento?.titulo?.trim();
  if (eventTitle) return eventTitle;
  const counterpartyName = transaction.counterpartyName?.trim();
  if (counterpartyName) return counterpartyName;
  return `${FINANCEIRO_TYPE_LABELS[transaction.type]} - ${transaction.category.name}`;
}

export function matchesFinancialTransactionSearch(
  transaction: {
    description?: string | null;
    type: FinancialTransactionType;
    counterpartyName?: string | null;
    payerName?: string | null;
    paymentMethod?: FinancialPaymentMethod | null;
    category: { name: string };
    account: { name: string };
    evento?: { titulo?: string | null } | null;
    member?: { nome?: string | null } | null;
  },
  search: string | null | undefined,
): boolean {
  const normalizedQuery = normalizeSearchText(search);
  if (!normalizedQuery) return true;

  const displayTitle = getFinancialTransactionDisplayTitle(transaction);
  const paymentLabel = transaction.paymentMethod
    ? (FINANCEIRO_PAYMENT_METHOD_LABELS[transaction.paymentMethod] ?? transaction.paymentMethod)
    : null;
  const typeLabel = FINANCEIRO_TYPE_LABELS[transaction.type];

  const searchable = [
    displayTitle,
    transaction.description,
    typeLabel,
    transaction.category?.name,
    transaction.account?.name,
    transaction.counterpartyName,
    transaction.payerName,
    transaction.evento?.titulo,
    transaction.member?.nome,
    paymentLabel,
  ]
    .filter(Boolean)
    .join(' ');

  return includesNormalizedText(searchable, normalizedQuery);
}

const WRITE_ROLES: FinanceRole[] = [
  FinanceRole.FINANCE_OPERATOR,
  FinanceRole.FINANCE_APPROVER,
  FinanceRole.FINANCE_MANAGER,
];

const APPROVE_ROLES: FinanceRole[] = [FinanceRole.FINANCE_APPROVER, FinanceRole.FINANCE_MANAGER];
const CANCEL_ROLES: FinanceRole[] = APPROVE_ROLES;
const MAX_BATCH_OCCURRENCES = 120;
const DEFAULT_LIST_LIMIT = 500;
const MAX_LIST_LIMIT = 500;
const MAX_SEARCH_SCAN_LIMIT = 2000;

const TRANSACTION_INCLUDE = {
  account: { select: { id: true, name: true, type: true } },
  category: { select: { id: true, name: true, type: true } },
  evento: { select: { id: true, titulo: true, dataInicio: true, dataFim: true, local: true, status: true } },
  member: { select: { id: true, nome: true, email: true, whatsapp: true } },
  createdBy: { select: { id: true, nome: true } },
} as const;

type TransactionWithRelations = Prisma.FinancialTransactionGetPayload<{
  include: typeof TRANSACTION_INCLUDE;
}>;

const FINANCIAL_RECEIPTS_BUCKET = 'financial-receipts';
const RECEIPT_SIGNED_URL_TTL_SECONDS = 300;
const brlCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

@Injectable()
export class FinancialTransactionsService {
  private readonly logger = new Logger(FinancialTransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeAuthorization: FinanceAuthorizationService,
    private readonly storageService: SupabaseStorageService,
    @Optional()
    private readonly notificationDispatch?: NotificationDispatchService,
  ) {}

  async findAll(
    tenantId: string,
    actor: JwtPayload,
    filters: {
      startDate?: string;
      endDate?: string;
      type?: FinancialTransactionType;
      status?: FinancialTransactionStatus;
      source?: FinancialTransactionSource;
      accountId?: string;
      categoryId?: string;
      eventoId?: string;
      memberId?: string;
      recurringGroupId?: string;
      description?: string;
      limit?: number;
    },
  ) {
    await this.financeAuthorization.ensureCanAccessFinanceData(tenantId, actor);

    const requestedLimit = filters.limit;
    const take =
      requestedLimit !== undefined && Number.isFinite(requestedLimit)
        ? Math.min(Math.max(Math.trunc(requestedLimit), 1), MAX_LIST_LIMIT)
        : DEFAULT_LIST_LIMIT;

    const where = this.buildTransactionWhere(tenantId, filters);
    const orderBy: Prisma.FinancialTransactionOrderByWithRelationInput[] =
      filters.recurringGroupId
        ? [{ installmentNumber: 'asc' }, { date: 'asc' }]
        : [{ date: 'desc' }, { createdAt: 'desc' }];

    const normalizedDescription = normalizeSearchText(filters.description);

    if (normalizedDescription) {
      const scanned = await this.prisma.financialTransaction.findMany({
        where,
        include: TRANSACTION_INCLUDE,
        orderBy,
        take: MAX_SEARCH_SCAN_LIMIT,
      });

      return scanned
        .filter((transaction) =>
          matchesFinancialTransactionSearch(transaction, normalizedDescription),
        )
        .slice(0, take)
        .map((transaction) => this.serializeTransaction(transaction));
    }

    const transactions = await this.prisma.financialTransaction.findMany({
      where,
      include: TRANSACTION_INCLUDE,
      orderBy,
      take,
    });

    return transactions.map((transaction) => this.serializeTransaction(transaction));
  }

  async prepareExportData(
    tenantId: string,
    query: ExportFinanceiroDto,
    actor: JwtPayload,
  ): Promise<FinanceiroDocumentInput> {
    await this.financeAuthorization.ensureCanAccessFinanceData(tenantId, actor);

    const where = this.buildTransactionWhere(tenantId, query);
    const orderBy: Prisma.FinancialTransactionOrderByWithRelationInput[] =
      query.recurringGroupId
        ? [{ installmentNumber: 'asc' }, { date: 'asc' }, { createdAt: 'asc' }]
        : [{ date: 'desc' }, { createdAt: 'desc' }];

    const normalizedDescription = normalizeSearchText(query.description);

    const [tenant, rawRows] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { nome: true, logoUrl: true },
      }),
      this.prisma.financialTransaction.findMany({
        where,
        include: TRANSACTION_INCLUDE,
        orderBy,
        take: normalizedDescription
          ? MAX_SEARCH_SCAN_LIMIT + 1
          : MAX_LIST_LIMIT + 1,
      }),
    ]);

    let selectedRows: TransactionWithRelations[];
    let truncated = false;
    let totalMatchingCount = 0;

    if (normalizedDescription) {
      const scannedHitCap = rawRows.length > MAX_SEARCH_SCAN_LIMIT;
      const scanPool = scannedHitCap
        ? rawRows.slice(0, MAX_SEARCH_SCAN_LIMIT)
        : rawRows;
      const matchedRows = scanPool.filter((transaction) =>
        matchesFinancialTransactionSearch(transaction, normalizedDescription),
      );
      totalMatchingCount = matchedRows.length;
      truncated = matchedRows.length > MAX_LIST_LIMIT || scannedHitCap;
      selectedRows = matchedRows.slice(0, MAX_LIST_LIMIT);
    } else {
      truncated = rawRows.length > MAX_LIST_LIMIT;
      selectedRows = truncated ? rawRows.slice(0, MAX_LIST_LIMIT) : rawRows;
      totalMatchingCount = truncated
        ? await this.prisma.financialTransaction.count({ where })
        : selectedRows.length;
    }

    if (selectedRows.length === 0) {
      throw new NotFoundException(
        'Nenhum lançamento financeiro encontrado para os filtros informados.',
      );
    }

    // Ordenação cronológica crescente para exibição documental (paridade com /financeiro/visualizacao)
    const sortedRows = [...selectedRows].sort((a, b) => {
      if (query.recurringGroupId) {
        const instA = a.installmentNumber ?? Number.MAX_SAFE_INTEGER;
        const instB = b.installmentNumber ?? Number.MAX_SAFE_INTEGER;
        if (instA !== instB) return instA - instB;
      }
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const items: FinanceiroDocumentItem[] = sortedRows.map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      source: row.source,
      date: row.date,
      paidAt: row.paidAt ?? null,
      updatedAt: row.updatedAt,
      amount: this.toAmountNumber(row.amount),
      description: row.description ?? null,
      paymentMethod: row.paymentMethod ?? null,
      counterpartyName: row.counterpartyName ?? null,
      payerName: row.payerName ?? null,
      installmentNumber: row.installmentNumber ?? null,
      totalInstallments: row.totalInstallments ?? null,
      account: { id: row.account.id, name: row.account.name },
      category: { id: row.category.id, name: row.category.name },
      evento: row.evento ? { id: row.evento.id, titulo: row.evento.titulo } : null,
      member: row.member ? { id: row.member.id, nome: row.member.nome } : null,
    }));

    const totals = this.computeExportTotals(items);
    const appliedFilterLabels = this.buildAppliedFilterLabels(query, items[0]);

    return {
      tenantId,
      organizationName: tenant?.nome?.trim() || 'One Elo',
      logoUrl: tenant?.logoUrl ?? null,
      issuedAt: new Date(),
      periodo: {
        startDate: query.startDate,
        endDate: query.endDate,
      },
      filters: {
        status: query.status,
        type: query.type,
        source: query.source,
        accountId: query.accountId,
        categoryId: query.categoryId,
        eventoId: query.eventoId,
        memberId: query.memberId,
        recurringGroupId: query.recurringGroupId,
        description: query.description?.trim() || undefined,
      },
      appliedFilterLabels,
      items,
      totals,
      truncated,
      totalMatchingCount,
    };
  }

  private buildTransactionWhere(
    tenantId: string,
    filters: {
      startDate?: string;
      endDate?: string;
      type?: FinancialTransactionType;
      status?: FinancialTransactionStatus;
      source?: FinancialTransactionSource;
      accountId?: string;
      categoryId?: string;
      eventoId?: string;
      memberId?: string;
      recurringGroupId?: string;
    },
  ): Prisma.FinancialTransactionWhereInput {
    return {
      tenantId,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.eventoId ? { eventoId: filters.eventoId } : {}),
      ...(filters.memberId ? { memberId: filters.memberId } : {}),
      ...(filters.recurringGroupId ? { recurringGroupId: filters.recurringGroupId } : {}),
      ...this.buildDateRangeFilter(filters.startDate, filters.endDate),
    };
  }

  private computeExportTotals(items: FinanceiroDocumentItem[]): FinanceiroDocumentTotals {
    let confirmedCount = 0;
    let confirmedIncomeCents = 0;
    let confirmedExpenseCents = 0;
    let pendingCount = 0;
    let pendingIncomeCents = 0;
    let pendingExpenseCents = 0;
    let draftCount = 0;
    let draftIncomeCents = 0;
    let draftExpenseCents = 0;
    let cancelledCount = 0;
    let cancelledIncomeCents = 0;
    let cancelledExpenseCents = 0;

    for (const item of items) {
      const cents = Math.round(item.amount * 100);
      const isIncome = item.type === FinancialTransactionType.INCOME;

      if (item.status === FinancialTransactionStatus.CONFIRMED) {
        confirmedCount += 1;
        if (isIncome) confirmedIncomeCents += cents;
        else confirmedExpenseCents += cents;
      } else if (item.status === FinancialTransactionStatus.PENDING) {
        pendingCount += 1;
        if (isIncome) pendingIncomeCents += cents;
        else pendingExpenseCents += cents;
      } else if (item.status === FinancialTransactionStatus.DRAFT) {
        draftCount += 1;
        if (isIncome) draftIncomeCents += cents;
        else draftExpenseCents += cents;
      } else if (item.status === FinancialTransactionStatus.CANCELLED) {
        cancelledCount += 1;
        if (isIncome) cancelledIncomeCents += cents;
        else cancelledExpenseCents += cents;
      }
    }

    return {
      count: items.length,
      confirmedCount,
      confirmedIncome: confirmedIncomeCents / 100,
      confirmedExpense: confirmedExpenseCents / 100,
      confirmedNet: (confirmedIncomeCents - confirmedExpenseCents) / 100,
      pendingCount,
      pendingIncome: pendingIncomeCents / 100,
      pendingExpense: pendingExpenseCents / 100,
      pendingNet: (pendingIncomeCents - pendingExpenseCents) / 100,
      draftCount,
      draftIncome: draftIncomeCents / 100,
      draftExpense: draftExpenseCents / 100,
      cancelledCount,
      cancelledIncome: cancelledIncomeCents / 100,
      cancelledExpense: cancelledExpenseCents / 100,
    };
  }

  private buildAppliedFilterLabels(
    query: ExportFinanceiroDto,
    sampleItem: FinanceiroDocumentItem,
  ): FinanceiroFilterLabel[] {
    const labels: FinanceiroFilterLabel[] = [];

    if (query.status) {
      labels.push({
        label: 'Status',
        value: FINANCEIRO_STATUS_LABELS[query.status] ?? query.status,
      });
    }
    if (query.type) {
      labels.push({
        label: 'Tipo',
        value: FINANCEIRO_TYPE_LABELS[query.type] ?? query.type,
      });
    }
    if (query.source) {
      labels.push({
        label: 'Origem',
        value: FINANCEIRO_SOURCE_LABELS[query.source] ?? query.source,
      });
    }
    if (query.accountId) {
      labels.push({
        label: 'Conta',
        value: sampleItem.account.name,
      });
    }
    if (query.categoryId) {
      labels.push({
        label: 'Categoria',
        value: sampleItem.category.name,
      });
    }
    if (query.eventoId) {
      labels.push({
        label: 'Evento',
        value: sampleItem.evento?.titulo ?? 'Evento filtrado',
      });
    }
    if (query.memberId) {
      labels.push({
        label: 'Membro',
        value: sampleItem.member?.nome ?? 'Membro filtrado',
      });
    }
    if (query.recurringGroupId) {
      labels.push({
        label: 'Série',
        value: 'Lançamentos recorrentes',
      });
    }
    if (query.description?.trim()) {
      labels.push({
        label: 'Busca',
        value: query.description.trim(),
      });
    }

    return labels;
  }

  async getSummary(
    tenantId: string,
    actor: JwtPayload,
    filters: { startDate?: string; endDate?: string; accountId?: string },
  ) {
    await this.financeAuthorization.ensureCanAccessFinanceData(tenantId, actor);

    const [accounts, transactions, pendingMemberAgg] = await Promise.all([
      this.prisma.financialAccount.findMany({ where: { tenantId, active: true } }),
      this.prisma.financialTransaction.findMany({
        where: {
          tenantId,
          status: {
            in: [FinancialTransactionStatus.CONFIRMED, FinancialTransactionStatus.PENDING],
          },
          ...(filters.accountId ? { accountId: filters.accountId } : {}),
          ...this.buildDateRangeFilter(filters.startDate, filters.endDate),
        },
        select: { type: true, status: true, amount: true },
      }),
      typeof this.prisma.financialTransaction.aggregate === 'function'
        ? this.prisma.financialTransaction.aggregate({
            where: {
              tenantId,
              source: FinancialTransactionSource.MEMBER_PORTAL,
              status: FinancialTransactionStatus.PENDING,
              type: FinancialTransactionType.INCOME,
              ...(filters.accountId ? { accountId: filters.accountId } : {}),
            },
            _count: { _all: true },
            _sum: { amount: true },
          })
        : Promise.resolve({ _count: { _all: 0 }, _sum: { amount: null } }),
    ]);

    const initialBalanceCents = accounts
      .filter((account) => !filters.accountId || account.id === filters.accountId)
      .reduce((sum, account) => sum + Math.round(this.toAmountNumber(account.initialBalance) * 100), 0);

    let incomeCents = 0;
    let expenseCents = 0;
    let confirmedCount = 0;
    let pendingIncomeCents = 0;
    let pendingExpenseCents = 0;
    let pendingCount = 0;

    for (const transaction of transactions) {
      const amountCents = Math.round(this.toAmountNumber(transaction.amount) * 100);
      if (transaction.status === FinancialTransactionStatus.CONFIRMED) {
        confirmedCount += 1;
        if (transaction.type === FinancialTransactionType.INCOME) {
          incomeCents += amountCents;
        } else {
          expenseCents += amountCents;
        }
      } else if (transaction.status === FinancialTransactionStatus.PENDING) {
        pendingCount += 1;
        if (transaction.type === FinancialTransactionType.INCOME) {
          pendingIncomeCents += amountCents;
        } else {
          pendingExpenseCents += amountCents;
        }
      }
    }

    const pendingMemberCount = pendingMemberAgg?._count?._all ?? 0;
    const pendingMemberRawAmount = pendingMemberAgg?._sum?.amount;
    const pendingMemberAmountCents = pendingMemberRawAmount
      ? Math.round(this.toAmountNumber(pendingMemberRawAmount) * 100)
      : 0;

    return {
      initialBalance: initialBalanceCents / 100,
      income: incomeCents / 100,
      expense: expenseCents / 100,
      balance: (initialBalanceCents + incomeCents - expenseCents) / 100,
      transactions: confirmedCount,
      pendingIncome: pendingIncomeCents / 100,
      pendingExpense: pendingExpenseCents / 100,
      pendingCount,
      pendingMemberCount,
      pendingMemberAmount: pendingMemberAmountCents / 100,
    };
  }

  async create(
    tenantId: string,
    actor: JwtPayload,
    dto: CreateFinancialTransactionDto,
    ip?: string,
  ) {
    await this.financeAuthorization.ensureFinanceRole(tenantId, actor, WRITE_ROLES);
    const status = dto.status ?? FinancialTransactionStatus.CONFIRMED;
    if (status === FinancialTransactionStatus.CANCELLED) {
      throw new BadRequestException('Lançamento não pode ser criado já cancelado.');
    }

    const parsedDate = new Date(dto.date);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Data do lançamento inválida.');
    }

    await this.validateAccountAndCategory(tenantId, dto.accountId, dto.categoryId, dto.type);
    await this.validateEvento(tenantId, dto.eventoId);
    const member = await this.validateMember(tenantId, dto.memberId, dto.type);

    const memberPrintName = member ? this.getMemberPrintName(member) : null;
    const paidAt = status === FinancialTransactionStatus.CONFIRMED ? parsedDate : null;
    const transaction = await this.prisma.financialTransaction.create({
      data: {
        tenantId,
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        eventoId: dto.eventoId || null,
        memberId: member?.id ?? null,
        createdByUserId: actor.sub,
        type: dto.type,
        status,
        date: parsedDate,
        paidAt,
        amount: dto.amount,
        description: dto.description?.trim() || null,
        paymentMethod: dto.paymentMethod ?? null,
        counterpartyName: memberPrintName ?? (dto.counterpartyName?.trim() || null),
      },
      include: TRANSACTION_INCLUDE,
    });
    const amount = this.toAmountNumber(transaction.amount);
    await this.audit(
      tenantId,
      actor.sub,
      transaction.id,
      null,
      { id: transaction.id, type: transaction.type, status: transaction.status, amount },
      ip,
      AcaoAuditoria.CRIAR,
    );
    return this.serializeTransaction(transaction);
  }

  async createBatch(
    tenantId: string,
    actor: JwtPayload,
    dto: CreateFinancialTransactionsBatchDto,
    ip?: string,
  ) {
    const auth = await this.financeAuthorization.ensureFinanceRole(tenantId, actor, WRITE_ROLES);
    if (!dto.occurrences?.length) {
      throw new BadRequestException('Informe pelo menos uma ocorrência.');
    }
    if (dto.occurrences.length > MAX_BATCH_OCCURRENCES) {
      throw new BadRequestException(
        `O lote pode conter no máximo ${MAX_BATCH_OCCURRENCES} ocorrências.`,
      );
    }

    const canConfirmOnCreate = Boolean(auth.role && APPROVE_ROLES.includes(auth.role));
    const preparedOccurrences = this.prepareBatchOccurrences(dto, canConfirmOnCreate);

    await this.validateAccountAndCategory(tenantId, dto.accountId, dto.categoryId, dto.type);
    await this.validateEvento(tenantId, dto.eventoId);
    const member = await this.validateMember(tenantId, dto.memberId, dto.type);

    const memberPrintName = member ? this.getMemberPrintName(member) : null;
    const counterpartyName = memberPrintName ?? (dto.counterpartyName?.trim() || null);
    const recurringGroupId = randomUUID();

    const created = await this.prisma.$transaction(async (tx) => {
      const rows: TransactionWithRelations[] = [];
      for (const occurrence of preparedOccurrences) {
        const transaction = await tx.financialTransaction.create({
          data: {
            tenantId,
            accountId: dto.accountId,
            categoryId: dto.categoryId,
            eventoId: dto.eventoId || null,
            memberId: member?.id ?? null,
            createdByUserId: actor.sub,
            type: dto.type,
            status: occurrence.status,
            date: occurrence.date,
            paidAt: occurrence.paidAt,
            amount: occurrence.amount,
            description: occurrence.description,
            paymentMethod: dto.paymentMethod ?? null,
            counterpartyName,
            recurringGroupId,
            installmentNumber: occurrence.installmentNumber,
            totalInstallments: occurrence.totalInstallments,
          },
          include: TRANSACTION_INCLUDE,
        });
        rows.push(transaction);
      }
      return rows;
    });

    const totalCents = preparedOccurrences.reduce(
      (sum, occurrence) => sum + Math.round(occurrence.amount * 100),
      0,
    );

    await this.audit(
      tenantId,
      actor.sub,
      recurringGroupId,
      null,
      {
        recurringGroupId,
        type: dto.type,
        count: created.length,
        totalAmount: totalCents / 100,
        transactionIds: created.map((item) => item.id),
      },
      ip,
      AcaoAuditoria.CRIAR,
    );

    return {
      recurringGroupId,
      count: created.length,
      items: created.map((transaction) => this.serializeTransaction(transaction)),
    };
  }

  async update(
    tenantId: string,
    actor: JwtPayload,
    id: string,
    dto: UpdateFinancialTransactionDto,
    ip?: string,
  ) {
    await this.financeAuthorization.ensureFinanceRole(tenantId, actor, WRITE_ROLES);
    const current = await this.findOneOrThrow(tenantId, id);
    if (current.status === FinancialTransactionStatus.CANCELLED) {
      throw new BadRequestException('Lançamento cancelado não pode ser editado.');
    }
    if (dto.status === FinancialTransactionStatus.CANCELLED) {
      throw new BadRequestException('Use a ação de cancelamento para cancelar um lançamento.');
    }

    if (current.source === FinancialTransactionSource.MEMBER_PORTAL) {
      if (dto.type !== undefined && dto.type !== current.type) {
        throw new BadRequestException(
          'Não é permitido alterar o tipo de uma contribuição enviada pelo portal do membro.',
        );
      }
      if (
        dto.memberId !== undefined &&
        (dto.memberId || null) !== (current.memberId || null)
      ) {
        throw new ForbiddenException(
          'Não é permitido alterar o membro vinculado a uma contribuição enviada pelo portal do membro.',
        );
      }
      if (dto.status === FinancialTransactionStatus.DRAFT) {
        throw new BadRequestException(
          'Contribuições enviadas pelo portal do membro não podem ser movidas para rascunho.',
        );
      }
      if (
        current.status !== FinancialTransactionStatus.CONFIRMED &&
        dto.status === FinancialTransactionStatus.CONFIRMED
      ) {
        throw new BadRequestException(
          'Use a ação "Dar Baixa / Confirmar" para confirmar contribuições enviadas pelo portal do membro.',
        );
      }
    }

    if (
      current.status !== FinancialTransactionStatus.CONFIRMED &&
      dto.status === FinancialTransactionStatus.CONFIRMED
    ) {
      await this.financeAuthorization.ensureFinanceRole(tenantId, actor, APPROVE_ROLES);
    }

    const nextType = dto.type ?? current.type;
    const nextAccountId = dto.accountId ?? current.accountId;
    const nextCategoryId = dto.categoryId ?? current.categoryId;
    const nextEventoId = dto.eventoId !== undefined ? dto.eventoId : current.eventoId;
    const nextMemberId = dto.memberId !== undefined ? dto.memberId : current.memberId;
    await this.validateAccountAndCategory(tenantId, nextAccountId, nextCategoryId, nextType);
    await this.validateEvento(tenantId, nextEventoId);
    const member = await this.validateMember(tenantId, nextMemberId, nextType);

    const parsedDate = dto.date !== undefined ? new Date(dto.date) : undefined;
    if (parsedDate && Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Data do lançamento inválida.');
    }

    let paidAtUpdate: { paidAt?: Date | null } = {};
    if (dto.status !== undefined) {
      paidAtUpdate = {
        paidAt:
          dto.status === FinancialTransactionStatus.CONFIRMED
            ? (current.paidAt ?? parsedDate ?? current.date)
            : null,
      };
    } else if (
      parsedDate &&
      current.status === FinancialTransactionStatus.CONFIRMED &&
      current.paidAt &&
      current.paidAt.getTime() === current.date.getTime()
    ) {
      paidAtUpdate = { paidAt: parsedDate };
    }

    const memberPrintName = member ? this.getMemberPrintName(member) : null;
    const updated = await this.prisma.financialTransaction.update({
      where: { id },
      data: {
        ...(dto.accountId !== undefined ? { accountId: dto.accountId } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.eventoId !== undefined ? { eventoId: dto.eventoId || null } : {}),
        ...(dto.memberId !== undefined || dto.type !== undefined ? { memberId: member?.id ?? null } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(parsedDate !== undefined ? { date: parsedDate } : {}),
        ...paidAtUpdate,
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod ?? null } : {}),
        ...(dto.counterpartyName !== undefined || dto.memberId !== undefined || dto.type !== undefined ? { counterpartyName: memberPrintName ?? (dto.counterpartyName?.trim() || null) } : {}),
      },
      include: TRANSACTION_INCLUDE,
    });
    await this.audit(
      tenantId,
      actor.sub,
      id,
      { status: current.status, amount: this.toAmountNumber(current.amount) },
      { status: updated.status, amount: this.toAmountNumber(updated.amount) },
      ip,
    );
    return this.serializeTransaction(updated);
  }

  async confirm(
    tenantId: string,
    actor: JwtPayload,
    id: string,
    dto: ConfirmFinancialTransactionDto = {},
    ip?: string,
  ) {
    await this.financeAuthorization.ensureFinanceRole(tenantId, actor, APPROVE_ROLES);
    const current = await this.findOneOrThrow(tenantId, id);

    if (current.status === FinancialTransactionStatus.CANCELLED) {
      throw new BadRequestException('Lançamento cancelado não pode ser confirmado.');
    }
    if (current.status === FinancialTransactionStatus.CONFIRMED) {
      throw new BadRequestException('Lançamento já está confirmado.');
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) {
      throw new BadRequestException('Data de liquidação inválida.');
    }

    const nextAccountId = dto.accountId ?? current.accountId;
    const nextCategoryId = dto.categoryId ?? current.categoryId;
    if (dto.accountId !== undefined || dto.categoryId !== undefined) {
      await this.validateAccountAndCategory(
        tenantId,
        nextAccountId,
        nextCategoryId,
        current.type,
      );
    }

    const updated = await this.prisma.financialTransaction.update({
      where: { id },
      data: {
        status: FinancialTransactionStatus.CONFIRMED,
        paidAt,
        ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod ?? null } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.accountId !== undefined ? { accountId: dto.accountId } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      },
      include: TRANSACTION_INCLUDE,
    });

    await this.audit(
      tenantId,
      actor.sub,
      id,
      {
        status: current.status,
        paidAt: current.paidAt,
        paymentMethod: current.paymentMethod,
        accountId: current.accountId,
        categoryId: current.categoryId,
        amount: this.toAmountNumber(current.amount),
      },
      {
        status: updated.status,
        paidAt: updated.paidAt,
        paymentMethod: updated.paymentMethod,
        accountId: updated.accountId,
        categoryId: updated.categoryId,
        amount: this.toAmountNumber(updated.amount),
      },
      ip,
    );

    if (current.source === FinancialTransactionSource.MEMBER_PORTAL && current.memberId) {
      await this.notifyMemberContributionDecision({
        tenantId,
        actorId: actor.sub,
        memberId: current.memberId,
        transactionId: id,
        decision: 'confirmed',
        amount: this.toAmountNumber(updated.amount),
        categoryName: updated.category?.name,
      });
    }

    return this.serializeTransaction(updated);
  }

  async reject(
    tenantId: string,
    actor: JwtPayload,
    id: string,
    dto: RejectFinancialTransactionDto,
    ip?: string,
  ) {
    await this.financeAuthorization.ensureFinanceRole(tenantId, actor, APPROVE_ROLES);
    const current = await this.findOneOrThrow(tenantId, id);

    if (current.source !== FinancialTransactionSource.MEMBER_PORTAL) {
      throw new BadRequestException(
        'A recusa com motivo é exclusiva para comprovantes enviados pelo portal do membro.',
      );
    }
    if (current.status !== FinancialTransactionStatus.PENDING) {
      throw new BadRequestException(
        'Apenas comprovantes de membros pendentes podem ser recusados.',
      );
    }

    const rejectionReason = dto.rejectionReason?.trim() ?? '';
    if (rejectionReason.length < 5 || rejectionReason.length > 500) {
      throw new BadRequestException(
        'O motivo da recusa deve ter entre 5 e 500 caracteres.',
      );
    }

    const updated = await this.prisma.financialTransaction.update({
      where: { id },
      data: {
        status: FinancialTransactionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledByUserId: actor.sub,
        rejectionReason,
      },
      include: TRANSACTION_INCLUDE,
    });

    await this.audit(
      tenantId,
      actor.sub,
      id,
      { status: current.status, rejectionReason: current.rejectionReason ?? null },
      { status: updated.status, rejectionReason },
      ip,
    );

    if (current.memberId) {
      await this.notifyMemberContributionDecision({
        tenantId,
        actorId: actor.sub,
        memberId: current.memberId,
        transactionId: id,
        decision: 'rejected',
        amount: this.toAmountNumber(updated.amount),
        categoryName: updated.category?.name,
        rejectionReason,
      });
    }

    return this.serializeTransaction(updated);
  }

  async cancel(tenantId: string, actor: JwtPayload, id: string, ip?: string) {
    await this.financeAuthorization.ensureFinanceRole(tenantId, actor, CANCEL_ROLES);
    const current = await this.findOneOrThrow(tenantId, id);
    if (current.status === FinancialTransactionStatus.CANCELLED) {
      return this.serializeTransaction(current);
    }
    if (
      current.source === FinancialTransactionSource.MEMBER_PORTAL &&
      current.status === FinancialTransactionStatus.PENDING
    ) {
      throw new BadRequestException(
        'Use a ação "Recusar" informando o motivo para rejeitar comprovantes pendentes enviados por membros.',
      );
    }

    const updated = await this.prisma.financialTransaction.update({
      where: { id },
      data: {
        status: FinancialTransactionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledByUserId: actor.sub,
      },
      include: TRANSACTION_INCLUDE,
    });
    await this.audit(
      tenantId,
      actor.sub,
      id,
      { status: current.status },
      { status: updated.status },
      ip,
    );
    return this.serializeTransaction(updated);
  }

  async uploadReceipt(
    tenantId: string,
    actor: JwtPayload,
    id: string,
    file: Multer.File | undefined,
    ip?: string,
  ) {
    await this.financeAuthorization.ensureFinanceRole(tenantId, actor, WRITE_ROLES);
    validateFinancialReceiptUpload(file);
    const current = await this.findOneOrThrow(tenantId, id);
    if (current.status === FinancialTransactionStatus.CANCELLED) {
      throw new BadRequestException('Lançamento cancelado não pode receber comprovante.');
    }
    if (current.source === FinancialTransactionSource.MEMBER_PORTAL) {
      throw new BadRequestException(
        'O comprovante enviado pelo membro não pode ser substituído pela tesouraria.',
      );
    }

    const path = getFinancialReceiptPath(tenantId, id, file!);
    await this.storageService.uploadPrivateObject(
      FINANCIAL_RECEIPTS_BUCKET,
      path,
      file!.buffer,
      file!.mimetype,
    );

    let updated: TransactionWithRelations;
    try {
      updated = await this.prisma.financialTransaction.update({
        where: { id },
        data: {
          receiptUrl: null,
          receiptKey: path,
          receiptFileName: file!.originalname,
          receiptMimeType: file!.mimetype,
        },
        include: TRANSACTION_INCLUDE,
      });
    } catch (error) {
      await this.storageService
        .deleteObject(FINANCIAL_RECEIPTS_BUCKET, path, { ignoreNotFound: true })
        .catch(() => undefined);
      throw error;
    }

    if (current.receiptKey && current.receiptKey !== path) {
      await this.storageService
        .deleteObject(FINANCIAL_RECEIPTS_BUCKET, current.receiptKey, { ignoreNotFound: true })
        .catch(() => undefined);
    }

    await this.audit(
      tenantId,
      actor.sub,
      id,
      { receiptKey: current.receiptKey },
      { receiptKey: path },
      ip,
    );
    return this.serializeTransaction(updated);
  }

  async removeReceipt(tenantId: string, actor: JwtPayload, id: string, ip?: string) {
    await this.financeAuthorization.ensureFinanceRole(tenantId, actor, WRITE_ROLES);
    const current = await this.findOneOrThrow(tenantId, id);
    if (current.source === FinancialTransactionSource.MEMBER_PORTAL) {
      throw new BadRequestException(
        'O comprovante enviado pelo membro não pode ser removido pela tesouraria.',
      );
    }

    const updated = await this.prisma.financialTransaction.update({
      where: { id },
      data: {
        receiptUrl: null,
        receiptKey: null,
        receiptFileName: null,
        receiptMimeType: null,
      },
      include: TRANSACTION_INCLUDE,
    });

    if (current.receiptKey) {
      await this.storageService
        .deleteObject(FINANCIAL_RECEIPTS_BUCKET, current.receiptKey, { ignoreNotFound: true })
        .catch(() => undefined);
    }

    await this.audit(
      tenantId,
      actor.sub,
      id,
      { receiptKey: current.receiptKey },
      { receiptKey: null },
      ip,
    );
    return this.serializeTransaction(updated);
  }

  async getReceiptSignedUrl(tenantId: string, actor: JwtPayload, id: string) {
    await this.financeAuthorization.ensureCanAccessFinanceData(tenantId, actor);
    const current = await this.findOneOrThrow(tenantId, id);

    const storageKey = current.receiptKey?.trim();
    if (!storageKey) {
      throw new NotFoundException('Comprovante privado não encontrado para este lançamento.');
    }

    const url = await this.storageService.createPrivateSignedUrl(
      FINANCIAL_RECEIPTS_BUCKET,
      storageKey,
      RECEIPT_SIGNED_URL_TTL_SECONDS,
    );

    return {
      url,
      expiresInSeconds: RECEIPT_SIGNED_URL_TTL_SECONDS,
      fileName: current.receiptFileName ?? null,
      mimeType: current.receiptMimeType ?? null,
    };
  }

  private async findOneOrThrow(tenantId: string, id: string) {
    const transaction = await this.prisma.financialTransaction.findFirst({ where: { id, tenantId } });
    if (!transaction) throw new NotFoundException('Lançamento financeiro não encontrado.');
    return transaction;
  }

  private async validateAccountAndCategory(
    tenantId: string,
    accountId: string,
    categoryId: string,
    transactionType: FinancialTransactionType,
  ) {
    const [account, category] = await Promise.all([
      this.prisma.financialAccount.findFirst({ where: { id: accountId, tenantId, active: true } }),
      this.prisma.financialCategory.findFirst({ where: { id: categoryId, tenantId, active: true } }),
    ]);
    if (!account) throw new BadRequestException('Conta financeira inválida ou inativa.');
    if (!category) throw new BadRequestException('Categoria financeira inválida ou inativa.');
    const expectedCategoryType =
      transactionType === FinancialTransactionType.INCOME
        ? FinancialCategoryType.INCOME
        : FinancialCategoryType.EXPENSE;
    if (category.type !== expectedCategoryType) {
      throw new BadRequestException('Categoria incompatível com o tipo do lançamento.');
    }
  }

  private async validateMember(
    tenantId: string,
    memberId: string | null | undefined,
    transactionType: FinancialTransactionType,
  ) {
    if (!memberId) return null;
    if (transactionType !== FinancialTransactionType.INCOME) {
      throw new BadRequestException('Membro só pode ser vinculado a lançamentos de entrada.');
    }
    const member = await this.prisma.membro.findFirst({
      where: {
        id: memberId,
        tenantId,
        status: StatusMembro.ATIVO,
        deletedAt: null,
      },
      select: { id: true, nome: true, nomeExibicao: true },
    });
    if (!member) throw new BadRequestException('Membro inválido ou inativo.');
    return member;
  }

  private async validateEvento(tenantId: string, eventoId: string | null | undefined) {
    if (!eventoId) return null;
    const evento = await this.prisma.evento.findFirst({
      where: { id: eventoId, tenantId },
      select: { id: true },
    });
    if (!evento) throw new BadRequestException('Evento inválido.');
    return evento;
  }
  private prepareBatchOccurrences(
    dto: CreateFinancialTransactionsBatchDto,
    canConfirmOnCreate: boolean,
  ) {
    return dto.occurrences.map((occurrence) => {
      const effectiveStatus =
        occurrence.status ?? dto.defaultStatus ?? FinancialTransactionStatus.PENDING;

      if (effectiveStatus === FinancialTransactionStatus.CANCELLED) {
        throw new BadRequestException('Ocorrências em lote não podem nascer canceladas.');
      }
      if (effectiveStatus === FinancialTransactionStatus.CONFIRMED && !canConfirmOnCreate) {
        throw new ForbiddenException(
          'Apenas aprovadores ou gestores financeiros podem criar ocorrências já confirmadas.',
        );
      }
      if (
        occurrence.installmentNumber !== undefined &&
        occurrence.totalInstallments !== undefined &&
        occurrence.installmentNumber > occurrence.totalInstallments
      ) {
        throw new BadRequestException(
          'Número da parcela não pode ser maior que o total de parcelas.',
        );
      }

      const occurrenceDate = new Date(occurrence.date);
      if (Number.isNaN(occurrenceDate.getTime())) {
        throw new BadRequestException('Data da ocorrência inválida.');
      }

      return {
        date: occurrenceDate,
        paidAt: effectiveStatus === FinancialTransactionStatus.CONFIRMED ? occurrenceDate : null,
        amount: occurrence.amount,
        description: occurrence.description?.trim() || dto.description?.trim() || null,
        status: effectiveStatus,
        installmentNumber: occurrence.installmentNumber ?? null,
        totalInstallments: occurrence.totalInstallments ?? null,
      };
    });
  }

  private buildDateRangeFilter(startDate?: string, endDate?: string) {
    if (!startDate && !endDate) return {};
    const dateFilter: Prisma.DateTimeFilter = {};
    if (startDate) {
      dateFilter.gte = this.parseFilterDateBoundary(startDate, 'start');
    }
    if (endDate) {
      dateFilter.lte = this.parseFilterDateBoundary(endDate, 'end');
    }
    return { date: dateFilter };
  }

  private parseFilterDateBoundary(value: string, boundary: 'start' | 'end'): Date {
    const trimmed = value.trim();
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
    const parsed = isDateOnly
      ? new Date(`${trimmed}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`)
      : new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Filtro de data inválido.');
    }
    return parsed;
  }

  private toAmountNumber(amount: { toNumber(): number } | number): number {
    return typeof amount === 'number' ? amount : amount.toNumber();
  }

  private serializeTransaction<
    T extends {
      amount: { toNumber(): number } | number;
      receiptUrl?: string | null;
      receiptKey?: string | null;
      receiptFileName?: string | null;
      receiptMimeType?: string | null;
    },
  >(transaction: T) {
    const { receiptUrl, receiptKey, ...safe } = transaction;
    return {
      ...safe,
      amount: this.toAmountNumber(transaction.amount),
      hasReceipt: Boolean(receiptKey || receiptUrl),
      receiptFileName: transaction.receiptFileName ?? null,
      receiptMimeType: transaction.receiptMimeType ?? null,
    };
  }

  private async notifyMemberContributionDecision(params: {
    tenantId: string;
    actorId: string;
    memberId: string;
    transactionId: string;
    decision: 'confirmed' | 'rejected';
    amount: number;
    categoryName?: string | null;
    rejectionReason?: string;
  }) {
    if (!this.notificationDispatch) return;
    try {
      const targetUser = await this.prisma.user.findFirst({
        where: {
          tenantId: params.tenantId,
          memberId: params.memberId,
          ativo: true,
          status: UserStatus.ACTIVE,
        },
        select: { id: true },
      });

      const userIds = targetUser && targetUser.id !== params.actorId ? [targetUser.id] : [];
      if (userIds.length === 0) return;

      const formattedAmount = brlCurrencyFormatter.format(params.amount);
      const categorySuffix = params.categoryName ? ` (${params.categoryName})` : '';

      const titulo =
        params.decision === 'confirmed'
          ? 'Contribuição confirmada'
          : 'Comprovante de contribuição recusado';
      const mensagem =
        params.decision === 'confirmed'
          ? `Sua contribuição de ${formattedAmount}${categorySuffix} foi confirmada pela tesouraria.`
          : `Seu comprovante de ${formattedAmount}${categorySuffix} foi recusado. Motivo: ${params.rejectionReason}`;

      await this.notificationDispatch.createNotification({
        tenantId: params.tenantId,
        titulo,
        mensagem,
        urlDestino: '/minhas-contribuicoes',
        origem: NotificationOrigin.SYSTEM_AUTOMATION,
        tipoPublico: NotificationAudienceType.SPECIFIC_USERS,
        userIds,
        criadoPorId: params.actorId,
        idempotencyKey: `tenant:${params.tenantId}:contribution:${params.transactionId}:${params.decision}`,
        ignorePreferences: true,
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao notificar membro sobre contribuição ${params.transactionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private getMemberPrintName(member: { nome: string; nomeExibicao?: string | null }) {
    const displayName = member.nomeExibicao?.trim();
    if (displayName) return displayName;
    return member.nome.trim().split(/\s+/)[0] || member.nome;
  }

  private async audit(
    tenantId: string,
    actorId: string,
    transactionId: string,
    before: unknown,
    after: unknown,
    ip?: string,
    acao: AcaoAuditoria = AcaoAuditoria.ATUALIZAR,
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        entidade: 'financial_transactions',
        entidadeId: transactionId,
        acao,
        ipAddress: ip ?? null,
        payloadBefore: before as any,
        payloadAfter: after as any,
      },
    });
  }
}
