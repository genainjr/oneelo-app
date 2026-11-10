import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  FormatoDocumento,
  StatusDocumentJob,
  TipoDocumento,
} from '@prisma/client';
import { CreateDocumentJobDto } from './dto/create-document-job.dto';
import { FilterDocumentJobsDto } from './dto/filter-document-jobs.dto';

@Injectable()
export class DocumentJobsService {
  constructor(private readonly prisma: PrismaService) {}

  async createJob(
    tenantId: string,
    requestedByUserId: string | null,
    dto: CreateDocumentJobDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('tenantId é obrigatório para criar um job.');
    }

    // Se houver versionHash e já existir um job CONCLUÍDO com esse hash e tipo, reaproveita
    if (dto.versionHash) {
      const existing = await this.findExistingCompletedJob(
        tenantId,
        dto.tipoDocumento,
        dto.versionHash,
      );
      if (existing) {
        return existing;
      }
    }

    return this.prisma.client.documentJob.create({
      data: {
        tenantId,
        requestedByUserId,
        tipoDocumento: dto.tipoDocumento,
        formato: dto.formato,
        parametros: dto.parametros ?? {},
        versionHash: dto.versionHash ?? null,
        status: StatusDocumentJob.PENDING,
      },
    });
  }

  async findExistingCompletedJob(
    tenantId: string,
    tipoDocumento: TipoDocumento,
    versionHash: string,
  ) {
    return this.prisma.client.documentJob.findFirst({
      where: {
        tenantId,
        tipoDocumento,
        versionHash,
        status: StatusDocumentJob.COMPLETED,
        storageKey: { not: null },
      },
      orderBy: { completedAt: 'desc' },
    });
  }

  async getJobById(tenantId: string, jobId: string) {
    const job = await this.prisma.client.documentJob.findFirst({
      where: { id: jobId, tenantId },
      include: {
        requestedByUser: {
          select: { id: true, nome: true, email: true },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Documento ou job não encontrado.');
    }

    return job;
  }

  async listJobs(tenantId: string, query: FilterDocumentJobsDto) {
    const limit = Math.min(Math.max(parseInt(query.limit ?? '20', 10), 1), 100);
    const offset = Math.max(parseInt(query.offset ?? '0', 10), 0);

    const where: any = { tenantId };
    if (query.status) {
      where.status = query.status;
    }
    if (query.tipoDocumento) {
      where.tipoDocumento = query.tipoDocumento;
    }

    const [items, total] = await Promise.all([
      this.prisma.client.documentJob.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          requestedByUser: {
            select: { id: true, nome: true, email: true },
          },
        },
      }),
      this.prisma.client.documentJob.count({ where }),
    ]);

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  async claimNextPendingJob() {
    // Busca o job pendente mais antigo com menos de 3 tentativas
    const candidate = await this.prisma.client.documentJob.findFirst({
      where: {
        status: StatusDocumentJob.PENDING,
        tentativas: { lt: 3 },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!candidate) {
      return null;
    }

    // Trava atômica atualizando para PROCESSING
    return this.prisma.client.documentJob.update({
      where: { id: candidate.id },
      data: {
        status: StatusDocumentJob.PROCESSING,
        tentativas: { increment: 1 },
      },
      include: {
        tenant: true,
      },
    });
  }

  async completeJob(
    jobId: string,
    data: {
      storageKey: string;
      fileName: string;
      fileSize?: number;
    },
  ) {
    return this.prisma.client.documentJob.update({
      where: { id: jobId },
      data: {
        status: StatusDocumentJob.COMPLETED,
        storageKey: data.storageKey,
        fileName: data.fileName,
        fileSize: data.fileSize ?? null,
        completedAt: new Date(),
        erroMensagem: null,
      },
    });
  }

  async failJob(jobId: string, errorMessage: string) {
    return this.prisma.client.documentJob.update({
      where: { id: jobId },
      data: {
        status: StatusDocumentJob.FAILED,
        erroMensagem: errorMessage.slice(0, 1000),
      },
    });
  }

  async retryJob(tenantId: string, jobId: string) {
    const job = await this.getJobById(tenantId, jobId);

    return this.prisma.client.documentJob.update({
      where: { id: job.id },
      data: {
        status: StatusDocumentJob.PENDING,
        tentativas: 0,
        erroMensagem: null,
      },
    });
  }
}
