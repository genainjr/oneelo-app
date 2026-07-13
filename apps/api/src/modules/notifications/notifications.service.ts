import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StatusConfirmacao, StatusEscala } from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import webPush from 'web-push';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import {
  DeletePushSubscriptionDto,
  SendTestNotificationDto,
  UpsertPushSubscriptionDto,
} from './dto/push-subscription.dto';

type PushNotificationPayload = {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.configureWebPush();
  }

  private configureWebPush() {
    const publicKey = this.configService.get<string>('WEB_PUSH_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('WEB_PUSH_PRIVATE_KEY');
    const subject = this.configService.get<string>('WEB_PUSH_SUBJECT') ?? 'mailto:suporte@lookuplabs.com.br';

    if (!publicKey || !privateKey) return;

    webPush.setVapidDetails(subject, publicKey, privateKey);
  }

  private getTomorrowRange(referenceDate = new Date()) {
    const start = new Date(referenceDate);
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  private getTodayRange(referenceDate = new Date()) {
    const start = new Date(referenceDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  getPublicKey() {
    const publicKey = this.configService.get<string>('WEB_PUSH_PUBLIC_KEY') ?? '';

    return {
      publicKey,
      configured: Boolean(publicKey),
    };
  }

  async upsertSubscription(
    tenantId: string,
    user: JwtPayload,
    dto: UpsertPushSubscriptionDto,
  ) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        tenantId,
        userId: user.sub,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent,
        ativo: true,
      },
      update: {
        tenantId,
        userId: user.sub,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent,
        ativo: true,
      },
      select: {
        id: true,
        ativo: true,
        updatedAt: true,
      },
    });
  }

  async deleteSubscription(
    tenantId: string,
    user: JwtPayload,
    dto: DeletePushSubscriptionDto,
  ) {
    await this.prisma.pushSubscription.updateMany({
      where: {
        tenantId,
        userId: user.sub,
        endpoint: dto.endpoint,
      },
      data: {
        ativo: false,
      },
    });

    return { message: 'Subscription de notificacao removida.' };
  }

  async sendTestNotification(
    tenantId: string,
    user: JwtPayload,
    dto: SendTestNotificationDto,
  ) {
    return this.sendToUsers(tenantId, [user.sub], {
      title: dto.title || 'One Elo',
      body: dto.body || 'Notificacao de teste enviada pelo One Elo.',
      url: dto.url || '/dashboard',
    });
  }

  async sendToUsers(
    tenantId: string,
    userIds: string[],
    notification: PushNotificationPayload,
  ) {
    const publicKey = this.configService.get<string>('WEB_PUSH_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('WEB_PUSH_PRIVATE_KEY');

    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

    if (!publicKey || !privateKey) {
      return {
        sent: 0,
        failed: 0,
        total: 0,
        skipped: true,
        message: 'Web Push nao esta configurado no backend.',
      };
    }

    if (uniqueUserIds.length === 0) {
      return {
        sent: 0,
        failed: 0,
        total: 0,
      };
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        tenantId,
        userId: { in: uniqueUserIds },
        ativo: true,
      },
    });

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      url: notification.url || '/dashboard',
      icon: notification.icon || '/icon-192.png',
      badge: notification.badge || '/icon-192.png',
    });

    let sent = 0;
    let failed = 0;

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            payload,
          );
          sent += 1;
        } catch (error: any) {
          failed += 1;

          if (error?.statusCode === 404 || error?.statusCode === 410) {
            await this.prisma.pushSubscription.update({
              where: { id: subscription.id },
              data: { ativo: false },
            });
          }
        }
      }),
    );

    return {
      sent,
      failed,
      total: subscriptions.length,
    };
  }

  @Cron('0 8,13 * * *', {
    name: 'pending-confirmations-24h',
    timeZone: 'America/Sao_Paulo',
  })
  async runPendingConfirmationReminderJob() {
    const { start, end } = this.getTomorrowRange();

    const items = await this.prisma.escalaItem.findMany({
      where: {
        statusConfirmacao: StatusConfirmacao.PENDENTE,
        escalaDia: {
          data: {
            gte: start,
            lte: end,
          },
          escala: {
            status: StatusEscala.PUBLICADA,
          },
        },
        membro: {
          user: {
            is: {
              ativo: true,
            },
          },
        },
      },
      include: {
        membro: {
          include: {
            user: {
              select: {
                id: true,
                ativo: true,
              },
            },
          },
        },
        escalaDia: {
          include: {
            escala: {
              include: {
                ministerio: { select: { nome: true } },
              },
            },
          },
        },
      },
    });

    let sent = 0;
    let failed = 0;
    let totalSubscriptions = 0;
    let withoutSubscription = 0;

    for (const item of items) {
      const userId = item.membro.user?.id;
      if (!userId) continue;

      const result = await this.sendToUsers(
        item.escalaDia.escala.tenantId,
        [userId],
        {
          title: 'Confirmação Pendente',
          body: `Você ainda não confirmou sua presença na escala de amanhã em ${item.escalaDia.escala.ministerio.nome}.`,
          url: '/minhas-escalas?pendentesApenas=true',
        },
      );

      sent += result.sent;
      failed += result.failed;
      totalSubscriptions += result.total;

      if (result.total === 0) {
        withoutSubscription += 1;
      }
    }

    const result = {
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      pendingItems: items.length,
      withoutSubscription,
      sent,
      failed,
      totalSubscriptions,
    };

    this.logger.log(`Lembrete 24h de confirmacao processado: ${JSON.stringify(result)}`);

    return result;
  }

  @Cron('0 9 * * *', {
    name: 'schedule-day-reminder',
    timeZone: 'America/Sao_Paulo',
  })
  async runScheduleDayReminderJob() {
    const { start, end } = this.getTodayRange();

    const items = await this.prisma.escalaItem.findMany({
      where: {
        statusConfirmacao: {
          in: [StatusConfirmacao.PENDENTE, StatusConfirmacao.CONFIRMADO],
        },
        escalaDia: {
          data: {
            gte: start,
            lte: end,
          },
          escala: {
            status: StatusEscala.PUBLICADA,
          },
        },
        membro: {
          user: {
            is: {
              ativo: true,
            },
          },
        },
      },
      include: {
        membro: {
          include: {
            user: {
              select: {
                id: true,
                ativo: true,
              },
            },
          },
        },
        escalaDia: {
          include: {
            escala: {
              include: {
                ministerio: { select: { nome: true } },
              },
            },
          },
        },
      },
    });

    let sent = 0;
    let failed = 0;
    let totalSubscriptions = 0;
    let withoutSubscription = 0;

    for (const item of items) {
      const userId = item.membro.user?.id;
      if (!userId) continue;

      const result = await this.sendToUsers(
        item.escalaDia.escala.tenantId,
        [userId],
        {
          title: 'Escala Hoje',
          body: `Você está escalado hoje em ${item.escalaDia.escala.ministerio.nome}. Confira os detalhes no One Elo.`,
          url: '/minhas-escalas',
        },
      );

      sent += result.sent;
      failed += result.failed;
      totalSubscriptions += result.total;

      if (result.total === 0) {
        withoutSubscription += 1;
      }
    }

    const result = {
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      scheduledItems: items.length,
      withoutSubscription,
      sent,
      failed,
      totalSubscriptions,
    };

    this.logger.log(`Lembrete do dia da escala processado: ${JSON.stringify(result)}`);

    return result;
  }
}
