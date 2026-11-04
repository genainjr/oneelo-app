import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Prisma,
  NotificationStatus,
  RecipientDeliveryStatus,
  PushSubscription,
} from '@prisma/client';
import webPush from 'web-push';
import { PrismaService } from '../../../common/prisma/prisma.service';

export interface ClaimedRecipientRow {
  id: string;
  notification_id: string;
  user_id: string;
  attempt_count: number;
  tenant_id: string;
  title: string;
  message: string;
  target_url: string | null;
}

@Injectable()
export class NotificationQueueProcessorService {
  private readonly logger = new Logger(NotificationQueueProcessorService.name);
  private isProcessing = false;
  readonly batchSize = 50;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.configureWebPush();
  }

  private configureWebPush() {
    const publicKey = this.configService.get<string>('WEB_PUSH_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('WEB_PUSH_PRIVATE_KEY');
    const subject =
      this.configService.get<string>('WEB_PUSH_SUBJECT') ??
      'mailto:suporte@lookuplabs.com.br';

    if (publicKey && privateKey) {
      webPush.setVapidDetails(subject, publicKey, privateKey);
    }
  }

  /**
   * Cron recorrente a cada 15 segundos para drenar itens pendentes na fila.
   */
  @Cron('*/15 * * * * *')
  async handleCron() {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;

    try {
      let processedInBatch = 0;
      do {
        processedInBatch = await this.processBatch();
      } while (processedInBatch === this.batchSize);
    } catch (error) {
      this.logger.error('Erro durante processamento da fila de notificações:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Processa um lote atômico de até 50 destinatários pendentes com SKIP LOCKED.
   */
  async processBatch(): Promise<number> {
    const claimedRows = await this.claimBatch();
    if (claimedRows.length === 0) {
      return 0;
    }

    const touchedNotificationIds = new Set<string>();

    for (const item of claimedRows) {
      touchedNotificationIds.add(item.notification_id);
      await this.deliverRecipient(item);
    }

    // Atualiza status dos cabeçalhos finalizados
    for (const notificationId of touchedNotificationIds) {
      await this.updateNotificationCompletionStatus(notificationId);
    }

    return claimedRows.length;
  }

  /**
   * Reserva atômica de destinatários utilizando PostgreSQL FOR UPDATE SKIP LOCKED.
   */
  async claimBatch(): Promise<ClaimedRecipientRow[]> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<ClaimedRecipientRow[]>(Prisma.sql`
        SELECT 
          r.id,
          r.notification_id,
          r.user_id,
          r.attempt_count,
          n.tenant_id,
          n.title,
          n.message,
          n.target_url
        FROM tb_notification_recipient r
        JOIN tb_notification n ON n.id = r.notification_id
        WHERE (
          r.status = 'PENDING'::recipient_delivery_status
          OR r.status = 'FAILED_RETRYABLE'::recipient_delivery_status
          OR (r.status = 'PROCESSING'::recipient_delivery_status AND r.locked_until < NOW())
        )
          AND n.status IN ('SCHEDULED'::notification_status, 'PROCESSING'::notification_status)
          AND n.scheduled_at <= NOW()
          AND (r.locked_until IS NULL OR r.locked_until < NOW())
        ORDER BY n.scheduled_at ASC
        LIMIT ${this.batchSize}
        FOR UPDATE OF r SKIP LOCKED
      `);

      if (rows.length === 0) {
        return [];
      }

      const ids = rows.map((r) => r.id);
      const notificationIds = Array.from(new Set(rows.map((r) => r.notification_id)));

      // Bloqueio atômico temporário (2 minutos de lease)
      await tx.$executeRaw(Prisma.sql`
        UPDATE tb_notification_recipient
        SET status = 'PROCESSING'::recipient_delivery_status,
            locked_until = NOW() + INTERVAL '2 minutes'
        WHERE id = ANY(${ids}::text[])
      `);

      // Atualiza o status do cabeçalho para PROCESSING se ainda estiver SCHEDULED
      await tx.$executeRaw(Prisma.sql`
        UPDATE tb_notification
        SET status = 'PROCESSING'::notification_status
        WHERE id = ANY(${notificationIds}::text[])
          AND status = 'SCHEDULED'::notification_status
      `);

      return rows;
    });
  }

  /**
   * Executa o disparo de push para um destinatário reservado.
   */
  async deliverRecipient(item: ClaimedRecipientRow) {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        tenantId: item.tenant_id,
        userId: item.user_id,
        ativo: true,
      },
    });

    if (subscriptions.length === 0) {
      await this.prisma.notificationRecipient.update({
        where: { id: item.id },
        data: {
          status: RecipientDeliveryStatus.NO_SUBSCRIPTION,
          lockedUntil: null,
          ultimoErro: 'Usuário sem assinatura push ativa',
        },
      });
      return;
    }

    const payload = JSON.stringify({
      title: item.title,
      body: item.message,
      url: item.target_url ?? '/minhas-escalas',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    });

    let atLeastOneSuccess = false;
    let lastError: string | null = null;
    let allSubscriptionsExpired = true;

    for (const sub of subscriptions) {
      try {
        await this.sendPush(sub, payload);
        atLeastOneSuccess = true;
        allSubscriptionsExpired = false;
      } catch (err: any) {
        lastError = err?.message || 'Falha no gateway Web Push';
        const statusCode = err?.statusCode ?? err?.status;

        // Se a subscription expirou ou foi revogada (404 Not Found ou 410 Gone)
        if (statusCode === 404 || statusCode === 410) {
          await this.prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { ativo: false },
          });
        } else {
          allSubscriptionsExpired = false;
        }
      }
    }

    if (atLeastOneSuccess) {
      await this.prisma.notificationRecipient.update({
        where: { id: item.id },
        data: {
          status: RecipientDeliveryStatus.SENT,
          enviadoEm: new Date(),
          lockedUntil: null,
          ultimoErro: null,
        },
      });
      return;
    }

    if (allSubscriptionsExpired) {
      await this.prisma.notificationRecipient.update({
        where: { id: item.id },
        data: {
          status: RecipientDeliveryStatus.FAILED_PERMANENT,
          lockedUntil: null,
          ultimoErro: 'Todas as assinaturas push do usuário foram revogadas ou expiraram',
          tentativas: item.attempt_count + 1,
        },
      });
      return;
    }

    // Falha temporária: incrementa tentativa e aplica retry com backoff exponencial
    const nextAttempts = item.attempt_count + 1;
    const isExceeded = nextAttempts >= 3;

    await this.prisma.notificationRecipient.update({
      where: { id: item.id },
      data: {
        status: isExceeded
          ? RecipientDeliveryStatus.FAILED_PERMANENT
          : RecipientDeliveryStatus.FAILED_RETRYABLE,
        lockedUntil: isExceeded ? null : new Date(Date.now() + nextAttempts * 60 * 1000),
        ultimoErro: lastError,
        tentativas: nextAttempts,
      },
    });
  }

  /**
   * Método envelopado de envio com trava de segurança para ambientes de desenvolvimento/teste.
   */
  async sendPush(subscription: PushSubscription, payload: string) {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production' ||
      process.env.NODE_ENV === 'production';
    const forceRealPush =
      this.configService.get<string>('ENABLE_REAL_PUSH_DISPATCH') === 'true';

    // Trava de segurança: se não for produção e não estiver forçado explicitamente via env, simula o envio
    if (!isProduction && !forceRealPush) {
      this.logger.log(
        `[SIMULAÇÃO PUSH LOCAL] Notificação simulada com sucesso para endpoint: ${subscription.endpoint.slice(0, 45)}...`,
      );
      return;
    }

    return webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      payload,
    );
  }

  /**
   * Atualiza o status mestre de Notification quando todos os recipients forem concluídos.
   */
  async updateNotificationCompletionStatus(notificationId: string) {
    const counts = await this.prisma.notificationRecipient.groupBy({
      by: ['status'],
      where: { notificationId },
      _count: { id: true },
    });

    const statusMap = new Map(counts.map((c) => [c.status, c._count.id]));

    const pendingCount =
      (statusMap.get(RecipientDeliveryStatus.PENDING) ?? 0) +
      (statusMap.get(RecipientDeliveryStatus.PROCESSING) ?? 0) +
      (statusMap.get(RecipientDeliveryStatus.FAILED_RETRYABLE) ?? 0);

    // Se ainda há algum item em andamento ou retry, mantém status PROCESSING
    if (pendingCount > 0) {
      return;
    }

    const sentCount = statusMap.get(RecipientDeliveryStatus.SENT) ?? 0;
    const finalStatus =
      sentCount > 0 ? NotificationStatus.COMPLETED : NotificationStatus.FAILED;

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { status: finalStatus },
    });
  }

  /**
   * Limpeza periódica de histórico antigo (TTL de 60 dias) aos domingos às 03:00.
   */
  @Cron('0 3 * * 0', {
    name: 'notification-history-retention-cleanup',
    timeZone: 'America/Sao_Paulo',
  })
  async cleanupOldNotifications(days = 60) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const deleted = await this.prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        status: {
          in: [
            NotificationStatus.COMPLETED,
            NotificationStatus.FAILED,
            NotificationStatus.CANCELED,
          ],
        },
      },
    });

    if (deleted.count > 0) {
      this.logger.log(
        `Limpeza de histórico de notificações: ${deleted.count} notificações antigas removidas (TTL: ${days} dias).`,
      );
    }

    return deleted.count;
  }
}
