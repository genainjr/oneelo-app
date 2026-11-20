import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { ExportServiceUnavailableException } from '../../common/export';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { FinanceiroDocumentRendererService } from './export/financeiro-document-renderer.service';
import { FinancialAccountsService } from './financial-accounts.service';
import { FinancialCategoriesService } from './financial-categories.service';
import { FinancialTransactionsService } from './financial-transactions.service';
import { FinanceiroController } from './financeiro.controller';
import { FinanceiroService } from './financeiro.service';

describe('FinanceiroController - Exportação PDF', () => {
  let controller: FinanceiroController;
  let transactionsService: jest.Mocked<FinancialTransactionsService>;
  let documentRenderer: jest.Mocked<FinanceiroDocumentRendererService>;

  const mockUser: JwtPayload = {
    sub: 'user-basic-treasurer',
    email: 'tesoureiro@igreja.com',
    role: Role.BASIC,
    tenantId: 'tenant-123',
  };

  const createMockReq = (headers: Record<string, string> = {}) =>
    ({ headers }) as unknown as Request;

  const createMockRes = () => {
    const res: any = {
      setHeader: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    return res as Response;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinanceiroController],
      providers: [
        { provide: FinanceiroService, useValue: {} },
        { provide: FinancialAccountsService, useValue: {} },
        { provide: FinancialCategoriesService, useValue: {} },
        {
          provide: FinancialTransactionsService,
          useValue: {
            prepareExportData: jest.fn().mockResolvedValue({
              tenantId: 'tenant-123',
              organizationName: 'Igreja Central',
              items: [],
            }),
          },
        },
        {
          provide: FinanceiroDocumentRendererService,
          useValue: {
            renderPdf: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(FinanceiroController);
    transactionsService = module.get(FinancialTransactionsService);
    documentRenderer = module.get(FinanceiroDocumentRendererService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('retorna buffer PDF com headers de anexo, ETag, Cache-Control private e X-Document-Page-Count', async () => {
    const buffer = Buffer.from('%PDF-1.4 mock');
    documentRenderer.renderPdf.mockResolvedValue({
      kind: 'single',
      buffer,
      mimeType: 'application/pdf',
      fileName: 'extrato-financeiro-2026-11.pdf',
      pageCount: 3,
      etag: '"etag-fin-1"',
    });

    const res = createMockRes();
    await controller.exportPdf({ formato: 'pdf' }, mockUser, createMockReq(), res);

    expect(transactionsService.prepareExportData).toHaveBeenCalledWith(
      'tenant-123',
      { formato: 'pdf' },
      mockUser,
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Document-Page-Count', '3');
    expect(res.setHeader).toHaveBeenCalledWith('ETag', '"etag-fin-1"');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, max-age=0, must-revalidate',
    );
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="extrato-financeiro-2026-11.pdf"',
    );
    expect(res.send).toHaveBeenCalledWith(buffer);
  });

  it('retorna 304 Not Modified quando If-None-Match coincide com o ETag', async () => {
    documentRenderer.renderPdf.mockResolvedValue({
      kind: 'not-modified',
      etag: '"etag-fin-1"',
      pageCount: 2,
      notModified: true,
    });

    const res = createMockRes();
    await controller.exportPdf(
      { formato: 'pdf' },
      mockUser,
      createMockReq({ 'if-none-match': '"etag-fin-1"' }),
      res,
    );

    expect(documentRenderer.renderPdf).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ifNoneMatch: '"etag-fin-1"' }),
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Document-Page-Count', '2');
    expect(res.setHeader).toHaveBeenCalledWith('ETag', '"etag-fin-1"');
    expect(res.status).toHaveBeenCalledWith(304);
    expect(res.end).toHaveBeenCalled();
  });

  it('envia header Retry-After quando recebe ExportServiceUnavailableException (503)', async () => {
    documentRenderer.renderPdf.mockRejectedValue(
      new ExportServiceUnavailableException('Fila cheia', 5),
    );

    const res = createMockRes();
    await expect(
      controller.exportPdf({ formato: 'pdf' }, mockUser, createMockReq(), res),
    ).rejects.toBeInstanceOf(ExportServiceUnavailableException);

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '5');
  });
});
