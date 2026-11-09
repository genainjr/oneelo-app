import { Injectable, Logger, Optional, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import {
  AcaoAuditoria,
  EventoTipo,
  NotificationAudienceType,
  NotificationAutomationType,
  NotificationOrigin,
  StatusConfirmacao,
  StatusEscala,
  StatusEvento,
  StatusMembro,
  UserStatus,
} from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import webPush from 'web-push';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { NotificationDispatchService } from './services/notification-dispatch.service';
import { NotificationQueueProcessorService } from './services/notification-queue-processor.service';
import {
  NotificationAutomationRulesService,
  renderTemplate,
} from './services/notification-automation-rules.service';
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
    @Optional()
    private readonly notificationDispatch?: NotificationDispatchService,
    @Optional()
    private readonly automationRulesService?: NotificationAutomationRulesService,
    @Optional()
    private readonly queueProcessor?: NotificationQueueProcessorService,
  ) {
    this.configureWebPush();
  }

  private configureWebPush() {
    const publicKey = this.configService.get<string>('WEB_PUSH_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('WEB_PUSH_PRIVATE_KEY');
    const subject =
      this.configService.get<string>('WEB_PUSH_SUBJECT') ??
      'mailto:suporte@lookuplabs.com.br';

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
        status: UserStatus.ACTIVE,
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

  private isBirthdayOn(date: Date, referenceDate: Date) {
    return (
      date.getUTCMonth() === referenceDate.getUTCMonth() &&
      date.getUTCDate() === referenceDate.getUTCDate()
    );
  }

  private getFirstName(name: string) {
    return name.trim().split(/\s+/)[0] || name;
  }

  private formatBirthdayNames(names: string[]) {
    if (names.length <= 1) return names[0] ?? '';
    if (names.length === 2) return `${names[0]} e ${names[1]}`;
    return `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`;
  }

  private async getMinistryMemberUserIds(
    tenantId: string,
    ministerioIds: string[],
  ) {
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
    const publicKey =
      this.configService.get<string>('WEB_PUSH_PUBLIC_KEY') ?? '';

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

  @Cron('0 8 * * *', {
    name: 'member-birthday-notifications',
    timeZone: 'America/Sao_Paulo',
  })
  async runBirthdayNotificationJob(referenceDate = new Date()) {
    const members = await this.prisma.membro.findMany({
      where: {
        deletedAt: null,
        status: StatusMembro.ATIVO,
        dataNascimento: { not: null },
        tenant: { ativo: true },
      },
      select: {
        tenantId: true,
        nome: true,
        nomeExibicao: true,
        dataNascimento: true,
        tenant: { select: { nome: true } },
        user: {
          select: {
            id: true,
            ativo: true,
            status: true,
          },
        },
      },
    });

    const birthdayMembers = members.filter(
      (member) =>
        member.dataNascimento &&
        this.isBirthdayOn(member.dataNascimento, referenceDate),
    );
    const membersByTenant = new Map<string, typeof birthdayMembers>();

    for (const member of birthdayMembers) {
      const current = membersByTenant.get(member.tenantId) ?? [];
      current.push(member);
      membersByTenant.set(member.tenantId, current);
    }

    let sent = 0;
    let failed = 0;
    let totalSubscriptions = 0;
    let personalNotifications = 0;
    let communityNotifications = 0;

    for (const [tenantId, celebrants] of membersByTenant) {
      const tenantName = celebrants[0].tenant.nome;
      const celebrantUserIds = celebrants
        .filter(
          (member) =>
            member.user?.ativo && member.user.status === UserStatus.ACTIVE,
        )
        .map((member) => member.user!.id);

      const personalRule = (await this.automationRulesService?.getRuleByType(
        tenantId,
        NotificationAutomationType.BIRTHDAY_PERSONAL,
      )) ?? {
        ativo: true,
        titulo: 'Hoje é o seu dia, {nome}! 🎂',
        mensagem: `Feliz aniversário! Que este novo ciclo seja cheio de fé, alegria e boas histórias ao lado da família {igreja}.`,
      };

      const communityRule = (await this.automationRulesService?.getRuleByType(
        tenantId,
        NotificationAutomationType.BIRTHDAY_COMMUNITY,
      )) ?? {
        ativo: true,
        titulo: 'Hoje tem aniversário na {igreja}! 🎉',
        mensagem:
          '{nome} está celebrando mais um ano de vida. Que tal enviar uma mensagem especial?',
      };

      if (personalRule.ativo) {
        for (const celebrant of celebrants) {
          if (
            !celebrant.user?.ativo ||
            celebrant.user.status !== UserStatus.ACTIVE
          )
            continue;

          const displayName = celebrant.nomeExibicao || celebrant.nome;
          const firstName = this.getFirstName(displayName);
          const title = renderTemplate(personalRule.titulo, {
            nome: firstName,
            igreja: tenantName,
          });
          const body = renderTemplate(personalRule.mensagem, {
            nome: firstName,
            igreja: tenantName,
          });

          if (this.notificationDispatch) {
            const ano = referenceDate.getFullYear();
            await this.notificationDispatch.createNotification({
              tenantId,
              origem: NotificationOrigin.SYSTEM_AUTOMATION,
              titulo: title,
              mensagem: body,
              urlDestino: '/personal-panel',
              tipoPublico: NotificationAudienceType.SPECIFIC_USERS,
              userIds: [celebrant.user.id],
              idempotencyKey: `tenant:${tenantId}:membro:${celebrant.user.id}:birthday-personal:${ano}`,
            });
            personalNotifications += 1;
            sent += 1;
          } else {
            const result = await this.sendToUsers(tenantId, [celebrant.user.id], {
              title,
              body,
              url: '/personal-panel',
            });

            personalNotifications += 1;
            sent += result.sent;
            failed += result.failed;
            totalSubscriptions += result.total;
          }
        }
      }

      const allUserIds = await this.getTenantMemberUserIds(tenantId);
      const otherUserIds = allUserIds.filter(
        (userId) => !celebrantUserIds.includes(userId),
      );

      if (communityRule.ativo && otherUserIds.length > 0) {
        const names = celebrants.map(
          (member) => member.nomeExibicao || member.nome,
        );
        const formattedNames = this.formatBirthdayNames(names);
        const multiple = names.length > 1;
        const defaultTitle = multiple
          ? `Hoje temos aniversariantes na ${tenantName}! 🎉`
          : `Hoje tem aniversário na ${tenantName}! 🎉`;
        const title = communityRule.titulo.includes('{nome}') || communityRule.titulo.includes('{igreja}')
          ? renderTemplate(communityRule.titulo, {
              nome: formattedNames,
              igreja: tenantName,
            })
          : defaultTitle;
        const body = renderTemplate(communityRule.mensagem, {
          nome: formattedNames,
          igreja: tenantName,
        });

        if (this.notificationDispatch) {
          const refYmd = referenceDate.toISOString().split('T')[0];
          await this.notificationDispatch.createNotification({
            tenantId,
            origem: NotificationOrigin.SYSTEM_AUTOMATION,
            titulo: title,
            mensagem: body,
            urlDestino: '/personal-panel',
            tipoPublico: NotificationAudienceType.SPECIFIC_USERS,
            userIds: otherUserIds,
            idempotencyKey: `tenant:${tenantId}:birthday-community:${refYmd}`,
          });
          communityNotifications += 1;
          sent += 1;
        } else {
          const result = await this.sendToUsers(tenantId, otherUserIds, {
            title,
            body,
            url: '/personal-panel',
          });

          communityNotifications += 1;
          sent += result.sent;
          failed += result.failed;
          totalSubscriptions += result.total;
        }
      }
    }

    const result = {
      date: referenceDate.toISOString(),
      birthdayMembers: birthdayMembers.length,
      tenants: membersByTenant.size,
      personalNotifications,
      communityNotifications,
      sent,
      failed,
      totalSubscriptions,
    };

    this.logger.log(
      `Notificacoes de aniversario processadas: ${JSON.stringify(result)}`,
    );

    return result;
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

      const tenantId = item.escalaDia.escala.tenantId;
      const rule = (await this.automationRulesService?.getRuleByType(
        tenantId,
        NotificationAutomationType.SCHEDULE_CONFIRMATION_24H,
      )) ?? {
        ativo: true,
        titulo: 'Confirmação pendente',
        mensagem:
          'Sua escala de amanhã ainda aguarda confirmação. Toque para confirmar ou informar indisponibilidade.',
      };

      if (!rule.ativo) continue;

      const title = renderTemplate(rule.titulo, {
        nome: item.membro.nomeExibicao || item.membro.nome,
        ministerio: item.escalaDia.escala.ministerio.nome,
        igreja: item.escalaDia.escala.ministerio.nome,
      });
      const body = renderTemplate(rule.mensagem, {
        nome: item.membro.nomeExibicao || item.membro.nome,
        ministerio: item.escalaDia.escala.ministerio.nome,
        igreja: item.escalaDia.escala.ministerio.nome,
      });

      if (this.notificationDispatch) {
        const diaYmd = item.escalaDia.data.toISOString().split('T')[0];
        await this.notificationDispatch.createNotification({
          tenantId,
          origem: NotificationOrigin.SYSTEM_AUTOMATION,
          titulo: title,
          mensagem: body,
          urlDestino: '/minhas-escalas?pendentesApenas=true',
          tipoPublico: NotificationAudienceType.SPECIFIC_USERS,
          userIds: [userId],
          idempotencyKey: `tenant:${tenantId}:escala-item:${item.id}:pending-reminder:${diaYmd}`,
        });
        sent += 1;
      } else {
        const result = await this.sendToUsers(
          tenantId,
          [userId],
          {
            title,
            body,
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

    this.logger.log(
      `Lembrete 24h de confirmacao processado: ${JSON.stringify(result)}`,
    );

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

      const tenantId = item.escalaDia.escala.tenantId;
      const rule = (await this.automationRulesService?.getRuleByType(
        tenantId,
        NotificationAutomationType.SCHEDULE_DAY_REMINDER,
      )) ?? {
        ativo: true,
        titulo: 'Sua escala é hoje',
        mensagem:
          'Hoje você servirá no ministério de {ministerio} às {horario}. Veja os detalhes.',
      };

      if (!rule.ativo) continue;

      const horario = this.formatNotificationTime(
        item.escalaDia.evento?.dataInicio ?? item.escalaDia.data,
      );
      const title = renderTemplate(rule.titulo, {
        nome: item.membro.nomeExibicao || item.membro.nome,
        ministerio: item.escalaDia.escala.ministerio.nome,
        horario,
        igreja: item.escalaDia.escala.ministerio.nome,
      });
      const body = renderTemplate(rule.mensagem, {
        nome: item.membro.nomeExibicao || item.membro.nome,
        ministerio: item.escalaDia.escala.ministerio.nome,
        horario,
        igreja: item.escalaDia.escala.ministerio.nome,
      });
      const url = '/minhas-escalas';

      if (this.notificationDispatch) {
        const diaYmd = item.escalaDia.data.toISOString().split('T')[0];
        await this.notificationDispatch.createNotification({
          tenantId,
          origem: NotificationOrigin.SYSTEM_AUTOMATION,
          titulo: title,
          mensagem: body,
          urlDestino: url,
          tipoPublico: NotificationAudienceType.SPECIFIC_USERS,
          userIds: [userId],
          idempotencyKey: `tenant:${tenantId}:escala-item:${item.id}:day-reminder:${diaYmd}`,
        });
        sent += 1;
      } else {
        const result = await this.sendToUsers(
          tenantId,
          [userId],
          {
            title,
            body,
            url,
          },
        );

        sent += result.sent;
        failed += result.failed;
        totalSubscriptions += result.total;

        if (result.total === 0) {
          withoutSubscription += 1;
        }
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

    this.logger.log(
      `Lembrete do dia da escala processado: ${JSON.stringify(result)}`,
    );

    return result;
  }

  /**
   * @deprecated Descontinuado em favor da infraestrutura central de agendamento de eventos
   * com fila atômica via NotificationDispatchService e NotificationQueueProcessorService.
   */
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
      const ministerioIds = evento.ministerios.map(
        (relacao) => relacao.ministerioId,
      );
      const userIds =
        evento.tipo === EventoTipo.GERAL
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

    this.logger.log(
      `Lembrete 2h de eventos processado: ${JSON.stringify(result)}`,
    );

    return result;
  }

  /**
   * Executa jobs de lembretes e acionamento de fila via chamada externa segura (ex: cron-job.org).
   * Valida a chave de API interna com timingSafeEqual para evitar timing attacks.
   */
  async executeInternalCron(apiKeyHeader?: string, job: string = 'all') {
    const configuredKey = this.configService.get<string>('INTERNAL_CRON_API_KEY');
    if (!configuredKey || !apiKeyHeader) {
      throw new UnauthorizedException('Chave de API interna inválida ou não configurada.');
    }

    const headerBuf = Buffer.from(apiKeyHeader);
    const expectedBuf = Buffer.from(configuredKey);
    if (headerBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(headerBuf, expectedBuf)) {
      throw new UnauthorizedException('Chave de API interna inválida ou não configurada.');
    }

    const normalizedJob = (job || 'all').toLowerCase();
    const results: Record<string, any> = {};

    if (normalizedJob === 'all' || normalizedJob === 'birthdays') {
      results.birthdays = await this.runBirthdayNotificationJob();
    }
    if (normalizedJob === 'all' || normalizedJob === 'confirmations-24h') {
      results.confirmations24h = await this.runPendingConfirmationReminderJob();
    }
    if (normalizedJob === 'all' || normalizedJob === 'schedule-day') {
      results.scheduleDay = await this.runScheduleDayReminderJob();
    }
    if (normalizedJob === 'all' || normalizedJob === 'queue') {
      this.queueProcessor?.triggerImmediateProcessing();
      results.queue = { triggered: true };
    } else {
      this.queueProcessor?.triggerImmediateProcessing();
    }

    return {
      success: true,
      job: normalizedJob,
      executedAt: new Date().toISOString(),
      results,
    };
  }
}
