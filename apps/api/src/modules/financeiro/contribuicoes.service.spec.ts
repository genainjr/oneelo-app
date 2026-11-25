import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AcaoAuditoria,
  FinanceRole,
  FinancialCategoryType,
  FinancialPaymentMethod,
  FinancialTransactionSource,
  FinancialTransactionStatus,
  FinancialTransactionType,
  PixKeyType,
  Role,
  StatusMembro,
} from '@prisma/client';
import type { Multer } from 'multer';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { ContribuicoesService } from './contribuicoes.service';
import { FinanceAuthorizationService } from './finance-authorization.service';
import { FinancialAccountsService } from './financial-accounts.service';
import { FinancialCategoriesService } from './financial-categories.service';
import { TenantPixConfigService } from './tenant-pix-config.service';

describe('FT-021 ContribuicoesService, TenantPixConfigService e proteções de Conta/Categoria', () => {
  const tenantId = 'tenant-1';
  const memberId = 'member-1';
  const accountId = 'acc-pix-1';
  const categoryId = 'cat-dizimo-1';

  const makeMemberUser = (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
    sub: 'user-member-1',
    email: 'membro@igreja.org',
    role: Role.BASIC,
    tenantId,
    memberId,
    ...overrides,
  });

  const makePdfFile = (): Multer.File =>
    ({
      fieldname: 'file',
      originalname: 'comprovante-pix.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 128,
      buffer: Buffer.from('%PDF-1.7\n1 0 obj\nendobj'),
    }) as Multer.File;

  const makeDecimal = (value: number) => ({ toNumber: () => value });

  const createContribuicoesSetup = () => {
    const prisma = {
      membro: {
        findFirst: jest.fn().mockResolvedValue({
          id: memberId,
          nome: 'Maria Oliveira',
          nomeExibicao: 'Maria',
          status: StatusMembro.ATIVO,
        }),
      },
      tenantPixConfig: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pix-1',
          tenantId,
          enabled: true,
          showOnPublicSite: false,
          pixKeyType: PixKeyType.CNPJ,
          pixKey: '11222333000181',
          merchantName: 'Igreja Central',
          merchantCity: 'Sao Paulo',
          txidPrefix: null,
          defaultAccountId: accountId,
          defaultAccount: { id: accountId, active: true },
        }),
      },
      financialCategory: {
        findMany: jest.fn().mockResolvedValue([{ id: categoryId, name: 'Dízimos' }]),
        findFirst: jest.fn().mockResolvedValue({ id: categoryId, name: 'Dízimos' }),
      },
      financialTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: data.id,
          status: data.status,
          source: data.source,
          date: data.date,
          paidAt: data.paidAt,
          amount: makeDecimal(Number(data.amount)),
          description: data.description,
          paymentMethod: data.paymentMethod,
          payerName: data.payerName,
          rejectionReason: null,
          receiptFileName: data.receiptFileName,
          receiptMimeType: data.receiptMimeType,
          createdAt: new Date('2026-11-25T12:00:00.000Z'),
          category: { id: categoryId, name: 'Dízimos' },
        })),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      financePermission: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'treasurer-1' },
          { userId: 'user-member-1' }, // mesmo autor — deve ser excluído
        ]),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    const storageService = {
      uploadPrivateObject: jest.fn().mockImplementation(async (_b, p) => p),
      createPrivateSignedUrl: jest
        .fn()
        .mockResolvedValue('https://demo.supabase.co/storage/v1/object/sign/financial-receipts/x?token=ok'),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };

    const notificationDispatch = {
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    return {
      service: new ContribuicoesService(
        prisma as unknown as PrismaService,
        storageService as unknown as SupabaseStorageService,
        notificationDispatch as any,
      ),
      prisma,
      storageService,
      notificationDispatch,
    };
  };

  it('bloqueia acesso se usuário não tiver memberId ou membro estiver inativo no POST', async () => {
    const { service, prisma } = createContribuicoesSetup();

    await expect(
      service.getMemberPixInfo(tenantId, makeMemberUser({ memberId: undefined })),
    ).rejects.toThrow(ForbiddenException);

    prisma.membro.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.createMyContribution(
        tenantId,
        makeMemberUser(),
        { categoryId, amount: 100, date: '2026-11-25' },
        makePdfFile(),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('retorna histórico anual privado filtrando TREASURY apenas CONFIRMED e funcionando em modo leitura com PIX desativado', async () => {
    const { service, prisma } = createContribuicoesSetup();
    prisma.financialTransaction.findMany
      .mockResolvedValueOnce([
        {
          id: 'tx-portal-pending',
          status: FinancialTransactionStatus.PENDING,
          source: FinancialTransactionSource.MEMBER_PORTAL,
          date: new Date('2026-11-20T12:00:00.000Z'),
          paidAt: null,
          amount: makeDecimal(150),
          description: 'Dízimo nov',
          paymentMethod: FinancialPaymentMethod.PIX,
          payerName: 'Carlos Oliveira',
          rejectionReason: null,
          receiptKey: 'tenants/tenant-1/financeiro/transactions/tx-portal-pending/r.pdf',
          receiptUrl: null,
          receiptFileName: 'r.pdf',
          receiptMimeType: 'application/pdf',
          createdAt: new Date('2026-11-20T12:00:00.000Z'),
          category: { id: categoryId, name: 'Dízimos' },
        },
        {
          id: 'tx-treasury-confirmed',
          status: FinancialTransactionStatus.CONFIRMED,
          source: FinancialTransactionSource.TREASURY,
          date: new Date('2026-10-10T12:00:00.000Z'),
          paidAt: new Date('2026-10-10T12:00:00.000Z'),
          amount: makeDecimal(200.5),
          description: 'Envelope culto',
          paymentMethod: FinancialPaymentMethod.CASH,
          payerName: null,
          rejectionReason: null,
          receiptKey: null,
          receiptUrl: null,
          receiptFileName: null,
          receiptMimeType: null,
          createdAt: new Date('2026-10-10T12:00:00.000Z'),
          category: { id: categoryId, name: 'Dízimos' },
        },
      ])
      .mockResolvedValueOnce([
        { date: new Date('2026-11-20T12:00:00.000Z') },
        { date: new Date('2025-05-01T12:00:00.000Z') },
      ]);

    const result = await service.listMyContributions(tenantId, makeMemberUser(), '2026');

    expect(prisma.financialTransaction.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
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
        }),
      }),
    );

    expect(result.summary).toEqual({
      confirmedTotal: 200.5,
      confirmedCount: 1,
      pendingCount: 1,
      rejectedCount: 0,
    });
    expect(result.availableYears).toEqual([2026, 2025]);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'tx-portal-pending',
        hasReceipt: true,
        canDelete: true,
        payerName: 'Carlos Oliveira',
      }),
    );
    expect((result.items[0] as any).receiptKey).toBeUndefined();
    expect((result.items[0] as any).receiptUrl).toBeUndefined();
    expect(result.items[1].canDelete).toBe(false);
  });

  it('cria contribuição privada no bucket privado, audita e notifica tesouraria sem auto-notificar o autor', async () => {
    const { service, prisma, storageService, notificationDispatch } = createContribuicoesSetup();

    const created = await service.createMyContribution(
      tenantId,
      makeMemberUser(),
      {
        categoryId,
        amount: 250.75,
        date: '2026-11-25',
        payerName: 'José Oliveira',
        description: 'Dízimo mensal',
      },
      makePdfFile(),
      '10.0.0.5',
    );

    expect(storageService.uploadPrivateObject).toHaveBeenCalledWith(
      'financial-receipts',
      expect.stringContaining(`tenants/${tenantId}/financeiro/transactions/`),
      expect.any(Buffer),
      'application/pdf',
    );
    expect(prisma.financialTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: FinancialTransactionSource.MEMBER_PORTAL,
          status: FinancialTransactionStatus.PENDING,
          type: FinancialTransactionType.INCOME,
          paymentMethod: FinancialPaymentMethod.PIX,
          receiptUrl: null,
          payerName: 'José Oliveira',
          counterpartyName: 'José Oliveira',
        }),
      }),
    );
    expect(created.hasReceipt).toBe(true);
    expect(created.canDelete).toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ acao: AcaoAuditoria.CRIAR }),
      }),
    );
    expect(notificationDispatch.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ['treasurer-1'],
        urlDestino: '/financeiro?source=MEMBER_PORTAL&status=PENDING',
        idempotencyKey: `tenant:${tenantId}:contribution:${created.id}:submitted`,
      }),
    );
  });

  it('remove arquivo privado do storage em caso de falha ao gravar transação no banco', async () => {
    const { service, prisma, storageService } = createContribuicoesSetup();
    prisma.financialTransaction.create.mockRejectedValueOnce(new Error('DB down'));

    await expect(
      service.createMyContribution(
        tenantId,
        makeMemberUser(),
        { categoryId, amount: 50, date: '2026-11-25' },
        makePdfFile(),
      ),
    ).rejects.toThrow('DB down');

    expect(storageService.deleteObject).toHaveBeenCalledWith(
      'financial-receipts',
      expect.any(String),
      { ignoreNotFound: true },
    );
  });

  it('permite excluir apenas envio próprio PENDING e isola Signed URL por memberId/tenantId', async () => {
    const { service, prisma, storageService } = createContribuicoesSetup();

    prisma.financialTransaction.findFirst.mockResolvedValueOnce({
      id: 'tx-1',
      source: FinancialTransactionSource.MEMBER_PORTAL,
      status: FinancialTransactionStatus.CONFIRMED,
      receiptKey: 'key-1',
      amount: makeDecimal(100),
    });
    await expect(
      service.deleteMyPendingContribution(tenantId, makeMemberUser(), 'tx-1'),
    ).rejects.toThrow(BadRequestException);

    prisma.financialTransaction.findFirst.mockResolvedValueOnce({
      id: 'tx-2',
      source: FinancialTransactionSource.MEMBER_PORTAL,
      status: FinancialTransactionStatus.PENDING,
      receiptKey: 'key-2',
      amount: makeDecimal(100),
    });
    const deleted = await service.deleteMyPendingContribution(tenantId, makeMemberUser(), 'tx-2');
    expect(deleted).toEqual({ deleted: true, id: 'tx-2' });
    expect(storageService.deleteObject).toHaveBeenCalledWith('financial-receipts', 'key-2', {
      ignoreNotFound: true,
    });

    // Outro membro tentando ver comprovante -> NotFoundException
    prisma.financialTransaction.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.getMyReceiptSignedUrl(tenantId, makeMemberUser({ memberId: 'member-other' }), 'tx-2'),
    ).rejects.toThrow(NotFoundException);
  });

  it('bloqueia inativação de conta vinculada ao PIX ativo tanto via PATCH quanto DELETE', async () => {
    const prisma = {
      financialAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: accountId, tenantId, active: true }),
        update: jest.fn(),
      },
      tenantPixConfig: {
        findFirst: jest.fn().mockResolvedValue({ id: 'pix-1' }),
      },
    };
    const auth = { ensureFinanceManager: jest.fn().mockResolvedValue({ role: FinanceRole.FINANCE_MANAGER }) };
    const accountsService = new FinancialAccountsService(
      prisma as unknown as PrismaService,
      auth as unknown as FinanceAuthorizationService,
    );

    await expect(
      accountsService.update(tenantId, makeMemberUser(), accountId, { active: false }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      accountsService.deactivate(tenantId, makeMemberUser(), accountId),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.financialAccount.update).not.toHaveBeenCalled();
  });

  it('restringe visibleToMembers a categorias INCOME e reseta para false ao mudar para EXPENSE', async () => {
    const prisma = {
      financialCategory: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn().mockImplementation(async ({ data }) => ({ id: categoryId, ...data })),
      },
    };
    const auth = { ensureFinanceManager: jest.fn().mockResolvedValue({ role: FinanceRole.FINANCE_MANAGER }) };
    const categoriesService = new FinancialCategoriesService(
      prisma as unknown as PrismaService,
      auth as unknown as FinanceAuthorizationService,
    );

    await expect(
      categoriesService.create(tenantId, makeMemberUser(), {
        name: 'Energia',
        type: FinancialCategoryType.EXPENSE,
        visibleToMembers: true,
      }),
    ).rejects.toThrow(BadRequestException);

    prisma.financialCategory.findFirst
      .mockResolvedValueOnce({
        id: categoryId,
        tenantId,
        name: 'Dízimos',
        type: FinancialCategoryType.INCOME,
        visibleToMembers: true,
      })
      .mockResolvedValueOnce(null);

    await categoriesService.update(tenantId, makeMemberUser(), categoryId, {
      type: FinancialCategoryType.EXPENSE,
    });
    expect(prisma.financialCategory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ visibleToMembers: false }),
      }),
    );
  });

  it('salva TenantPixConfig validando chave e conta ativa e grava AuditLog', async () => {
    const savedConfig = {
      id: 'pix-cfg-1',
      tenantId,
      enabled: true,
      showOnPublicSite: true,
      pixKeyType: PixKeyType.EMAIL,
      pixKey: 'pix@igreja.org',
      merchantName: 'Igreja Central',
      merchantCity: 'Sao Paulo',
      txidPrefix: 'DIZIMO',
      defaultAccountId: accountId,
      defaultAccount: { id: accountId, name: 'Conta PIX', type: 'PIX', active: true },
    };
    const prisma = {
      financialAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: accountId, name: 'Conta PIX', active: true }),
      },
      tenantPixConfig: {
        findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(savedConfig),
        upsert: jest.fn().mockResolvedValue(savedConfig),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ nome: 'Igreja Central', slug: 'igreja-central' }),
      },
      tenantWebsiteConfig: {
        findUnique: jest.fn().mockResolvedValue({ cidade: 'São Paulo' }),
      },
      financialCategory: {
        count: jest.fn().mockResolvedValue(2),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-pix-1' }),
      },
    };
    const auth = {
      ensureCanAccessFinanceData: jest.fn().mockResolvedValue({ role: FinanceRole.FINANCE_VIEWER }),
      ensureFinanceManager: jest.fn().mockResolvedValue({ role: FinanceRole.FINANCE_MANAGER }),
    };
    const pixService = new TenantPixConfigService(
      prisma as unknown as PrismaService,
      auth as unknown as FinanceAuthorizationService,
    );

    const res = await pixService.upsertConfig(
      tenantId,
      makeMemberUser(),
      {
        enabled: true,
        showOnPublicSite: true,
        pixKeyType: PixKeyType.EMAIL,
        pixKey: 'PIX@Igreja.ORG',
        merchantName: 'Igreja Central',
        merchantCity: 'São Paulo',
        txidPrefix: 'DIZIMO',
        defaultAccountId: accountId,
      },
      '127.0.0.1',
    );

    expect(res.config?.pixKey).toBe('pix@igreja.org');
    expect(res.brCode).toContain('br.gov.bcb.pix');
    expect(res.visibleIncomeCategoriesCount).toBe(2);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entidade: 'tenant_pix_config',
          acao: AcaoAuditoria.CRIAR,
        }),
      }),
    );
  });
});
