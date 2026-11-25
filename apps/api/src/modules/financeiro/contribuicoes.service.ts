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
import type { Multer } from 'multer';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  getFinancialReceiptPath,
  validateFinancialReceiptUpload,
} from '../../common/storage/image-upload';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { NotificationDispatchService } from '../notifications/services/notification-dispatch.service';
import { CreateMemberContributionDto } from './dto/create-member-contribution.dto';
import { generatePixBrCode } from './pix-brcode.util';

const FINANCIAL_RECEIPTS_BUCKET = 'financial-receipts';
const RECEIPT_SIGNED_URL_TTL_SECONDS = 300;
const brlCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

@Injectable()
export class ContribuicoesService {
  private readonly logger = new Logger(ContribuicoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: SupabaseStorageService,
    @Optional()
    private readonly notificationDispatch?: NotificationDispatchService,
  ) {}

  async getMemberPixInfo(tenantId: string, user: JwtPayload, rawAmount?: string) {
    await this.resolveLinkedMemberOrThrow(tenantId, user, { requireActive: false });

    let amount: number | null = null;
    if (rawAmount !== undefined && rawAmount !== null && rawAmount.trim() !== '') {
      const parsed = Number(rawAmount);
      if (!Number.isFinite(parsed) || parsed < 0.01 || parsed > 9_999_999.99) {
        throw new BadRequestException(
          'Informe um valor válido entre R$ 0,01 e R$ 9.999.999,99.',
        );
      }
      amount = parsed;
    }

    const [pixConfig, categories] = await Promise.all([
      this.prisma.tenantPixConfig.findUnique({
        where: { tenantId },
        include: {
          defaultAccount: {
            select: { active: true },
          },
        },
      }),
      this.prisma.financialCategory.findMany({
        where: {
          tenantId,
          type: FinancialCategoryType.INCOME,
          active: true,
          visibleToMembers: true,
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const enabled = Boolean(pixConfig?.enabled && pixConfig.defaultAccount?.active);
    if (!enabled || !pixConfig) {
      return {
        enabled: false,
        pix: null,
        categories: [],
      };
    }

    const brCode = generatePixBrCode({
      pixKeyType: pixConfig.pixKeyType,
      pixKey: pixConfig.pixKey,
      merchantName: pixConfig.merchantName,
      merchantCity: pixConfig.merchantCity,
      txidPrefix: pixConfig.txidPrefix,
      amount,
    });

    return {
      enabled: true,
      pix: {
        pixKeyType: pixConfig.pixKeyType,
        pixKey: pixConfig.pixKey,
        merchantName: pixConfig.merchantName,
        merchantCity: pixConfig.merchantCity,
        txidPrefix: pixConfig.txidPrefix ?? null,
        brCode,
      },
      categories,
    };
  }

  async listMyContributions(tenantId: string, user: JwtPayload, rawYear?: string) {
    const member = await this.resolveLinkedMemberOrThrow(tenantId, user, {
      requireActive: false,
    });

    const currentYear = this.getCurrentSaoPauloYear();
    const year = this.parseYear(rawYear, currentYear);

    const visibilityWhere = this.buildMemberVisibilityWhere(tenantId, member.id);
    const startOfYear = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const [yearRows, allDates] = await Promise.all([
      this.prisma.financialTransaction.findMany({
        where: {
          ...visibilityWhere,
          date: { gte: startOfYear, lte: endOfYear },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          status: true,
          source: true,
          date: true,
          paidAt: true,
          amount: true,
          description: true,
          paymentMethod: true,
          payerName: true,
          rejectionReason: true,
          receiptKey: true,
          receiptUrl: true,
          receiptFileName: true,
          receiptMimeType: true,
          createdAt: true,
          category: { select: { id: true, name: true } },
        },
      }),
      this.prisma.financialTransaction.findMany({
        where: visibilityWhere,
        select: { date: true },
      }),
    ]);

    const yearsSet = new Set<number>([currentYear, year]);
    for (const row of allDates) {
      yearsSet.add(row.date.getUTCFullYear());
    }
    const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

    let confirmedTotalCents = 0;
    let confirmedCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;

    const items = yearRows.map((row) => {
      const amount = this.toAmountNumber(row.amount);
      const cents = Math.round(amount * 100);
      if (row.status === FinancialTransactionStatus.CONFIRMED) {
        confirmedTotalCents += cents;
        confirmedCount += 1;
      } else if (row.status === FinancialTransactionStatus.PENDING) {
        pendingCount += 1;
      } else if (row.status === FinancialTransactionStatus.CANCELLED) {
        rejectedCount += 1;
      }

      return {
        id: row.id,
        status: row.status,
        source: row.source,
        date: row.date,
        paidAt: row.paidAt,
        amount,
        description: row.description,
        paymentMethod: row.paymentMethod,
        payerName: row.payerName,
        rejectionReason: row.rejectionReason,
        hasReceipt: Boolean(row.receiptKey || row.receiptUrl),
        receiptFileName: row.receiptFileName ?? null,
        receiptMimeType: row.receiptMimeType ?? null,
        canDelete:
          row.source === FinancialTransactionSource.MEMBER_PORTAL &&
          row.status === FinancialTransactionStatus.PENDING,
        createdAt: row.createdAt,
        category: row.category,
      };
    });

    return {
      year,
      availableYears,
      summary: {
        confirmedTotal: confirmedTotalCents / 100,
        confirmedCount,
        pendingCount,
        rejectedCount,
      },
      items,
    };
  }

  async createMyContribution(
    tenantId: string,
    user: JwtPayload,
    dto: CreateMemberContributionDto,
    file: Multer.File | undefined,
    ip?: string,
  ) {
    const member = await this.resolveLinkedMemberOrThrow(tenantId, user, {
      requireActive: true,
    });

    validateFinancialReceiptUpload(file);

    const parsedDate = this.parseContributionDate(dto.date);

    const [pixConfig, category] = await Promise.all([
      this.prisma.tenantPixConfig.findUnique({
        where: { tenantId },
        include: {
          defaultAccount: { select: { id: true, active: true } },
        },
      }),
      this.prisma.financialCategory.findFirst({
        where: {
          id: dto.categoryId,
          tenantId,
          type: FinancialCategoryType.INCOME,
          active: true,
          visibleToMembers: true,
        },
        select: { id: true, name: true },
      }),
    ]);

    if (!pixConfig?.enabled || !pixConfig.defaultAccount?.active) {
      throw new BadRequestException(
        'O envio digital de comprovantes PIX não está habilitado no momento.',
      );
    }

    if (!category) {
      throw new BadRequestException(
        'Categoria inválida ou indisponível para contribuições de membros.',
      );
    }

    const transactionId = randomUUID();
    const storagePath = getFinancialReceiptPath(tenantId, transactionId, file!);

    await this.storageService.uploadPrivateObject(
      FINANCIAL_RECEIPTS_BUCKET,
      storagePath,
      file!.buffer,
      file!.mimetype,
    );

    const payerName = dto.payerName?.trim() || null;
    const memberPrintName = this.getMemberPrintName(member);

    let created: {
      id: string;
      status: FinancialTransactionStatus;
      source: FinancialTransactionSource;
      date: Date;
      paidAt: Date | null;
      amount: { toNumber(): number } | number;
      description: string | null;
      paymentMethod: FinancialPaymentMethod | null;
      payerName: string | null;
      rejectionReason: string | null;
      receiptFileName: string | null;
      receiptMimeType: string | null;
      createdAt: Date;
      category: { id: string; name: string };
    };

    try {
      created = await this.prisma.financialTransaction.create({
        data: {
          id: transactionId,
          tenantId,
          accountId: pixConfig.defaultAccount.id,
          categoryId: category.id,
          memberId: member.id,
          createdByUserId: user.sub,
          type: FinancialTransactionType.INCOME,
          status: FinancialTransactionStatus.PENDING,
          source: FinancialTransactionSource.MEMBER_PORTAL,
          date: parsedDate,
          paidAt: null,
          amount: dto.amount,
          description: dto.description?.trim() || null,
          paymentMethod: FinancialPaymentMethod.PIX,
          counterpartyName: payerName ?? memberPrintName,
          payerName,
          receiptUrl: null,
          receiptKey: storagePath,
          receiptFileName: file!.originalname,
          receiptMimeType: file!.mimetype,
        },
        select: {
          id: true,
          status: true,
          source: true,
          date: true,
          paidAt: true,
          amount: true,
          description: true,
          paymentMethod: true,
          payerName: true,
          rejectionReason: true,
          receiptFileName: true,
          receiptMimeType: true,
          createdAt: true,
          category: { select: { id: true, name: true } },
        },
      });
    } catch (error) {
      await this.storageService
        .deleteObject(FINANCIAL_RECEIPTS_BUCKET, storagePath, { ignoreNotFound: true })
        .catch(() => undefined);
      throw error;
    }

    const amountNumber = this.toAmountNumber(created.amount);

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.sub,
        entidade: 'financial_transactions',
        entidadeId: created.id,
        acao: AcaoAuditoria.CRIAR,
        ipAddress: ip ?? null,
        payloadAfter: {
          id: created.id,
          source: FinancialTransactionSource.MEMBER_PORTAL,
          status: FinancialTransactionStatus.PENDING,
          amount: amountNumber,
          categoryId: category.id,
          memberId: member.id,
        },
      },
    });

    await this.notifyTreasuryAboutSubmission({
      tenantId,
      actorId: user.sub,
      transactionId: created.id,
      memberName: memberPrintName,
      categoryName: category.name,
      amount: amountNumber,
    });

    return {
      ...created,
      amount: amountNumber,
      hasReceipt: true,
      canDelete: true,
    };
  }

  async deleteMyPendingContribution(
    tenantId: string,
    user: JwtPayload,
    id: string,
    ip?: string,
  ) {
    const member = await this.resolveLinkedMemberOrThrow(tenantId, user, {
      requireActive: false,
    });

    const existing = await this.prisma.financialTransaction.findFirst({
      where: { id, tenantId, memberId: member.id },
      select: {
        id: true,
        source: true,
        status: true,
        receiptKey: true,
        amount: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Contribuição não encontrada.');
    }

    if (
      existing.source !== FinancialTransactionSource.MEMBER_PORTAL ||
      existing.status !== FinancialTransactionStatus.PENDING
    ) {
      throw new BadRequestException(
        'Apenas comprovantes enviados por você que ainda estão em análise podem ser cancelados.',
      );
    }

    const deleted = await this.prisma.financialTransaction.deleteMany({
      where: {
        id,
        tenantId,
        memberId: member.id,
        source: FinancialTransactionSource.MEMBER_PORTAL,
        status: FinancialTransactionStatus.PENDING,
      },
    });

    if (deleted.count === 0) {
      throw new BadRequestException(
        'Esta contribuição já foi processada pela tesouraria e não pode mais ser cancelada.',
      );
    }

    if (existing.receiptKey) {
      await this.storageService
        .deleteObject(FINANCIAL_RECEIPTS_BUCKET, existing.receiptKey, { ignoreNotFound: true })
        .catch(() => undefined);
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.sub,
        entidade: 'financial_transactions',
        entidadeId: id,
        acao: AcaoAuditoria.DELETAR,
        ipAddress: ip ?? null,
        payloadBefore: {
          id,
          source: existing.source,
          status: existing.status,
          amount: this.toAmountNumber(existing.amount),
        },
      },
    });

    return { deleted: true, id };
  }

  async getMyReceiptSignedUrl(tenantId: string, user: JwtPayload, id: string) {
    const member = await this.resolveLinkedMemberOrThrow(tenantId, user, {
      requireActive: false,
    });

    const transaction = await this.prisma.financialTransaction.findFirst({
      where: {
        ...this.buildMemberVisibilityWhere(tenantId, member.id),
        id,
      },
      select: {
        id: true,
        receiptKey: true,
        receiptFileName: true,
        receiptMimeType: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Contribuição não encontrada.');
    }

    const storageKey = transaction.receiptKey?.trim();
    if (!storageKey) {
      throw new NotFoundException('Comprovante privado não encontrado para esta contribuição.');
    }

    const url = await this.storageService.createPrivateSignedUrl(
      FINANCIAL_RECEIPTS_BUCKET,
      storageKey,
      RECEIPT_SIGNED_URL_TTL_SECONDS,
    );

    return {
      url,
      expiresInSeconds: RECEIPT_SIGNED_URL_TTL_SECONDS,
      fileName: transaction.receiptFileName ?? null,
      mimeType: transaction.receiptMimeType ?? null,
    };
  }

  private async resolveLinkedMemberOrThrow(
    tenantId: string,
    user: JwtPayload,
    options: { requireActive: boolean },
  ) {
    if (!user.memberId) {
      throw new ForbiddenException(
        'Sua conta não está vinculada a um cadastro de membro nesta igreja.',
      );
    }

    const member = await this.prisma.membro.findFirst({
      where: {
        id: user.memberId,
        tenantId,
        deletedAt: null,
        ...(options.requireActive ? { status: StatusMembro.ATIVO } : {}),
      },
      select: {
        id: true,
        nome: true,
        nomeExibicao: true,
        status: true,
      },
    });

    if (!member) {
      throw new ForbiddenException(
        options.requireActive
          ? 'Apenas membros ativos podem enviar comprovantes de contribuição.'
          : 'Cadastro de membro não encontrado ou indisponível nesta igreja.',
      );
    }

    return member;
  }

  private buildMemberVisibilityWhere(
    tenantId: string,
    memberId: string,
  ): Prisma.FinancialTransactionWhereInput {
    return {
      tenantId,
      memberId,
      type: FinancialTransactionType.INCOME,
      OR: [
        { source: FinancialTransactionSource.MEMBER_PORTAL },
        {
          source: FinancialTransactionSource.TREASURY,
          status: FinancialTransactionStatus.CONFIRMED,
        },
      ],
    };
  }

  private async notifyTreasuryAboutSubmission(params: {
    tenantId: string;
    actorId: string;
    transactionId: string;
    memberName: string;
    categoryName: string;
    amount: number;
  }) {
    if (!this.notificationDispatch) return;
    try {
      const permissions = await this.prisma.financePermission.findMany({
        where: {
          tenantId: params.tenantId,
          revokedAt: null,
          role: {
            in: [FinanceRole.FINANCE_APPROVER, FinanceRole.FINANCE_MANAGER],
          },
          user: {
            ativo: true,
            status: UserStatus.ACTIVE,
          },
        },
        select: { userId: true },
      });

      const userIds = Array.from(
        new Set(permissions.map((p) => p.userId).filter((id) => id !== params.actorId)),
      );
      if (userIds.length === 0) return;

      const formattedAmount = brlCurrencyFormatter.format(params.amount);

      await this.notificationDispatch.createNotification({
        tenantId: params.tenantId,
        titulo: 'Novo comprovante PIX para conferência',
        mensagem: `${params.memberName} enviou um comprovante de ${formattedAmount} (${params.categoryName}).`,
        urlDestino: '/financeiro?source=MEMBER_PORTAL&status=PENDING',
        origem: NotificationOrigin.SYSTEM_AUTOMATION,
        tipoPublico: NotificationAudienceType.SPECIFIC_USERS,
        userIds,
        criadoPorId: params.actorId,
        idempotencyKey: `tenant:${params.tenantId}:contribution:${params.transactionId}:submitted`,
        ignorePreferences: true,
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao notificar tesouraria sobre comprovante ${params.transactionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private parseContributionDate(rawDate: string): Date {
    const trimmed = rawDate.trim();
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
    const parsed = isDateOnly ? new Date(`${trimmed}T12:00:00.000Z`) : new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Data da contribuição inválida.');
    }
    return parsed;
  }

  private getCurrentSaoPauloYear(): number {
    const yearStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
    }).format(new Date());
    return Number(yearStr) || new Date().getUTCFullYear();
  }

  private parseYear(rawYear: string | undefined, fallbackYear: number): number {
    if (!rawYear?.trim()) return fallbackYear;
    const parsed = Number(rawYear.trim());
    if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
      throw new BadRequestException('Ano inválido.');
    }
    return parsed;
  }

  private toAmountNumber(amount: { toNumber(): number } | number): number {
    return typeof amount === 'number' ? amount : amount.toNumber();
  }

  private getMemberPrintName(member: { nome: string; nomeExibicao?: string | null }) {
    const displayName = member.nomeExibicao?.trim();
    if (displayName) return displayName;
    return member.nome.trim().split(/\s+/)[0] || member.nome;
  }
}
