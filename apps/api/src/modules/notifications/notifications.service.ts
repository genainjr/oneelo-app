import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AcaoAuditoria,
  EventoTipo,
  StatusConfirmacao,
  StatusEscala,
  StatusEvento,
  StatusMembro,
} from '@prisma/client';
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

  private getEventReminderRange(referenceDate = new Date()) {
    const start = new Date(referenceDate);
    start.setSeconds(0, 0);
    start.setHours(start.getHours() + 2);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 1);

    return { start, end };
  }

  private formatNotificationTime(date: Date) {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(date);
  }

  private async getTenantMemberUserIds(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        ativo: true,
        membro: {
          is: {
            tenantId,
            deletedAt: null,
            status: StatusMembro.ATIVO,
          },
        },
      },
      select: { id: true },
    });

    return users.map((user) => user.id);
  }

  private async getMinistryMemberUserIds(tenantId: string, ministerioIds: string[]) {
    if (ministerioIds.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        ativo: true,
        membro: {
          is: {
            tenantId,
            deletedAt: null,
            status: StatusMembro.ATIVO,
            ministerios: {
              some: {
                ministerioId: { in: ministerioIds },
              },
            },
          },
        },
      },
      select: { id: true },
    });

    return users.map((user) => user.id);
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
    const existing = await this.prisma.pushSubscription.findUnique({
      where: { endpoint: dto.endpoint },
      select: { id: true, ativo: true },
    });

    const subscription = await this.prisma.pushSubscription.upsert({
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

    if (!existing || !existing.ativo) {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId: user.sub,
          entidade: 'push_subscription',
          entidadeId: subscription.id,
          acao: AcaoAuditoria.CRIAR,
          payloadAfter: {
            ativo: true,
            userAgent: dto.userAgent,
          },
        },
      });
    }

    return subscription;
  }

  async deleteSubscription(
    tenantId: string,
    user: JwtPayload,
    dto: DeletePushSubscriptionDto,
  ) {
    const existing = await this.prisma.pushSubscription.findFirst({
      where: {
        tenantId,
        userId: user.sub,
        endpoint: dto.endpoint,
      },
      select: {
        id: true,
        ativo: true,
        userAgent: true,
      },
    });

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

    if (existing?.ativo) {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId: user.sub,
          entidade: 'push_subscription',
          entidadeId: existing.id,
          acao: AcaoAuditoria.DELETAR,
          payloadBefore: {
            ativo: true,
            userAgent: existing.userAgent,
          },
          payloadAfter: {
            ativo: false,
          },
        },
      });
    }

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
          title: 'Confirmação pendente',
          body: 'Sua escala de amanhã ainda aguarda confirmação. Toque para confirmar ou informar indisponibilidade.',
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
            evento: {
              select: {
                dataInicio: true,
              },
            },
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

      const horario = this.formatNotificationTime(item.escalaDia.evento?.dataInicio ?? item.escalaDia.data);

      const result = await this.sendToUsers(
        item.escalaDia.escala.tenantId,
        [userId],
        {
          title: 'Sua escala é hoje',
          body: `Hoje você servirá no ministério de ${item.escalaDia.escala.ministerio.nome} às ${horario}. Veja os detalhes.`,
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

  @Cron('* * * * *', {
    name: 'event-reminder-2h',
    timeZone: 'America/Sao_Paulo',
  })
  async runEventReminderJob() {
    const { start, end } = this.getEventReminderRange();

    const eventos = await this.prisma.evento.findMany({
      where: {
        status: StatusEvento.AGENDADO,
        tipo: {
          in: [EventoTipo.GERAL, EventoTipo.MINISTERIO],
        },
        dataInicio: {
          gte: start,
          lt: end,
        },
      },
      select: {
        id: true,
        tenantId: true,
        titulo: true,
        tipo: true,
        dataInicio: true,
        ministerios: {
          select: {
            ministerioId: true,
          },
        },
      },
    });

    let sent = 0;
    let failed = 0;
    let totalSubscriptions = 0;
    let withoutRecipients = 0;
    let withoutSubscription = 0;

    for (const evento of eventos) {
      const ministerioIds = evento.ministerios.map((relacao) => relacao.ministerioId);
      const userIds = evento.tipo === EventoTipo.GERAL
        ? await this.getTenantMemberUserIds(evento.tenantId)
        : await this.getMinistryMemberUserIds(evento.tenantId, ministerioIds);

      if (userIds.length === 0) {
        withoutRecipients += 1;
        continue;
      }

      const horario = this.formatNotificationTime(evento.dataInicio);
      const result = await this.sendToUsers(evento.tenantId, userIds, {
        title: 'Evento em 2 horas',
        body: `${evento.titulo} começa às ${horario}. Esperamos você!`,
        url: '/agenda/visualizacao',
      });

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
      events: eventos.length,
      withoutRecipients,
      withoutSubscription,
      sent,
      failed,
      totalSubscriptions,
    };

    this.logger.log(`Lembrete 2h de eventos processado: ${JSON.stringify(result)}`);

    return result;
  }
}
