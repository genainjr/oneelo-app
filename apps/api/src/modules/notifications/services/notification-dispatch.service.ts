import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  Prisma,
  NotificationOrigin,
  NotificationAudienceType,
  NotificationStatus,
  RecipientDeliveryStatus,
  UserStatus,
  StatusMembro,
  Role,
  MinistryRole,
} from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { JwtPayload } from '../../../common/types/jwt-payload.interface';
import { FilterNotificationsDto } from '../dto/filter-notifications.dto';
import { FilterRecipientsDto } from '../dto/filter-recipients.dto';
import { CreateManualNotificationDto } from '../dto/create-manual-notification.dto';

export interface CreateNotificationInput {
  tenantId: string;
  titulo: string;
  mensagem: string;
  urlDestino?: string | null;
  origem: NotificationOrigin;
  tipoPublico: NotificationAudienceType;
  ministerioId?: string | null;
  scheduledAt?: Date;
  idempotencyKey?: string | null;
  criadoPorId?: string | null;
  userIds?: string[];
}

@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria uma notificação centralizada de forma idempotente e materializa seus destinatários.
   */
  async createNotification(input: CreateNotificationInput) {
    if (!input.tenantId) {
      throw new BadRequestException('tenantId é obrigatório.');
    }
    if (!input.titulo || !input.mensagem) {
      throw new BadRequestException('titulo e mensagem são obrigatórios.');
    }

    // 1. Idempotência: se já existe notificação com a mesma chave, retorna o registro existente
    if (input.idempotencyKey) {
      const existing = await this.prisma.notification.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { destinatarios: true },
      });
      if (existing) {
        this.logger.debug(
          `Notificação idempotente já existente: key=${input.idempotencyKey}, id=${existing.id}`,
        );
        return existing;
      }
    }

    // 2. Resolução de destinatários (userIds)
    const targetUserIds = await this.resolveTargetUserIds(input);

    // 3. Verificação de assinaturas ativas de push para definir status inicial
    const usersWithPush = await this.getUsersWithActivePush(input.tenantId, targetUserIds);

    const scheduledAt = input.scheduledAt ?? new Date();

    try {
      const notification = await this.prisma.notification.create({
        data: {
          tenantId: input.tenantId,
          titulo: input.titulo,
          mensagem: input.mensagem,
          urlDestino: input.urlDestino ?? null,
          origem: input.origem,
          tipoPublico: input.tipoPublico,
          ministerioId: input.ministerioId ?? null,
          scheduledAt,
          idempotencyKey: input.idempotencyKey ?? null,
          criadoPorId: input.criadoPorId ?? null,
          status:
            targetUserIds.length === 0
              ? NotificationStatus.COMPLETED
              : NotificationStatus.SCHEDULED,
          destinatarios: {
            createMany: {
              data: targetUserIds.map((userId) => ({
                userId,
                status: usersWithPush.has(userId)
                  ? RecipientDeliveryStatus.PENDING
                  : RecipientDeliveryStatus.NO_SUBSCRIPTION,
              })),
            },
          },
        },
        include: {
          destinatarios: true,
        },
      });

      return notification;
    } catch (error) {
      // Tratamento de race condition em idempotencyKey único
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        input.idempotencyKey
      ) {
        const existing = await this.prisma.notification.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { destinatarios: true },
        });
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  /**
   * Reagenda uma notificação existente caso ainda esteja pendente/agendada.
   */
  async rescheduleNotification(id: string, tenantId: string, newScheduledAt: Date) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, tenantId },
    });

    if (!notification) {
      throw new NotFoundException('Notificação não encontrada.');
    }

    if (
      notification.status === NotificationStatus.COMPLETED ||
      notification.status === NotificationStatus.CANCELED
    ) {
      return notification;
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        scheduledAt: newScheduledAt,
        status: NotificationStatus.SCHEDULED,
      },
    });
  }

  /**
   * Cancela uma notificação agendada.
   */
  async cancelNotification(id: string, tenantId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, tenantId },
    });

    if (!notification) {
      throw new NotFoundException('Notificação não encontrada.');
    }

    if (notification.status === NotificationStatus.COMPLETED) {
      return notification;
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        status: NotificationStatus.CANCELED,
      },
    });
  }

  /**
   * Resolve a lista de IDs de usuários alvo com base no tipo de público ou lista explícita.
   */
  private async resolveTargetUserIds(input: CreateNotificationInput): Promise<string[]> {
    // Caso 1: Usuários fornecidos diretamente
    if (input.userIds && input.userIds.length > 0) {
      const uniqueIds = Array.from(new Set(input.userIds));
      const validUsers = await this.prisma.user.findMany({
        where: {
          id: { in: uniqueIds },
          tenantId: input.tenantId,
          ativo: true,
          status: UserStatus.ACTIVE,
        },
        select: { id: true },
      });
      return validUsers.map((u) => u.id);
    }

    // Caso 2: Todos os membros da igreja com usuário ativo
    if (input.tipoPublico === NotificationAudienceType.ALL_MEMBERS) {
      const users = await this.prisma.user.findMany({
        where: {
          tenantId: input.tenantId,
          ativo: true,
          status: UserStatus.ACTIVE,
        },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }

    // Caso 3: Membros de um ministério específico com usuário ativo
    if (input.tipoPublico === NotificationAudienceType.MINISTRY) {
      if (!input.ministerioId) {
        throw new BadRequestException('ministerioId é obrigatório para público MINISTRY.');
      }

      const ministryMembers = await this.prisma.ministerioMembro.findMany({
        where: {
          ministerioId: input.ministerioId,
          ministerio: { tenantId: input.tenantId },
          membro: {
            deletedAt: null,
            status: StatusMembro.ATIVO,
            user: {
              tenantId: input.tenantId,
              ativo: true,
              status: UserStatus.ACTIVE,
            },
          },
        },
        select: {
          membro: {
            select: {
              user: {
                select: { id: true },
              },
            },
          },
        },
      });

      const userIds = ministryMembers
        .map((mm) => mm.membro?.user?.id)
        .filter((id): id is string => Boolean(id));

      return Array.from(new Set(userIds));
    }

    return [];
  }

  /**
   * Identifica quais dos usuários alvo possuem ao menos uma subscription ativa de push.
   */
  private async getUsersWithActivePush(
    tenantId: string,
    userIds: string[],
  ): Promise<Set<string>> {
    if (userIds.length === 0) {
      return new Set();
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        tenantId,
        userId: { in: userIds },
        ativo: true,
      },
      select: { userId: true },
    });

    return new Set(subscriptions.map((s) => s.userId));
  }

  /**
   * Lista notificações com filtros e paginação para o painel administrativo.
   */
  async listNotifications(tenantId: string, query: FilterNotificationsDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { tenantId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.origem) {
      where.origem = query.origem;
    }
    if (query.tipoPublico) {
      where.tipoPublico = query.tipoPublico;
    }
    if (query.ministerioId) {
      where.ministerioId = query.ministerioId;
    }

    if (query.dataInicio || query.dataFim) {
      where.scheduledAt = {};
      if (query.dataInicio) {
        where.scheduledAt.gte = new Date(query.dataInicio);
      }
      if (query.dataFim) {
        where.scheduledAt.lte = new Date(query.dataFim);
      }
    }

    if (query.search) {
      where.OR = [
        { titulo: { contains: query.search, mode: 'insensitive' } },
        { mensagem: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, items, metricsRaw] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          ministerio: { select: { id: true, nome: true } },
          criadoPor: { select: { id: true, nome: true, email: true } },
          recipients: {
            select: {
              status: true,
            },
          },
        },
      }),
      this.prisma.notificationRecipient.groupBy({
        by: ['status'],
        where: { notification: { tenantId } },
        _count: { status: true },
      }),
    ]);

    const metrics = {
      totalSent: 0,
      totalPending: 0,
      totalFailed: 0,
      totalNoSubscription: 0,
    };

    for (const group of metricsRaw) {
      if (group.status === RecipientDeliveryStatus.SENT) {
        metrics.totalSent += group._count.status;
      } else if (
        group.status === RecipientDeliveryStatus.PENDING ||
        group.status === RecipientDeliveryStatus.PROCESSING
      ) {
        metrics.totalPending += group._count.status;
      } else if (
        group.status === RecipientDeliveryStatus.FAILED_RETRYABLE ||
        group.status === RecipientDeliveryStatus.FAILED_PERMANENT
      ) {
        metrics.totalFailed += group._count.status;
      } else if (group.status === RecipientDeliveryStatus.NO_SUBSCRIPTION) {
        metrics.totalNoSubscription += group._count.status;
      }
    }

    const data = items.map((item) => {
      const counts = {
        total: item.recipients.length,
        sent: 0,
        pending: 0,
        failed: 0,
        noSubscription: 0,
      };

      for (const r of item.recipients) {
        if (r.status === RecipientDeliveryStatus.SENT) {
          counts.sent += 1;
        } else if (
          r.status === RecipientDeliveryStatus.PENDING ||
          r.status === RecipientDeliveryStatus.PROCESSING
        ) {
          counts.pending += 1;
        } else if (
          r.status === RecipientDeliveryStatus.FAILED_RETRYABLE ||
          r.status === RecipientDeliveryStatus.FAILED_PERMANENT
        ) {
          counts.failed += 1;
        } else if (r.status === RecipientDeliveryStatus.NO_SUBSCRIPTION) {
          counts.noSubscription += 1;
        }
      }

      const { recipients, ...rest } = item;
      return {
        ...rest,
        deliveryStats: counts,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      metrics,
    };
  }

  /**
   * Obtém detalhes de uma notificação e lista paginada de destinatários.
   */
  async getNotificationById(
    tenantId: string,
    id: string,
    query?: FilterRecipientsDto,
  ) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, tenantId },
      include: {
        ministerio: { select: { id: true, nome: true } },
        criadoPor: { select: { id: true, nome: true, email: true } },
      },
    });

    if (!notification) {
      throw new NotFoundException('Notificação não encontrada.');
    }

    const page = query?.page && query.page > 0 ? query.page : 1;
    const limit = query?.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const recipientWhere: Prisma.NotificationRecipientWhereInput = {
      notificationId: id,
    };
    if (query?.status) {
      recipientWhere.status = query.status;
    }

    const [totalRecipients, recipientsRaw, statusGroups] = await Promise.all([
      this.prisma.notificationRecipient.count({ where: recipientWhere }),
      this.prisma.notificationRecipient.findMany({
        where: recipientWhere,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              nome: true,
              email: true,
              membro: {
                select: {
                  nome: true,
                  nomeExibicao: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.notificationRecipient.groupBy({
        by: ['status'],
        where: { notificationId: id },
        _count: { status: true },
      }),
    ]);

    const stats = {
      total: 0,
      sent: 0,
      pending: 0,
      failed: 0,
      noSubscription: 0,
    };

    for (const group of statusGroups) {
      stats.total += group._count.status;
      if (group.status === RecipientDeliveryStatus.SENT) {
        stats.sent += group._count.status;
      } else if (
        group.status === RecipientDeliveryStatus.PENDING ||
        group.status === RecipientDeliveryStatus.PROCESSING
      ) {
        stats.pending += group._count.status;
      } else if (
        group.status === RecipientDeliveryStatus.FAILED_RETRYABLE ||
        group.status === RecipientDeliveryStatus.FAILED_PERMANENT
      ) {
        stats.failed += group._count.status;
      } else if (group.status === RecipientDeliveryStatus.NO_SUBSCRIPTION) {
        stats.noSubscription += group._count.status;
      }
    }

    const recipients = recipientsRaw.map((r) => {
      const userDisplay =
        r.user.membro?.nomeExibicao ||
        r.user.membro?.nome ||
        r.user.nome ||
        r.user.email;
      return {
        id: r.id,
        userId: r.userId,
        userName: userDisplay,
        userEmail: r.user.email,
        status: r.status,
        tentativas: r.tentativas,
        ultimoErro: r.ultimoErro,
        enviadoEm: r.enviadoEm,
        createdAt: r.createdAt,
      };
    });

    return {
      notification,
      stats,
      recipients: {
        data: recipients,
        meta: {
          total: totalRecipients,
          page,
          limit,
          totalPages: Math.ceil(totalRecipients / limit) || 1,
        },
      },
    };
  }

  /**
   * Reprocessa destinatários que falharam em uma notificação.
   */
  async retryFailedRecipients(tenantId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, tenantId },
    });

    if (!notification) {
      throw new NotFoundException('Notificação não encontrada.');
    }

    const updated = await this.prisma.notificationRecipient.updateMany({
      where: {
        notificationId: id,
        status: {
          in: [
            RecipientDeliveryStatus.FAILED_RETRYABLE,
            RecipientDeliveryStatus.FAILED_PERMANENT,
          ],
        },
      },
      data: {
        status: RecipientDeliveryStatus.PENDING,
        tentativas: 0,
        lockedUntil: null,
        ultimoErro: null,
      },
    });

    if (updated.count > 0) {
      await this.prisma.notification.update({
        where: { id },
        data: {
          status: NotificationStatus.PENDING,
          scheduledAt: new Date(),
        },
      });
    }

    return {
      success: true,
      retriedCount: updated.count,
    };
  }

  /**
   * Cria um comunicado manual (geral ou ministerial) com validações de RBAC e agendamento.
   */
  async createManualNotification(
    tenantId: string,
    user: JwtPayload,
    dto: CreateManualNotificationDto,
  ) {
    let origem = NotificationOrigin.COMMUNICATION_GENERAL;

    if (dto.tipoPublico === NotificationAudienceType.MINISTRY) {
      if (!dto.ministerioId) {
        throw new BadRequestException(
          'O ministério é obrigatório quando o público é MINISTERIO.',
        );
      }

      origem = NotificationOrigin.COMMUNICATION_MINISTRY;

      // Se for BASIC, deve liderar o ministério
      if (user.role === Role.BASIC) {
        const leadership = await this.prisma.ministerioMembro.findFirst({
          where: {
            ministerioId: dto.ministerioId,
            role: { in: [MinistryRole.LEADER, MinistryRole.ASSISTANT_LEADER] },
            membro: {
              tenantId,
              userId: user.sub,
              deletedAt: null,
              status: StatusMembro.ATIVO,
            },
          },
        });

        if (!leadership) {
          throw new ForbiddenException(
            'Você não tem permissão para enviar comunicados para este ministério.',
          );
        }
      }
    } else if (dto.tipoPublico === NotificationAudienceType.ALL_MEMBERS) {
      if (user.role === Role.BASIC) {
        throw new ForbiddenException(
          'Apenas administradores podem enviar comunicados gerais.',
        );
      }
    } else if (dto.tipoPublico === NotificationAudienceType.SPECIFIC_USERS) {
      if (!dto.userIds || dto.userIds.length === 0) {
        throw new BadRequestException(
          'A lista de usuários destinatários é obrigatória.',
        );
      }
      if (user.role === Role.BASIC) {
        throw new ForbiddenException(
          'Apenas administradores ou líderes podem enviar notificações direcionadas.',
        );
      }
      if (dto.ministerioId) {
        origem = NotificationOrigin.COMMUNICATION_MINISTRY;
      }
    }

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : new Date();

    return this.createNotification({
      tenantId,
      titulo: dto.titulo,
      mensagem: dto.mensagem,
      urlDestino: dto.urlDestino || '/personal-panel',
      origem,
      tipoPublico: dto.tipoPublico,
      ministerioId: dto.ministerioId || null,
      scheduledAt,
      criadoPorId: user.sub,
      userIds: dto.userIds,
    });
  }
}
