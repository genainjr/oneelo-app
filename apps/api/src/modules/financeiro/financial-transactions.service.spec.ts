import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AcaoAuditoria,
  FinanceRole,
  FinancialCategoryType,
  FinancialPaymentMethod,
  FinancialTransactionSource,
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
import { ExportFinanceiroDto } from './dto/export-financeiro.dto';
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
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          nome: 'Igreja Central',
          logoUrl: 'https://cdn.example.com/logo.png',
        }),
      },
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
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 }, _sum: { amount: null } }),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'tx-single-1',
          ...data,
          amount: makeDecimal(Number(data.amount)),
        })),
        update: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'member-user-1' }),
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
      uploadPrivateObject: jest.fn().mockImplementation(async (_b, p) => p),
      createPrivateSignedUrl: jest
        .fn()
        .mockResolvedValue('https://demo.supabase.co/storage/v1/object/sign/financial-receipts/p?token=123'),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };

    const notificationDispatch = {
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    return {
      service: new FinancialTransactionsService(
        prisma as unknown as PrismaService,
        financeAuthorization as unknown as FinanceAuthorizationService,
        storageService as unknown as SupabaseStorageService,
        notificationDispatch as any,
      ),
      prisma,
      txClient,
      financeAuthorization,
      storageService,
      notificationDispatch,
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

    prisma.financialTransaction.aggregate.mockResolvedValueOnce({
      _count: { _all: 2 },
      _sum: { amount: makeDecimal(180.5) },
    });

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
      pendingMemberCount: 2,
      pendingMemberAmount: 180.5,
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

  it('normaliza ExportFinanceiroDto convertendo strings vazias e "all" em undefined e restringindo formato a pdf', async () => {
    const validDto = plainToInstance(ExportFinanceiroDto, {
      formato: '',
      status: 'all',
      type: 'all',
      description: '  dízimo  ',
      startDate: '2026-11-01',
      endDate: '',
      _t: '1795136000000',
    });
    expect(await validate(validDto)).toHaveLength(0);
    expect(validDto.formato).toBe('pdf');
    expect(validDto.status).toBeUndefined();
    expect(validDto.type).toBeUndefined();
    expect(validDto.description).toBe('dízimo');
    expect(validDto.endDate).toBeUndefined();

    const invalidFormatDto = plainToInstance(ExportFinanceiroDto, {
      formato: 'png',
    });
    expect((await validate(invalidFormatDto)).length).toBeGreaterThan(0);
  });

  it('filtra description sem acentos em múltiplos campos (descrição, categoria, contraparte, membro, evento, tipo e pagamento) em findAll', async () => {
    const { service, prisma } = createService(FinanceRole.FINANCE_VIEWER);
    const makeRow = (overrides: Record<string, unknown>) => ({
      id: 'tx-1',
      tenantId,
      type: FinancialTransactionType.INCOME,
      status: FinancialTransactionStatus.CONFIRMED,
      date: new Date('2026-11-10T12:00:00.000Z'),
      paidAt: new Date('2026-11-10T12:00:00.000Z'),
      createdAt: new Date('2026-11-10T12:00:00.000Z'),
      updatedAt: new Date('2026-11-10T12:00:00.000Z'),
      amount: makeDecimal(100),
      description: 'Oferta de Missões',
      paymentMethod: FinancialPaymentMethod.CREDIT_CARD,
      counterpartyName: 'José Conceição',
      installmentNumber: null,
      totalInstallments: null,
      account: { id: accountId, name: 'Caixa Central', type: 'CASH' },
      category: { id: categoryId, name: 'Dízimos', type: 'INCOME' },
      evento: { id: 'ev-1', titulo: 'Conferência Profética', dataInicio: new Date(), dataFim: null, local: null, status: 'AGENDADO' },
      member: { id: memberId, nome: 'Ação Comunitária', email: null, whatsapp: null },
      createdBy: { id: 'user-1', nome: 'Tesoureiro' },
      ...overrides,
    });

    const rows = [
      makeRow({ id: 'tx-dizimo' }),
      makeRow({
        id: 'tx-energia',
        type: FinancialTransactionType.EXPENSE,
        description: 'Conta de Energia',
        paymentMethod: FinancialPaymentMethod.BOLETO,
        counterpartyName: 'Companhia Elétrica',
        category: { id: 'cat-2', name: 'Utilidades', type: 'EXPENSE' },
        evento: null,
        member: null,
      }),
    ];

    // Busca sem acento em forma de pagamento traduzida ("Cartão de crédito")
    prisma.financialTransaction.findMany.mockResolvedValueOnce(rows);
    const byPayment = await service.findAll(tenantId, makeUser(), { description: 'cartao de credito' });
    expect(byPayment.map((item) => item.id)).toEqual(['tx-dizimo']);
    expect(prisma.financialTransaction.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 2000 }),
    );

    // Busca sem acento em evento
    prisma.financialTransaction.findMany.mockResolvedValueOnce(rows);
    const byEvento = await service.findAll(tenantId, makeUser(), { description: 'conferencia' });
    expect(byEvento.map((item) => item.id)).toEqual(['tx-dizimo']);

    // Busca sem acento em tipo traduzido ("Saída")
    prisma.financialTransaction.findMany.mockResolvedValueOnce(rows);
    const byType = await service.findAll(tenantId, makeUser(), { description: 'saida' });
    expect(byType.map((item) => item.id)).toEqual(['tx-energia']);

    // Busca sem acento em membro
    prisma.financialTransaction.findMany.mockResolvedValueOnce(rows);
    const byMember = await service.findAll(tenantId, makeUser(), { description: 'acao comunitaria' });
    expect(byMember.map((item) => item.id)).toEqual(['tx-dizimo']);
  });

  it('prepara dados de exportação ordenados cronologicamente com totais em centavos separando CONFIRMED, PENDING, DRAFT e CANCELLED e rótulos legíveis', async () => {
    const { service, prisma } = createService(FinanceRole.FINANCE_VIEWER);
    prisma.financialTransaction.findMany.mockResolvedValueOnce([
      {
        id: 'tx-cancel',
        tenantId,
        type: FinancialTransactionType.EXPENSE,
        status: FinancialTransactionStatus.CANCELLED,
        date: new Date('2026-11-20T12:00:00.000Z'),
        paidAt: null,
        createdAt: new Date('2026-11-20T12:00:00.000Z'),
        updatedAt: new Date('2026-11-20T12:00:00.000Z'),
        amount: makeDecimal(999.99),
        description: 'Compra cancelada',
        paymentMethod: FinancialPaymentMethod.PIX,
        counterpartyName: 'Fornecedor X',
        installmentNumber: null,
        totalInstallments: null,
        account: { id: accountId, name: 'Banco Principal', type: 'BANK' },
        category: { id: categoryId, name: 'Manutenção', type: 'EXPENSE' },
        evento: { id: 'ev-1', titulo: 'Congresso Anual', dataInicio: new Date(), dataFim: null, local: null, status: 'AGENDADO' },
        member: { id: memberId, nome: 'João Silva', email: null, whatsapp: null },
        createdBy: { id: 'user-1', nome: 'Tesoureiro' },
      },
      {
        id: 'tx-draft',
        tenantId,
        type: FinancialTransactionType.INCOME,
        status: FinancialTransactionStatus.DRAFT,
        date: new Date('2026-11-15T12:00:00.000Z'),
        paidAt: null,
        createdAt: new Date('2026-11-15T12:00:00.000Z'),
        updatedAt: new Date('2026-11-15T12:00:00.000Z'),
        amount: makeDecimal(400),
        description: 'Rascunho oferta',
        paymentMethod: null,
        counterpartyName: null,
        installmentNumber: null,
        totalInstallments: null,
        account: { id: accountId, name: 'Banco Principal', type: 'BANK' },
        category: { id: categoryId, name: 'Manutenção', type: 'EXPENSE' },
        evento: { id: 'ev-1', titulo: 'Congresso Anual', dataInicio: new Date(), dataFim: null, local: null, status: 'AGENDADO' },
        member: { id: memberId, nome: 'João Silva', email: null, whatsapp: null },
        createdBy: { id: 'user-1', nome: 'Tesoureiro' },
      },
      {
        id: 'tx-pending',
        tenantId,
        type: FinancialTransactionType.EXPENSE,
        status: FinancialTransactionStatus.PENDING,
        date: new Date('2026-11-12T12:00:00.000Z'),
        paidAt: null,
        createdAt: new Date('2026-11-12T12:00:00.000Z'),
        updatedAt: new Date('2026-11-12T12:00:00.000Z'),
        amount: makeDecimal(150.25),
        description: 'Som pendente',
        paymentMethod: FinancialPaymentMethod.BOLETO,
        counterpartyName: null,
        installmentNumber: 1,
        totalInstallments: 2,
        account: { id: accountId, name: 'Banco Principal', type: 'BANK' },
        category: { id: categoryId, name: 'Manutenção', type: 'EXPENSE' },
        evento: { id: 'ev-1', titulo: 'Congresso Anual', dataInicio: new Date(), dataFim: null, local: null, status: 'AGENDADO' },
        member: { id: memberId, nome: 'João Silva', email: null, whatsapp: null },
        createdBy: { id: 'user-1', nome: 'Tesoureiro' },
      },
      {
        id: 'tx-conf-exp',
        tenantId,
        type: FinancialTransactionType.EXPENSE,
        status: FinancialTransactionStatus.CONFIRMED,
        date: new Date('2026-11-05T12:00:00.000Z'),
        paidAt: new Date('2026-11-06T12:00:00.000Z'),
        createdAt: new Date('2026-11-05T12:00:00.000Z'),
        updatedAt: new Date('2026-11-06T12:00:00.000Z'),
        amount: makeDecimal(100.1),
        description: 'Limpeza',
        paymentMethod: FinancialPaymentMethod.PIX,
        counterpartyName: null,
        installmentNumber: null,
        totalInstallments: null,
        account: { id: accountId, name: 'Banco Principal', type: 'BANK' },
        category: { id: categoryId, name: 'Manutenção', type: 'EXPENSE' },
        evento: { id: 'ev-1', titulo: 'Congresso Anual', dataInicio: new Date(), dataFim: null, local: null, status: 'AGENDADO' },
        member: { id: memberId, nome: 'João Silva', email: null, whatsapp: null },
        createdBy: { id: 'user-1', nome: 'Tesoureiro' },
      },
      {
        id: 'tx-conf-inc',
        tenantId,
        type: FinancialTransactionType.INCOME,
        status: FinancialTransactionStatus.CONFIRMED,
        date: new Date('2026-11-02T12:00:00.000Z'),
        paidAt: new Date('2026-11-02T12:00:00.000Z'),
        createdAt: new Date('2026-11-02T12:00:00.000Z'),
        updatedAt: new Date('2026-11-02T12:00:00.000Z'),
        amount: makeDecimal(350.35),
        description: 'Inscrições',
        paymentMethod: FinancialPaymentMethod.PIX,
        counterpartyName: 'João',
        installmentNumber: null,
        totalInstallments: null,
        account: { id: accountId, name: 'Banco Principal', type: 'BANK' },
        category: { id: categoryId, name: 'Manutenção', type: 'EXPENSE' },
        evento: { id: 'ev-1', titulo: 'Congresso Anual', dataInicio: new Date(), dataFim: null, local: null, status: 'AGENDADO' },
        member: { id: memberId, nome: 'João Silva', email: null, whatsapp: null },
        createdBy: { id: 'user-1', nome: 'Tesoureiro' },
      },
    ]);

    const exportData = await service.prepareExportData(
      tenantId,
      {
        formato: 'pdf',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        accountId,
        categoryId,
        eventoId: 'ev-1',
        memberId,
      },
      makeUser(),
    );

    expect(exportData.organizationName).toBe('Igreja Central');
    expect(exportData.items.map((item) => item.id)).toEqual([
      'tx-conf-inc',
      'tx-conf-exp',
      'tx-pending',
      'tx-draft',
      'tx-cancel',
    ]);
    expect(exportData.totals).toEqual({
      count: 5,
      confirmedCount: 2,
      confirmedIncome: 350.35,
      confirmedExpense: 100.1,
      confirmedNet: 250.25,
      pendingCount: 1,
      pendingIncome: 0,
      pendingExpense: 150.25,
      pendingNet: -150.25,
      draftCount: 1,
      draftIncome: 400,
      draftExpense: 0,
      cancelledCount: 1,
      cancelledIncome: 0,
      cancelledExpense: 999.99,
    });
    expect(exportData.appliedFilterLabels).toEqual([
      { label: 'Conta', value: 'Banco Principal' },
      { label: 'Categoria', value: 'Manutenção' },
      { label: 'Evento', value: 'Congresso Anual' },
      { label: 'Membro', value: 'João Silva' },
    ]);
    expect(exportData.truncated).toBe(false);
    expect(exportData.totalMatchingCount).toBe(5);
    // Zero queries extras para resolver nomes dos filtros
    expect(prisma.financialAccount.findFirst).not.toHaveBeenCalled();
    expect(prisma.financialCategory.findFirst).not.toHaveBeenCalled();
    expect(prisma.evento.findFirst).not.toHaveBeenCalled();
    expect(prisma.membro.findFirst).not.toHaveBeenCalled();
  });

  it('sinaliza truncated e totalMatchingCount quando consulta excede 500 lançamentos, bloqueia RBAC (403) e lança 404 para lista vazia', async () => {
    const { service, prisma, financeAuthorization } = createService(FinanceRole.FINANCE_VIEWER);

    // 1. Truncated (> 500)
    const rows501 = Array.from({ length: 501 }, (_, i) => ({
      id: `tx-${i + 1}`,
      tenantId,
      type: FinancialTransactionType.INCOME,
      status: FinancialTransactionStatus.CONFIRMED,
      date: new Date('2026-11-01T12:00:00.000Z'),
      paidAt: new Date('2026-11-01T12:00:00.000Z'),
      createdAt: new Date(Date.UTC(2026, 10, 1, 12, 0, i)),
      updatedAt: new Date('2026-11-01T12:00:00.000Z'),
      amount: makeDecimal(10),
      description: `Lançamento ${i + 1}`,
      paymentMethod: null,
      counterpartyName: null,
      installmentNumber: null,
      totalInstallments: null,
      account: { id: accountId, name: 'Caixa', type: 'CASH' },
      category: { id: categoryId, name: 'Ofertas', type: 'INCOME' },
      evento: null,
      member: null,
      createdBy: { id: 'user-1', nome: 'Tesoureiro' },
    }));
    prisma.financialTransaction.findMany.mockResolvedValueOnce(rows501);
    prisma.financialTransaction.count.mockResolvedValueOnce(732);

    const truncatedData = await service.prepareExportData(tenantId, { formato: 'pdf' }, makeUser());
    expect(truncatedData.items).toHaveLength(500);
    expect(truncatedData.truncated).toBe(true);
    expect(truncatedData.totalMatchingCount).toBe(732);

    // 2. Lista vazia -> 404 NotFoundException
    prisma.financialTransaction.findMany.mockResolvedValueOnce([]);
    await expect(
      service.prepareExportData(tenantId, { formato: 'pdf' }, makeUser()),
    ).rejects.toThrow(NotFoundException);

    // 3. Sem permissão financeira -> 403 ForbiddenException
    financeAuthorization.ensureCanAccessFinanceData.mockRejectedValueOnce(
      new ForbiddenException('Acesso negado: permissão financeira insuficiente.'),
    );
    await expect(
      service.prepareExportData(tenantId, { formato: 'pdf' }, makeUser()),
    ).rejects.toThrow(ForbiddenException);
  });

  it('gera Signed URL privada, nunca expõe receiptUrl/receiptKey em retornos e bloqueia alterações indevidas em MEMBER_PORTAL', async () => {
    const { service, prisma, storageService, notificationDispatch } = createService(
      FinanceRole.FINANCE_APPROVER,
    );

    // 1. uploadReceipt usa storage privado e não expõe receiptUrl/receiptKey
    prisma.financialTransaction.findFirst.mockResolvedValueOnce({
      id: 'tx-treasury-1',
      tenantId,
      status: FinancialTransactionStatus.CONFIRMED,
      source: FinancialTransactionSource.TREASURY,
      receiptKey: null,
      amount: makeDecimal(100),
    });
    prisma.financialTransaction.update.mockResolvedValueOnce({
      id: 'tx-treasury-1',
      tenantId,
      status: FinancialTransactionStatus.CONFIRMED,
      source: FinancialTransactionSource.TREASURY,
      receiptUrl: null,
      receiptKey: 'tenants/t/tx/receipt.pdf',
      receiptFileName: 'recibo.pdf',
      receiptMimeType: 'application/pdf',
      amount: makeDecimal(100),
    });

    const uploaded = await service.uploadReceipt(
      tenantId,
      makeUser(),
      'tx-treasury-1',
      {
        fieldname: 'file',
        originalname: 'recibo.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 16,
        buffer: Buffer.from('%PDF-1.7\n1 0 obj'),
      } as any,
    );

    expect(storageService.uploadPrivateObject).toHaveBeenCalled();
    expect(uploaded.hasReceipt).toBe(true);
    expect((uploaded as any).receiptUrl).toBeUndefined();
    expect((uploaded as any).receiptKey).toBeUndefined();

    // 2. getReceiptSignedUrl retorna Signed URL privada de 300s
    prisma.financialTransaction.findFirst.mockResolvedValueOnce({
      id: 'tx-treasury-1',
      tenantId,
      receiptKey: 'tenants/t/tx/receipt.pdf',
      receiptFileName: 'recibo.pdf',
      receiptMimeType: 'application/pdf',
    });
    const signed = await service.getReceiptSignedUrl(tenantId, makeUser(), 'tx-treasury-1');
    expect(signed.expiresInSeconds).toBe(300);
    expect(signed.url).toContain('/object/sign/financial-receipts/');

    // 3. confirm em MEMBER_PORTAL permite ajustar accountId/categoryId e notifica o membro
    prisma.financialCategory.findFirst.mockResolvedValueOnce({
      id: 'cat-inc-2',
      tenantId,
      active: true,
      type: FinancialCategoryType.INCOME,
    });
    prisma.financialTransaction.findFirst.mockResolvedValueOnce({
      id: 'tx-member-1',
      tenantId,
      type: FinancialTransactionType.INCOME,
      status: FinancialTransactionStatus.PENDING,
      source: FinancialTransactionSource.MEMBER_PORTAL,
      memberId,
      accountId,
      categoryId,
      paidAt: null,
      paymentMethod: FinancialPaymentMethod.PIX,
      amount: makeDecimal(150),
    });
    prisma.financialTransaction.update.mockResolvedValueOnce({
      id: 'tx-member-1',
      tenantId,
      type: FinancialTransactionType.INCOME,
      status: FinancialTransactionStatus.CONFIRMED,
      source: FinancialTransactionSource.MEMBER_PORTAL,
      memberId,
      accountId,
      categoryId: 'cat-inc-2',
      paidAt: new Date('2026-11-25T12:00:00.000Z'),
      paymentMethod: FinancialPaymentMethod.PIX,
      amount: makeDecimal(150),
      category: { id: 'cat-inc-2', name: 'Ofertas', type: FinancialCategoryType.INCOME },
      receiptKey: 'tenants/t/tx-member-1/r.pdf',
      receiptUrl: null,
      receiptFileName: 'r.pdf',
      receiptMimeType: 'application/pdf',
    });

    const confirmed = await service.confirm(tenantId, makeUser(), 'tx-member-1', {
      accountId,
      categoryId: 'cat-inc-2',
      amount: 150,
    });
    expect(confirmed.status).toBe(FinancialTransactionStatus.CONFIRMED);
    expect(confirmed.hasReceipt).toBe(true);
    expect((confirmed as any).receiptKey).toBeUndefined();
    expect(notificationDispatch.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ['member-user-1'],
        urlDestino: '/minhas-contribuicoes',
        idempotencyKey: `tenant:${tenantId}:contribution:tx-member-1:confirmed`,
      }),
    );

    // 4. reject exige motivo e notifica o membro
    prisma.financialTransaction.findFirst.mockResolvedValueOnce({
      id: 'tx-member-2',
      tenantId,
      type: FinancialTransactionType.INCOME,
      status: FinancialTransactionStatus.PENDING,
      source: FinancialTransactionSource.MEMBER_PORTAL,
      memberId,
      amount: makeDecimal(80),
      rejectionReason: null,
    });
    prisma.financialTransaction.update.mockResolvedValueOnce({
      id: 'tx-member-2',
      tenantId,
      type: FinancialTransactionType.INCOME,
      status: FinancialTransactionStatus.CANCELLED,
      source: FinancialTransactionSource.MEMBER_PORTAL,
      memberId,
      amount: makeDecimal(80),
      rejectionReason: 'Comprovante ilegível',
      category: { id: categoryId, name: 'Dízimos', type: FinancialCategoryType.INCOME },
    });

    const rejected = await service.reject(tenantId, makeUser(), 'tx-member-2', {
      rejectionReason: 'Comprovante ilegível',
    });
    expect(rejected.status).toBe(FinancialTransactionStatus.CANCELLED);
    expect(rejected.rejectionReason).toBe('Comprovante ilegível');
    expect(notificationDispatch.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ['member-user-1'],
        idempotencyKey: `tenant:${tenantId}:contribution:tx-member-2:rejected`,
      }),
    );

    // 5. Bloqueia update (alterar memberId, tipo ou confirmar), cancel genérico e removeReceipt em MEMBER_PORTAL
    prisma.financialTransaction.findFirst.mockResolvedValueOnce({
      id: 'tx-member-3',
      tenantId,
      type: FinancialTransactionType.INCOME,
      status: FinancialTransactionStatus.PENDING,
      source: FinancialTransactionSource.MEMBER_PORTAL,
      memberId,
      amount: makeDecimal(50),
    });
    await expect(
      service.update(tenantId, makeUser(), 'tx-member-3', { memberId: 'other-member' }),
    ).rejects.toThrow(ForbiddenException);

    prisma.financialTransaction.findFirst.mockResolvedValueOnce({
      id: 'tx-member-3',
      tenantId,
      type: FinancialTransactionType.INCOME,
      status: FinancialTransactionStatus.PENDING,
      source: FinancialTransactionSource.MEMBER_PORTAL,
      memberId,
      amount: makeDecimal(50),
    });
    await expect(service.cancel(tenantId, makeUser(), 'tx-member-3')).rejects.toThrow(
      BadRequestException,
    );

    prisma.financialTransaction.findFirst.mockResolvedValueOnce({
      id: 'tx-member-3',
      tenantId,
      type: FinancialTransactionType.INCOME,
      status: FinancialTransactionStatus.PENDING,
      source: FinancialTransactionSource.MEMBER_PORTAL,
      memberId,
      amount: makeDecimal(50),
    });
    await expect(service.removeReceipt(tenantId, makeUser(), 'tx-member-3')).rejects.toThrow(
      BadRequestException,
    );
  });
});
