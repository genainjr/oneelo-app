import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DocumentJobsService } from './document-jobs.service';
import { FormatoDocumento, StatusDocumentJob, TipoDocumento } from '@prisma/client';

describe('DocumentJobsService', () => {
  let service: DocumentJobsService;
  let prismaMock: any;

  const tenantId = '11111111-1111-4111-8111-111111111111';
  const otherTenantId = '22222222-2222-4222-8222-222222222222';
  const userId = 'user-uuid-123';

  beforeEach(() => {
    prismaMock = {
      client: {
        documentJob: {
          create: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
          update: jest.fn(),
        },
      },
    };

    service = new DocumentJobsService(prismaMock as unknown as PrismaService);
  });

  describe('createJob', () => {
    it('deve lançar BadRequestException se tenantId não for fornecido', async () => {
      await expect(
        service.createJob('', userId, {
          tipoDocumento: TipoDocumento.CARTEIRINHA_INDIVIDUAL,
          formato: FormatoDocumento.PDF,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve criar um novo job PENDING quando não houver versionHash em cache', async () => {
      const createdMock = {
        id: 'job-1',
        tenantId,
        status: StatusDocumentJob.PENDING,
        tipoDocumento: TipoDocumento.CARTEIRINHA_INDIVIDUAL,
      };

      prismaMock.client.documentJob.create.mockResolvedValue(createdMock);

      const result = await service.createJob(tenantId, userId, {
        tipoDocumento: TipoDocumento.CARTEIRINHA_INDIVIDUAL,
        formato: FormatoDocumento.PDF,
        parametros: { memberId: 'member-123' },
      });

      expect(result).toEqual(createdMock);
      expect(prismaMock.client.documentJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          requestedByUserId: userId,
          tipoDocumento: TipoDocumento.CARTEIRINHA_INDIVIDUAL,
          status: StatusDocumentJob.PENDING,
        }),
      });
    });

    it('deve reaproveitar job COMPLETED quando já existir cache para o mesmo versionHash', async () => {
      const cachedMock = {
        id: 'cached-job',
        tenantId,
        tipoDocumento: TipoDocumento.ESCALA_PNG,
        versionHash: 'hash-abc',
        status: StatusDocumentJob.COMPLETED,
        storageKey: 'path/to/file.png',
      };

      prismaMock.client.documentJob.findFirst.mockResolvedValue(cachedMock);

      const result = await service.createJob(tenantId, userId, {
        tipoDocumento: TipoDocumento.ESCALA_PNG,
        formato: FormatoDocumento.PNG,
        versionHash: 'hash-abc',
      });

      expect(result).toEqual(cachedMock);
      expect(prismaMock.client.documentJob.create).not.toHaveBeenCalled();
    });

    it('deve calcular versionHash automaticamente para carteirinha individual e reaproveitar job existente se membro não teve alteração', async () => {
      const memberMock = {
        id: 'member-123',
        nome: 'Carlos Eduardo',
        cargo: 'Diácono',
        updatedAt: new Date('2026-11-01T10:00:00Z'),
        tenant: {
          nome: 'Igreja Central',
          logoUrl: 'https://logo.png',
          updatedAt: new Date('2026-10-01T10:00:00Z'),
        },
      };

      prismaMock.client.membro = {
        findFirst: jest.fn().mockResolvedValue(memberMock),
      };

      const cachedCarteirinha = {
        id: 'cached-carteirinha',
        tenantId,
        tipoDocumento: TipoDocumento.CARTEIRINHA_INDIVIDUAL,
        formato: FormatoDocumento.PDF,
        status: StatusDocumentJob.COMPLETED,
        storageKey: 'tenants/tenant-1/documents/carteirinhas/members/member-123/carteirinha.pdf',
      };

      prismaMock.client.documentJob.findFirst.mockResolvedValue(cachedCarteirinha);

      const result = await service.createJob(tenantId, userId, {
        tipoDocumento: TipoDocumento.CARTEIRINHA_INDIVIDUAL,
        formato: FormatoDocumento.PDF,
        parametros: { memberId: 'member-123' },
      });

      expect(result).toEqual(cachedCarteirinha);
      expect(prismaMock.client.documentJob.create).not.toHaveBeenCalled();
    });
  });

  describe('claimNextPendingJob', () => {
    it('deve retornar null se não houver jobs pendentes', async () => {
      prismaMock.client.documentJob.findFirst.mockResolvedValue(null);

      const result = await service.claimNextPendingJob();
      expect(result).toBeNull();
      expect(prismaMock.client.documentJob.update).not.toHaveBeenCalled();
    });

    it('deve atualizar status para PROCESSING e incrementar tentativas ao reivindicar job', async () => {
      const candidate = { id: 'pending-job', status: StatusDocumentJob.PENDING, tentativas: 0 };
      const claimed = { ...candidate, status: StatusDocumentJob.PROCESSING, tentativas: 1 };

      prismaMock.client.documentJob.findFirst.mockResolvedValue(candidate);
      prismaMock.client.documentJob.update.mockResolvedValue(claimed);

      const result = await service.claimNextPendingJob();
      expect(result).toEqual(claimed);
      expect(prismaMock.client.documentJob.update).toHaveBeenCalledWith({
        where: { id: candidate.id },
        data: {
          status: StatusDocumentJob.PROCESSING,
          tentativas: { increment: 1 },
        },
        include: { tenant: true },
      });
    });
  });

  describe('completeJob e failJob', () => {
    it('deve marcar job como COMPLETED com os dados do arquivo gerado', async () => {
      prismaMock.client.documentJob.update.mockResolvedValue({ id: 'job-1', status: StatusDocumentJob.COMPLETED });

      await service.completeJob('job-1', {
        storageKey: 'tenant/1.pdf',
        fileName: 'carteirinha.pdf',
        fileSize: 1024,
      });

      expect(prismaMock.client.documentJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: StatusDocumentJob.COMPLETED,
          storageKey: 'tenant/1.pdf',
          fileName: 'carteirinha.pdf',
          fileSize: 1024,
        }),
      });
    });

    it('deve marcar job como FAILED e gravar mensagem de erro', async () => {
      prismaMock.client.documentJob.update.mockResolvedValue({ id: 'job-1', status: StatusDocumentJob.FAILED });

      await service.failJob('job-1', 'Timeout de renderização');

      expect(prismaMock.client.documentJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: {
          status: StatusDocumentJob.FAILED,
          erroMensagem: 'Timeout de renderização',
        },
      });
    });
  });

  describe('getJobById e isolamento multitenant', () => {
    it('deve lançar NotFoundException se o job pertencer a outro tenant', async () => {
      prismaMock.client.documentJob.findFirst.mockResolvedValue(null);

      await expect(service.getJobById(otherTenantId, 'job-of-tenant-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve retornar o job quando o tenantId coincidir', async () => {
      const jobMock = { id: 'job-1', tenantId, status: StatusDocumentJob.COMPLETED };
      prismaMock.client.documentJob.findFirst.mockResolvedValue(jobMock);

      const result = await service.getJobById(tenantId, 'job-1');
      expect(result).toEqual(jobMock);
    });
  });

  describe('listJobs e retenção do último documento válido', () => {
    it('deve desduplicar e retornar apenas a última versão de cada carteirinha por membro e formato', async () => {
      const allJobsMock = [
        {
          id: 'job-latest-pdf',
          tenantId,
          tipoDocumento: TipoDocumento.CARTEIRINHA_INDIVIDUAL,
          formato: FormatoDocumento.PDF,
          parametros: { memberId: 'member-1' },
          createdAt: new Date('2026-11-10T02:00:00Z'),
        },
        {
          id: 'job-old-pdf',
          tenantId,
          tipoDocumento: TipoDocumento.CARTEIRINHA_INDIVIDUAL,
          formato: FormatoDocumento.PDF,
          parametros: { memberId: 'member-1' },
          createdAt: new Date('2026-11-10T01:00:00Z'),
        },
        {
          id: 'job-png',
          tenantId,
          tipoDocumento: TipoDocumento.CARTEIRINHA_INDIVIDUAL,
          formato: FormatoDocumento.PNG,
          parametros: { memberId: 'member-1' },
          createdAt: new Date('2026-11-10T01:30:00Z'),
        },
      ];

      prismaMock.client.documentJob.findMany.mockResolvedValue(allJobsMock);

      const result = await service.listJobs(tenantId, {});
      expect(result.items).toHaveLength(2);
      expect(result.items.map((i: any) => i.id)).toEqual(['job-latest-pdf', 'job-png']);
      expect(result.total).toBe(2);
    });
  });
});
