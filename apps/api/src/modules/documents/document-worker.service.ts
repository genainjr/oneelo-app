import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DocumentJobsService } from './document-jobs.service';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CarteirinhaRendererService } from './renderers/carteirinha-renderer.service';
import { StatusDocumentJob, TipoDocumento } from '@prisma/client';

export interface DocumentRenderResult {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

export interface DocumentProcessorDelegate {
  process(job: any): Promise<DocumentRenderResult>;
}

@Injectable()
export class DocumentWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DocumentWorkerService.name);
  private readonly documentsBucket = 'tenant-documents';
  private isProcessing = false;
  private isShuttingDown = false;
  private handlers = new Map<TipoDocumento, DocumentProcessorDelegate>();

  constructor(
    private readonly jobsService: DocumentJobsService,
    private readonly storageService: SupabaseStorageService,
    private readonly prisma: PrismaService,
    private readonly carteirinhaRenderer: CarteirinhaRendererService,
  ) {}

  onModuleInit() {
    this.registerCarteirinhaHandlers();
    this.logger.log('DocumentWorkerService inicializado com handlers de carteirinha.');
  }

  private registerCarteirinhaHandlers() {
    // Handler para Carteirinha Individual
    this.registerHandler(TipoDocumento.CARTEIRINHA_INDIVIDUAL, {
      process: async (job: any) => {
        const memberId = job.parametros?.memberId;
        if (!memberId) {
          throw new NotFoundException('ID do membro não informado nos parâmetros do job.');
        }

        const member = await this.prisma.client.membro.findFirst({
          where: { id: memberId, tenantId: job.tenantId },
        });

        if (!member) {
          throw new NotFoundException('Membro não encontrado para este tenant.');
        }

        return this.carteirinhaRenderer.renderSingleCard(
          member,
          job.tenant,
          job.formato,
        );
      },
    });

    // Handler para Carteirinhas em Lote
    this.registerHandler(TipoDocumento.CARTEIRINHAS_LOTE, {
      process: async (job: any) => {
        const memberIds = job.parametros?.memberIds as string[] | undefined;
        const where: any = {
          tenantId: job.tenantId,
          deletedAt: null,
          status: 'ATIVO',
        };

        if (memberIds && memberIds.length > 0) {
          where.id = { in: memberIds };
        }

        const members = await this.prisma.client.membro.findMany({
          where,
          orderBy: { nome: 'asc' },
        });

        if (members.length === 0) {
          throw new NotFoundException('Nenhum membro ativo encontrado para emissão de carteirinhas.');
        }

        return this.carteirinhaRenderer.renderBatchCardsA4(members, job.tenant);
      },
    });
  }

  onModuleDestroy() {
    this.isShuttingDown = true;
  }

  registerHandler(tipo: TipoDocumento, handler: DocumentProcessorDelegate) {
    this.handlers.set(tipo, handler);
    this.logger.log(`Handler registrado para tipo: ${tipo}`);
  }

  @Interval(4000)
  async pollAndProcess() {
    if (this.isProcessing || this.isShuttingDown) {
      return;
    }

    this.isProcessing = true;
    try {
      const job = await this.jobsService.claimNextPendingJob();
      if (!job) {
        return;
      }

      this.logger.log(
        `Processando DocumentJob id=${job.id} tipo=${job.tipoDocumento} tenant=${job.tenantId}`,
      );

      const handler = this.handlers.get(job.tipoDocumento);
      if (!handler) {
        throw new Error(
          `Nenhum processador configurado para o tipo ${job.tipoDocumento}.`,
        );
      }

      const result = await handler.process(job);

      // Envia arquivo final para o bucket do Supabase Storage
      const extension = job.formato === 'PDF' ? 'pdf' : 'png';
      const storagePath = `${job.tenantId}/${job.tipoDocumento.toLowerCase()}/${job.id}.${extension}`;

      await this.storageService.uploadPublicObject(
        this.documentsBucket,
        storagePath,
        result.buffer,
        result.mimeType,
      );

      await this.jobsService.completeJob(job.id, {
        storageKey: storagePath,
        fileName: result.fileName,
        fileSize: result.buffer.length,
      });

      this.logger.log(
        `DocumentJob id=${job.id} concluído com sucesso. StorageKey=${storagePath}`,
      );
    } catch (err: any) {
      this.logger.error(
        `Falha ao processar job: ${err?.message ?? 'Erro desconhecido'}`,
        err?.stack,
      );
    } finally {
      this.isProcessing = false;
    }
  }
}
