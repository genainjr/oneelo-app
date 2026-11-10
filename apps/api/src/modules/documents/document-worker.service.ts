import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DocumentJobsService } from './document-jobs.service';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CarteirinhaRendererService } from './renderers/carteirinha-renderer.service';
import {
  NotificationAudienceType,
  NotificationOrigin,
  StatusDocumentJob,
  TipoDocumento,
} from '@prisma/client';
import { NotificationDispatchService } from '../notifications/services/notification-dispatch.service';

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
    @Optional()
    private readonly notificationDispatch?: NotificationDispatchService,
  ) {}

  async onModuleInit() {
    this.registerCarteirinhaHandlers();
    this.logger.log('DocumentWorkerService inicializado com handlers de carteirinha.');
    await this.recoverStuckJobs();
  }

  private async recoverStuckJobs() {
    try {
      // 1. Corrige jobs que já têm storageKey mas ficaram presos em PROCESSING
      const healed = await this.prisma.client.documentJob.updateMany({
        where: {
          status: StatusDocumentJob.PROCESSING,
          storageKey: { not: null },
        },
        data: {
          status: StatusDocumentJob.COMPLETED,
          completedAt: new Date(),
        },
      });
      if (healed.count > 0) {
        this.logger.log(`Auto-heal: ${healed.count} jobs com storageKey recuperados para COMPLETED.`);
      }

      // 2. Destrava jobs presos em PROCESSING há mais de 5 minutos sem storageKey (ex: após OOM crash ou reinício do container)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const stuckJobs = await this.prisma.client.documentJob.findMany({
        where: {
          status: StatusDocumentJob.PROCESSING,
          updatedAt: { lt: fiveMinutesAgo },
        },
      });

      for (const stuck of stuckJobs) {
        if (stuck.tentativas < 3) {
          await this.prisma.client.documentJob.update({
            where: { id: stuck.id },
            data: { status: StatusDocumentJob.PENDING },
          });
          this.logger.warn(`Job ${stuck.id} destravado e retornado para PENDING para retry.`);
        } else {
          await this.prisma.client.documentJob.update({
            where: { id: stuck.id },
            data: {
              status: StatusDocumentJob.FAILED,
              erroMensagem: 'Processamento interrompido inesperadamente (tempo limite excedido).',
            },
          });
          this.logger.warn(`Job ${stuck.id} excedeu tentativas e foi marcado como FAILED.`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Falha na rotina de recuperação de jobs presos: ${err?.message}`);
    }
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
          job.parametros?.validationUrl,
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
    let currentJob: any = null;
    try {
      const allowedTypes = Array.from(this.handlers.keys());
      const job = await this.jobsService.claimNextPendingJob(allowedTypes);
      if (!job) {
        return;
      }
      currentJob = job;

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

      // Envia arquivo final para o bucket do Supabase Storage seguindo o padrão oficial tenants/${tenantId}/...
      const extension = job.formato === 'PDF' ? 'pdf' : 'png';
      const memberId = (job.parametros as any)?.memberId;

      let storagePath: string;
      if (job.tipoDocumento === 'CARTEIRINHA_INDIVIDUAL' && memberId) {
        // Limpa carteirinhas anteriores do mesmo membro e formato para não acumular sujeira no storage
        try {
          const previousJobs = await this.prisma.client.documentJob.findMany({
            where: {
              tenantId: job.tenantId,
              tipoDocumento: job.tipoDocumento,
              formato: job.formato,
              id: { not: job.id },
              storageKey: { not: null },
            },
            select: { id: true, storageKey: true, parametros: true },
          });

          const obsoleteJobIds: string[] = [];
          for (const prev of previousJobs) {
            const prevMemberId = (prev.parametros as any)?.memberId;
            if (prevMemberId === memberId) {
              obsoleteJobIds.push(prev.id);
              if (prev.storageKey) {
                await this.storageService
                  .deleteObject(this.documentsBucket, prev.storageKey)
                  .catch(() => undefined);
              }
            }
          }

          if (obsoleteJobIds.length > 0) {
            await this.prisma.client.documentJob.deleteMany({
              where: { id: { in: obsoleteJobIds } },
            });
          }
        } catch {
          // Não impede a gravação do novo arquivo se a limpeza falhar
        }

        storagePath = `tenants/${job.tenantId}/documents/member-cards/members/${memberId}/card-${Date.now()}.${extension}`;
      } else if (job.tipoDocumento === 'CARTEIRINHAS_LOTE') {
        // Limpa lotes anteriores para não acumular arquivos órfãos
        try {
          const previousBatches = await this.prisma.client.documentJob.findMany({
            where: {
              tenantId: job.tenantId,
              tipoDocumento: job.tipoDocumento,
              id: { not: job.id },
              storageKey: { not: null },
            },
            select: { id: true, storageKey: true },
          });

          for (const prev of previousBatches) {
            if (prev.storageKey) {
              await this.storageService
                .deleteObject(this.documentsBucket, prev.storageKey)
                .catch(() => undefined);
            }
          }

          if (previousBatches.length > 0) {
            await this.prisma.client.documentJob.deleteMany({
              where: { id: { in: previousBatches.map((b) => b.id) } },
            });
          }
        } catch {
          // Ignora se a limpeza falhar
        }

        storagePath = `tenants/${job.tenantId}/documents/member-cards/batches/batch-${job.id.slice(0, 8)}-${Date.now()}.${extension}`;
      } else if (job.tipoDocumento === 'ESCALA_PDF' || job.tipoDocumento === 'ESCALA_PNG') {
        storagePath = `tenants/${job.tenantId}/documents/schedules/schedule-${job.id.slice(0, 8)}-${Date.now()}.${extension}`;
      } else if (job.tipoDocumento === 'AGENDA_PDF' || job.tipoDocumento === 'AGENDA_PNG') {
        storagePath = `tenants/${job.tenantId}/documents/events/event-${job.id.slice(0, 8)}-${Date.now()}.${extension}`;
      } else {
        storagePath = `tenants/${job.tenantId}/documents/reports/report-${job.id.slice(0, 8)}-${Date.now()}.${extension}`;
      }

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

      // Notificação in-app e web push para o usuário solicitante
      if (job.requestedByUserId && this.notificationDispatch) {
        const isLote = job.tipoDocumento === TipoDocumento.CARTEIRINHAS_LOTE;
        const titulo = '📄 Documento pronto para download';
        const mensagem = isLote
          ? 'As carteirinhas em lote foram geradas com sucesso. Clique para acessar a Central de Documentos.'
          : 'Sua carteirinha foi gerada com sucesso. Clique para acessar a Central de Documentos.';

        await this.notificationDispatch
          .createNotification({
            tenantId: job.tenantId,
            origem: NotificationOrigin.SYSTEM_AUTOMATION,
            titulo,
            mensagem,
            urlDestino: '/documentos',
            tipoPublico: NotificationAudienceType.SPECIFIC_USERS,
            userIds: [job.requestedByUserId],
            idempotencyKey: `tenant:${job.tenantId}:doc-job-ready:${job.id}`,
          })
          .catch((err) =>
            this.logger.warn(`Falha ao emitir notificação de documento pronto: ${err?.message}`),
          );
      }
    } catch (err: any) {
      this.logger.error(
        `Falha ao processar job: ${err?.message ?? 'Erro desconhecido'}`,
        err?.stack,
      );
      if (currentJob?.id) {
        await this.jobsService
          .failJob(
            currentJob.id,
            err?.message || 'Falha no processamento do documento.',
          )
          .catch(() => undefined);
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
