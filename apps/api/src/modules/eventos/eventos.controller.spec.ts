import { Test, TestingModule } from '@nestjs/testing';
import { EventosController } from './eventos.controller';
import { EventosService } from './eventos.service';
import { ExportServiceUnavailableException } from '../../common/export';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';

describe('EventosController', () => {
  let controller: EventosController;
  let eventosService: jest.Mocked<EventosService>;

  beforeEach(async () => {
    const mockEventosService = {
      create: jest.fn(),
      createBatch: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      exportar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventosController],
      providers: [
        {
          provide: EventosService,
          useValue: mockEventosService,
        },
      ],
    }).compile();

    controller = module.get<EventosController>(EventosController);
    eventosService = module.get(EventosService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockReq = {
    tenantId: 'tenant-123',
    user: {
      userId: 'user-1',
      tenantId: 'tenant-123',
      role: Role.ADMIN,
      email: 'admin@oneelo.test',
    },
    headers: {},
  } as unknown as Request;

  const createMockRes = () => {
    const res: any = {
      setHeader: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    return res as Response;
  };

  it('retorna 304 Not Modified quando o renderizador sinaliza notModified', async () => {
    eventosService.exportar.mockResolvedValue({
      kind: 'not-modified',
      etag: '"abc123etag"',
      pageCount: 2,
      notModified: true,
    });

    const res = createMockRes();
    await controller.exportar({ formato: 'pdf' }, mockReq, res);

    expect(res.setHeader).toHaveBeenCalledWith('X-Document-Page-Count', '2');
    expect(res.setHeader).toHaveBeenCalledWith('ETag', '"abc123etag"');
    expect(res.status).toHaveBeenCalledWith(304);
    expect(res.end).toHaveBeenCalled();
  });

  it('retorna json quando a exportacao for em lote (batch)', async () => {
    eventosService.exportar.mockResolvedValue({
      kind: 'batch',
      files: [
        {
          fileName: 'agenda-semana-01.png',
          mimeType: 'image/png',
          base64: 'abc',
        },
      ],
      pageCount: 1,
      etag: '"etag-batch"',
    });

    const res = createMockRes();
    await controller.exportar({ formato: 'png', pagina: 'todas' }, mockReq, res);

    expect(res.setHeader).toHaveBeenCalledWith('X-Document-Page-Count', '1');
    expect(res.setHeader).toHaveBeenCalledWith('ETag', '"etag-batch"');
    expect(res.json).toHaveBeenCalledWith({
      files: [
        {
          fileName: 'agenda-semana-01.png',
          mimeType: 'image/png',
          base64: 'abc',
        },
      ],
      pageCount: 1,
    });
  });

  it('retorna buffer com headers de anexo para exportacao de arquivo unico', async () => {
    const buffer = Buffer.from('pdf-content');
    eventosService.exportar.mockResolvedValue({
      kind: 'single',
      buffer,
      mimeType: 'application/pdf',
      fileName: 'agenda-eventos.pdf',
      pageCount: 1,
      etag: '"etag-pdf"',
    });

    const res = createMockRes();
    await controller.exportar({ formato: 'pdf' }, mockReq, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="agenda-eventos.pdf"',
    );
    expect(res.send).toHaveBeenCalledWith(buffer);
  });

  it('adiciona Retry-After no header se receber ExportServiceUnavailableException', async () => {
    eventosService.exportar.mockRejectedValue(
      new ExportServiceUnavailableException('Fila cheia', 5),
    );

    const res = createMockRes();
    await expect(
      controller.exportar({ formato: 'pdf' }, mockReq, res),
    ).rejects.toBeInstanceOf(ExportServiceUnavailableException);

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '5');
  });
});
