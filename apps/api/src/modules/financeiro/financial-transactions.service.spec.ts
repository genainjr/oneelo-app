import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  AcaoAuditoria,
  FinanceRole,
  FinancialCategoryType,
  FinancialPaymentMethod,
  FinancialTransactionStatus,
  FinancialTransactionType,
  Role,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { CreateFinancialTransactionsBatchDto } from './dto/create-financial-transactions-batch.dto';
import { FinanceAuthorizationService } from './finance-authorization.service';
import { FinancialTransactionsService } from './financial-transactions.service';

describe('FinancialTransactionsService', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const accountId = '22222222-2222-4222-8222-222222222222';
  const categoryId = '33333333-3333-4333-8333-333333333333';
  const memberId = '44444444-4444-4444-8444-444444444444';

  const makeUser = (sub = 'user-1'): JwtPayload => ({
    sub,
    email: 'financeiro@igreja.com',
    role: Role.STAFF,
    tenantId,
  });

  const makeDecimal = (value: number) => ({
    toNumber: () => value,
  });

  const createService = (role: FinanceRole = FinanceRole.FINANCE_APPROVER) => {
    const createdRows: any[] = [];
    const txClient = {
      financialTransaction: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const row = {
            id: `tx-${createdRows.length + 1}`,
            ...data,
            amount: makeDecimal(Number(data.amount)),
            account: { id: accountId, name: 'Banco Principal', type: 'BANK' },
            category: {
              id: categoryId,
              name: data.type === FinancialTransactionType.INCOME ? 'Dízimos' : 'Despesas Fixas',
              type:
                data.type === FinancialTransactionType.INCOME
                  ? FinancialCategoryType.INCOME
                  : FinancialCategoryType.EXPENSE,
            },
            evento: null,
            member: null,
            createdBy: { id: 'user-1', nome: 'Tesoureiro' },
          };
          createdRows.push(row);
          return row;
        }),
      },
    };

    const prisma = {
      financialAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: accountId, tenantId, active: true }),
        findMany: jest.fn().mockResolvedValue([{ id: accountId, initialBalance: makeDecimal(1000) }]),
      },
      financialCategory: {
        findFirst: jest.fn().mockResolvedValue({
          id: categoryId,
          tenantId,
          active: true,
          type: FinancialCategoryType.EXPENSE,
        }),
      },
      evento: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      membro: {
        findFirst: jest.fn().mockResolvedValue({
          id: memberId,
          nome: 'João Silva',
          nomeExibicao: 'João',
        }),
      },
      financialTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'tx-single-1',
          ...data,
          amount: makeDecimal(Number(data.amount)),
        })),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: jest.fn(async (operation: (tx: typeof txClient) => Promise<unknown>) =>
        operation(txClient),
      ),
    };

    const financeAuthorization = {
      ensureCanAccessFinanceData: jest.fn().mockResolvedValue({ role }),
      ensureFinanceRole: jest.fn().mockImplementation(async (_t, _u, allowed: FinanceRole[]) => {
        if (!allowed.includes(role)) {
          throw new ForbiddenException('Acesso negado: permissão financeira insuficiente.');
        }
        return { role };
      }),
    };

    const storageService = {
      uploadPublicObject: jest.fn(),
      deleteObject: jest.fn(),
    };

    return {
      service: new FinancialTransactionsService(
        prisma as unknown as PrismaService,
        financeAuthorization as unknown as FinanceAuthorizationService,
        storageService as unknown as SupabaseStorageService,
      ),
      prisma,
      txClient,
      financeAuthorization,
    };
  };

  it('preenche paidAt quando lançamento avulso nasce CONFIRMED e mantém null quando PENDING', async () => {
    const { service, prisma } = createService(FinanceRole.FINANCE_APPROVER);

    await service.create(tenantId, makeUser(), {
      type: FinancialTransactionType.EXPENSE,
      status: FinancialTransactionStatus.CONFIRMED,
      date: '2026-11-17T12:00:00.000Z',
      amount: 150,
      accountId,
      categoryId,
      description: 'Compra avulsa',
    });

    expect(prisma.financialTransaction.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: FinancialTransactionStatus.CONFIRMED,
          paidAt: new Date('2026-11-17T12:00:00.000Z'),
        }),
      }),
    );

    await service.create(tenantId, makeUser(), {
      type: FinancialTransactionType.EXPENSE,
      status: FinancialTransactionStatus.PENDING,
      date: '2026-12-10T12:00:00.000Z',
      amount: 200,
      accountId,
      categoryId,
      description: 'Conta futura',
    });

    expect(prisma.financialTransaction.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: FinancialTransactionStatus.PENDING,
          paidAt: null,
        }),
      }),
    );
  });

  it('cria lote válido atomicamente com recurringGroupId único e validação única pré-loop', async () => {
    const { service, prisma, txClient } = createService(FinanceRole.FINANCE_APPROVER);

    const result = await service.createBatch(
      tenantId,
      makeUser(),
      {
        type: FinancialTransactionType.EXPENSE,
        accountId,
        categoryId,
        paymentMethod: FinancialPaymentMethod.BOLETO,
        counterpartyName: 'Companhia Elétrica',
        description: 'Energia do Templo',
        occurrences: [
          {
            date: '2026-11-20T12:00:00.000Z',
            amount: 333.33,
            status: FinancialTransactionStatus.CONFIRMED,
            installmentNumber: 1,
            totalInstallments: 3,
          },
          {
            date: '2026-12-20T12:00:00.000Z',
            amount: 333.33,
            status: FinancialTransactionStatus.PENDING,
            installmentNumber: 2,
            totalInstallments: 3,
          },
          {
            date: '2027-01-20T12:00:00.000Z',
            amount: 333.34,
            status: FinancialTransactionStatus.PENDING,
            installmentNumber: 3,
            totalInstallments: 3,
          },
        ],
      },
      '127.0.0.1',
    );

    expect(result.count).toBe(3);
    expect(result.recurringGroupId).toBeTruthy();
    expect(prisma.financialAccount.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.financialCategory.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(txClient.financialTransaction.create).toHaveBeenCalledTimes(3);

    expect(result.items[0].recurringGroupId).toBe(result.recurringGroupId);
    expect(result.items[0].paidAt).toEqual(new Date('2026-11-20T12:00:00.000Z'));
    expect(result.items[1].paidAt).toBeNull();
    expect(result.items[2].amount).toBe(333.34);

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId,
          entidade: 'financial_transactions',
          entidadeId: result.recurringGroupId,
          acao: AcaoAuditoria.CRIAR,
          ipAddress: '127.0.0.1',
          payloadAfter: expect.objectContaining({
            recurringGroupId: result.recurringGroupId,
            count: 3,
            totalAmount: 1000,
          }),
        }),
      }),
    );
  });

  it('rejeita lote acima do limite de 120 ocorrências tanto no service quanto na validação do DTO', async () => {
    const { service } = createService(FinanceRole.FINANCE_MANAGER);
    const occurrences = Array.from({ length: 121 }, (_, index) => ({
      date: '2026-11-20T12:00:00.000Z',
      amount: 50,
      installmentNumber: index + 1,
      totalInstallments: 121,
    }));

    await expect(
      service.createBatch(tenantId, makeUser(), {
        type: FinancialTransactionType.EXPENSE,
        accountId,
        categoryId,
        occurrences,
      }),
    ).rejects.toThrow(BadRequestException);

    const dto = plainToInstance(CreateFinancialTransactionsBatchDto, {
      type: FinancialTransactionType.EXPENSE,
      accountId,
      categoryId,
      occurrences,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejeita memberId vinculado a despesa (EXPENSE) no lote', async () => {
    const { service, prisma } = createService(FinanceRole.FINANCE_APPROVER);

    await expect(
      service.createBatch(tenantId, makeUser(), {
        type: FinancialTransactionType.EXPENSE,
        accountId,
        categoryId,
        memberId,
        occurrences: [{ date: '2026-11-20T12:00:00.000Z', amount: 100 }],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('isola contas/categorias por tenantId e falha se recurso não pertencer ao tenant', async () => {
    const { service, prisma } = createService(FinanceRole.FINANCE_MANAGER);
    prisma.financialAccount.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.createBatch(tenantId, makeUser(), {
        type: FinancialTransactionType.EXPENSE,
        accountId: 'other-tenant-account',
        categoryId,
        occurrences: [{ date: '2026-11-20T12:00:00.000Z', amount: 90 }],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.financialAccount.findFirst).toHaveBeenCalledWith({
      where: { id: 'other-tenant-account', tenantId, active: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('bloqueia FINANCE_OPERATOR de criar ocorrências já CONFIRMED no lote, permitindo apenas PENDING ou DRAFT', async () => {
    const { service, prisma } = createService(FinanceRole.FINANCE_OPERATOR);

    await expect(
      service.createBatch(tenantId, makeUser(), {
        type: FinancialTransactionType.EXPENSE,
        accountId,
        categoryId,
        defaultStatus: FinancialTransactionStatus.CONFIRMED,
        occurrences: [{ date: '2026-11-20T12:00:00.000Z', amount: 120 }],
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();

    const allowed = await service.createBatch(tenantId, makeUser(), {
      type: FinancialTransactionType.EXPENSE,
      accountId,
      categoryId,
      defaultStatus: FinancialTransactionStatus.PENDING,
      occurrences: [
        { date: '2026-11-20T12:00:00.000Z', amount: 120 },
        {
          date: '2026-12-20T12:00:00.000Z',
          amount: 120,
          status: FinancialTransactionStatus.DRAFT,
        },
      ],
    });

    expect(allowed.count).toBe(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('realiza baixa de conta PENDING para CONFIRMED gravando paidAt e AuditLog para APPROVER', async () => {
    const { service, prisma } = createService(FinanceRole.FINANCE_APPROVER);
    prisma.financialTransaction.findFirst.mockResolvedValueOnce({
      id: 'tx-pending-1',
      tenantId,
      status: FinancialTransactionStatus.PENDING,
      paidAt: null,
      paymentMethod: FinancialPaymentMethod.BOLETO,
      amount: makeDecimal(250),
    });
    prisma.financialTransaction.update.mockResolvedValueOnce({
      id: 'tx-pending-1',
      tenantId,
      status: FinancialTransactionStatus.CONFIRMED,
      paidAt: new Date('2026-11-18T12:00:00.000Z'),
      paymentMethod: FinancialPaymentMethod.PIX,
      amount: makeDecimal(255.5),
    });

    const result = await service.confirm(
      tenantId,
      makeUser(),
      'tx-pending-1',
      {
        paidAt: '2026-11-18T12:00:00.000Z',
        paymentMethod: FinancialPaymentMethod.PIX,
        amount: 255.5,
      },
      '10.0.0.1',
    );

    expect(result.status).toBe(FinancialTransactionStatus.CONFIRMED);
    expect(result.amount).toBe(255.5);
    expect(prisma.financialTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx-pending-1' },
        data: expect.objectContaining({
          status: FinancialTransactionStatus.CONFIRMED,
          paidAt: new Date('2026-11-18T12:00:00.000Z'),
          paymentMethod: FinancialPaymentMethod.PIX,
          amount: 255.5,
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entidadeId: 'tx-pending-1',
          acao: AcaoAuditoria.ATUALIZAR,
          payloadBefore: expect.objectContaining({
            status: FinancialTransactionStatus.PENDING,
            amount: 250,
          }),
          payloadAfter: expect.objectContaining({
            status: FinancialTransactionStatus.CONFIRMED,
            amount: 255.5,
          }),
        }),
      }),
    );
  });

  it('rejeita baixa por FINANCE_OPERATOR e rejeita baixa de lançamentos já CONFIRMED ou CANCELLED', async () => {
    const operatorSetup = createService(FinanceRole.FINANCE_OPERATOR);
    await expect(
      operatorSetup.service.confirm(tenantId, makeUser(), 'tx-pending-1', {}),
    ).rejects.toThrow(ForbiddenException);

    const approverSetup = createService(FinanceRole.FINANCE_APPROVER);
    approverSetup.prisma.financialTransaction.findFirst.mockResolvedValueOnce({
      id: 'tx-confirmed',
      tenantId,
      status: FinancialTransactionStatus.CONFIRMED,
      amount: makeDecimal(100),
    });
    await expect(
      approverSetup.service.confirm(tenantId, makeUser(), 'tx-confirmed', {}),
    ).rejects.toThrow(BadRequestException);

    approverSetup.prisma.financialTransaction.findFirst.mockResolvedValueOnce({
      id: 'tx-cancelled',
      tenantId,
      status: FinancialTransactionStatus.CANCELLED,
      amount: makeDecimal(100),
    });
    await expect(
      approverSetup.service.confirm(tenantId, makeUser(), 'tx-cancelled', {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('calcula resumo mantendo saldo estritamente sobre CONFIRMED e expondo totais PENDING separados', async () => {
    const { service, prisma } = createService(FinanceRole.FINANCE_VIEWER);
    prisma.financialTransaction.findMany.mockResolvedValueOnce([
      {
        type: FinancialTransactionType.INCOME,
        status: FinancialTransactionStatus.CONFIRMED,
        amount: makeDecimal(500.25),
      },
      {
        type: FinancialTransactionType.EXPENSE,
        status: FinancialTransactionStatus.CONFIRMED,
        amount: makeDecimal(200.1),
      },
      {
        type: FinancialTransactionType.INCOME,
        status: FinancialTransactionStatus.PENDING,
        amount: makeDecimal(350),
      },
      {
        type: FinancialTransactionType.EXPENSE,
        status: FinancialTransactionStatus.PENDING,
        amount: makeDecimal(125.75),
      },
      {
        type: FinancialTransactionType.EXPENSE,
        status: FinancialTransactionStatus.PENDING,
        amount: makeDecimal(74.25),
      },
    ]);

    const summary = await service.getSummary(tenantId, makeUser(), {
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    });

    expect(summary).toEqual({
      initialBalance: 1000,
      income: 500.25,
      expense: 200.1,
      balance: 1300.15,
      transactions: 2,
      pendingIncome: 350,
      pendingExpense: 200,
      pendingCount: 3,
    });
  });

  it('aplica filtros de período YYYY-MM-DD, evento, membro, recurringGroupId e teto seguro de limit em findAll', async () => {
    const { service, prisma } = createService(FinanceRole.FINANCE_VIEWER);

    await service.findAll(tenantId, makeUser(), {
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      eventoId: 'evento-1',
      memberId,
      recurringGroupId: 'group-1',
      limit: 9999,
    });

    expect(prisma.financialTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          eventoId: 'evento-1',
          memberId,
          recurringGroupId: 'group-1',
          date: {
            gte: new Date('2026-11-01T00:00:00.000Z'),
            lte: new Date('2026-11-30T23:59:59.999Z'),
          },
        }),
        orderBy: [{ installmentNumber: 'asc' }, { date: 'asc' }],
        take: 500,
      }),
    );
  });
});
