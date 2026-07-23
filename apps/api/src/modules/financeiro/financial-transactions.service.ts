import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AcaoAuditoria,
  FinanceRole,
  FinancialCategoryType,
  FinancialTransactionStatus,
  FinancialTransactionType,
  StatusMembro,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import {
  getFinancialReceiptPath,
  validateFinancialReceiptUpload,
} from '../../common/storage/image-upload';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import type { Multer } from 'multer';
import { FinanceAuthorizationService } from './finance-authorization.service';
import { CreateFinancialTransactionDto } from './dto/create-financial-transaction.dto';
import { UpdateFinancialTransactionDto } from './dto/update-financial-transaction.dto';

const WRITE_ROLES = [
  FinanceRole.FINANCE_OPERATOR,
  FinanceRole.FINANCE_APPROVER,
  FinanceRole.FINANCE_MANAGER,
];

const CANCEL_ROLES = [FinanceRole.FINANCE_APPROVER, FinanceRole.FINANCE_MANAGER];

@Injectable()
export class FinancialTransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeAuthorization: FinanceAuthorizationService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  async findAll(
    tenantId: string,
    actor: JwtPayload,
    filters: {
      startDate?: string;
      endDate?: string;
      type?: FinancialTransactionType;
      status?: FinancialTransactionStatus;
      accountId?: string;
      categoryId?: string;
    },
  ) {
    await this.financeAuthorization.ensureCanAccessFinanceData(tenantId, actor);

    const transactions = await this.prisma.financialTransaction.findMany({
      where: {
        tenantId,
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.accountId ? { accountId: filters.accountId } : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.startDate || filters.endDate
          ? {
              date: {
                ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
                ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
              },
            }
          : {}),
      },
      include: {
        account: { select: { id: true, name: true, type: true } },
        category: { select: { id: true, name: true, type: true } },
        evento: { select: { id: true, titulo: true, dataInicio: true, dataFim: true, local: true, status: true } },
        member: { select: { id: true, nome: true, email: true, whatsapp: true } },
        createdBy: { select: { id: true, nome: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });

    return transactions.map((transaction) => ({
      ...transaction,
      amount: transaction.amount.toNumber(),
    }));
  }

  async getSummary(
    tenantId: string,
    actor: JwtPayload,
    filters: { startDate?: string; endDate?: string; accountId?: string },
  ) {
    await this.financeAuthorization.ensureCanAccessFinanceData(tenantId, actor);

    const [accounts, transactions] = await Promise.all([
      this.prisma.financialAccount.findMany({ where: { tenantId, active: true } }),
      this.prisma.financialTransaction.findMany({
        where: {
          tenantId,
          status: FinancialTransactionStatus.CONFIRMED,
          ...(filters.accountId ? { accountId: filters.accountId } : {}),
          ...(filters.startDate || filters.endDate
            ? {
                date: {
                  ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
                  ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
                },
              }
            : {}),
        },
        select: { type: true, amount: true },
      }),
    ]);

    const initialBalance = accounts
      .filter((account) => !filters.accountId || account.id === filters.accountId)
      .reduce((sum, account) => sum + account.initialBalance.toNumber(), 0);
    const income = transactions
      .filter((transaction) => transaction.type === FinancialTransactionType.INCOME)
      .reduce((sum, transaction) => sum + transaction.amount.toNumber(), 0);
    const expense = transactions
      .filter((transaction) => transaction.type === FinancialTransactionType.EXPENSE)
      .reduce((sum, transaction) => sum + transaction.amount.toNumber(), 0);

    return {
      initialBalance,
      income,
      expense,
      balance: initialBalance + income - expense,
      transactions: transactions.length,
    };
  }

  async create(
    tenantId: string,
    actor: JwtPayload,
    dto: CreateFinancialTransactionDto,
    ip?: string,
  ) {
    await this.financeAuthorization.ensureFinanceRole(tenantId, actor, WRITE_ROLES);
    await this.validateAccountAndCategory(tenantId, dto.accountId, dto.categoryId, dto.type);
    await this.validateEvento(tenantId, dto.eventoId);
    const member = await this.validateMember(tenantId, dto.memberId, dto.type);

    const memberPrintName = member ? this.getMemberPrintName(member) : null;
    const transaction = await this.prisma.financialTransaction.create({
      data: {
        tenantId,
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        eventoId: dto.eventoId || null,
        memberId: member?.id ?? null,
        createdByUserId: actor.sub,
        type: dto.type,
        status: dto.status ?? FinancialTransactionStatus.CONFIRMED,
        date: new Date(dto.date),
        amount: dto.amount,
        description: dto.description?.trim() || null,
        paymentMethod: dto.paymentMethod ?? null,
        counterpartyName: memberPrintName ?? (dto.counterpartyName?.trim() || null),
      },
    });
    await this.audit(tenantId, actor.sub, transaction.id, null, { id: transaction.id, type: transaction.type, amount: transaction.amount.toNumber() }, ip);
    return { ...transaction, amount: transaction.amount.toNumber() };
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

    const nextType = dto.type ?? current.type;
    const nextAccountId = dto.accountId ?? current.accountId;
    const nextCategoryId = dto.categoryId ?? current.categoryId;
    const nextEventoId = dto.eventoId !== undefined ? dto.eventoId : current.eventoId;
    const nextMemberId = dto.memberId !== undefined ? dto.memberId : current.memberId;
    await this.validateAccountAndCategory(tenantId, nextAccountId, nextCategoryId, nextType);
    await this.validateEvento(tenantId, nextEventoId);
    const member = await this.validateMember(tenantId, nextMemberId, nextType);

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
        ...(dto.date !== undefined ? { date: new Date(dto.date) } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod ?? null } : {}),
        ...(dto.counterpartyName !== undefined || dto.memberId !== undefined || dto.type !== undefined ? { counterpartyName: memberPrintName ?? (dto.counterpartyName?.trim() || null) } : {}),
      },
    });
    await this.audit(tenantId, actor.sub, id, { status: current.status, amount: current.amount.toNumber() }, { status: updated.status, amount: updated.amount.toNumber() }, ip);
    return { ...updated, amount: updated.amount.toNumber() };
  }

  async cancel(tenantId: string, actor: JwtPayload, id: string, ip?: string) {
    await this.financeAuthorization.ensureFinanceRole(tenantId, actor, CANCEL_ROLES);
    const current = await this.findOneOrThrow(tenantId, id);
    if (current.status === FinancialTransactionStatus.CANCELLED) return { ...current, amount: current.amount.toNumber() };

    const updated = await this.prisma.financialTransaction.update({
      where: { id },
      data: {
        status: FinancialTransactionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledByUserId: actor.sub,
      },
    });
    await this.audit(tenantId, actor.sub, id, { status: current.status }, { status: updated.status }, ip);
    return { ...updated, amount: updated.amount.toNumber() };
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

    const path = getFinancialReceiptPath(tenantId, id, file!);
    const receiptUrl = await this.storageService.uploadPublicObject(
      'financial-receipts',
      path,
      file!.buffer,
      file!.mimetype,
    );

    if (current.receiptKey) {
      await this.storageService.deleteObject('financial-receipts', current.receiptKey);
    }

    const updated = await this.prisma.financialTransaction.update({
      where: { id },
      data: {
        receiptUrl,
        receiptKey: path,
        receiptFileName: file!.originalname,
        receiptMimeType: file!.mimetype,
      },
      include: {
        account: { select: { id: true, name: true, type: true } },
        category: { select: { id: true, name: true, type: true } },
        member: { select: { id: true, nome: true, nomeExibicao: true, email: true, whatsapp: true } },
      },
    });
    await this.audit(tenantId, actor.sub, id, { receiptKey: current.receiptKey }, { receiptKey: path }, ip);
    return { ...updated, amount: updated.amount.toNumber() };
  }

  async removeReceipt(tenantId: string, actor: JwtPayload, id: string, ip?: string) {
    await this.financeAuthorization.ensureFinanceRole(tenantId, actor, WRITE_ROLES);
    const current = await this.findOneOrThrow(tenantId, id);
    await this.storageService.deleteObject('financial-receipts', current.receiptKey);
    const updated = await this.prisma.financialTransaction.update({
      where: { id },
      data: {
        receiptUrl: null,
        receiptKey: null,
        receiptFileName: null,
        receiptMimeType: null,
      },
      include: {
        account: { select: { id: true, name: true, type: true } },
        category: { select: { id: true, name: true, type: true } },
        member: { select: { id: true, nome: true, nomeExibicao: true, email: true, whatsapp: true } },
      },
    });
    await this.audit(tenantId, actor.sub, id, { receiptKey: current.receiptKey }, { receiptKey: null }, ip);
    return { ...updated, amount: updated.amount.toNumber() };
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
    if (!evento) throw new BadRequestException('Evento inv�lido.');
    return evento;
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
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        entidade: 'financial_transactions',
        entidadeId: transactionId,
        acao: AcaoAuditoria.ATUALIZAR,
        ipAddress: ip ?? null,
        payloadBefore: before as any,
        payloadAfter: after as any,
      },
    });
  }
}
