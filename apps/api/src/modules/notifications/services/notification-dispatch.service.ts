import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  NotificationOrigin,
  NotificationAudienceType,
  NotificationStatus,
  RecipientDeliveryStatus,
  UserStatus,
  StatusMembro,
} from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';

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
}
