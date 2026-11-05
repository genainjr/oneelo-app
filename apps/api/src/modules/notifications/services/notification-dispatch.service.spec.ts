import { Test, TestingModule } from '@nestjs/testing';
import { NotificationDispatchService } from './notification-dispatch.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  NotificationOrigin,
  NotificationAudienceType,
  NotificationStatus,
  RecipientDeliveryStatus,
  Role,
  Prisma,
} from '@prisma/client';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

describe('NotificationDispatchService', () => {
  let service: NotificationDispatchService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      notification: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      notificationRecipient: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        updateMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      ministerioMembro: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      pushSubscription: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      userNotificationPreference: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDispatchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationDispatchService>(NotificationDispatchService);
  });

  describe('createNotification - Validações e Idempotência', () => {
    it('deve lançar erro se tenantId não for informado', async () => {
      await expect(
        service.createNotification({
          tenantId: '',
          titulo: 'Alerta',
          mensagem: 'Corpo',
          origem: NotificationOrigin.SYSTEM_AUTOMATION,
          tipoPublico: NotificationAudienceType.ALL_MEMBERS,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar erro se titulo ou mensagem estiverem vazios', async () => {
      await expect(
        service.createNotification({
          tenantId: 'tenant-1',
          titulo: '',
          mensagem: 'Corpo',
          origem: NotificationOrigin.SYSTEM_AUTOMATION,
          tipoPublico: NotificationAudienceType.ALL_MEMBERS,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve retornar notificação existente se idempotencyKey já existir (idempotência transparente)', async () => {
      const existingNotification = {
        id: 'notif-existente-1',
        tenantId: 'tenant-1',
        titulo: 'Escala Publicada',
        idempotencyKey: 'escala:123:published',
        destinatarios: [{ id: 'rec-1', userId: 'user-1' }],
      };

      prisma.notification.findUnique.mockResolvedValue(existingNotification);

      const result = await service.createNotification({
        tenantId: 'tenant-1',
        titulo: 'Escala Publicada',
        mensagem: 'Sua escala foi publicada',
        origem: NotificationOrigin.SYSTEM_AUTOMATION,
        tipoPublico: NotificationAudienceType.SPECIFIC_USERS,
        idempotencyKey: 'escala:123:published',
        userIds: ['user-1'],
      });

      expect(result).toEqual(existingNotification);
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('deve recuperar notificação existente em caso de corrida P2002 na chave de idempotência', async () => {
      prisma.notification.findUnique
        .mockResolvedValueOnce(null) // primeiro check
        .mockResolvedValueOnce({ id: 'notif-corrida-1' }); // pós P2002

      prisma.user.findMany.mockResolvedValue([{ id: 'user-1' }]);
      prisma.pushSubscription.findMany.mockResolvedValue([]);

      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint violation',
        { code: 'P2002', clientVersion: '5.22.0' },
      );
      prisma.notification.create.mockRejectedValue(p2002Error);

      const result = await service.createNotification({
        tenantId: 'tenant-1',
        titulo: 'Lembrete',
        mensagem: 'Evento',
        origem: NotificationOrigin.SYSTEM_AUTOMATION,
        tipoPublico: NotificationAudienceType.SPECIFIC_USERS,
        idempotencyKey: 'evento:456:reminder',
        userIds: ['user-1'],
      });

      expect(result).toEqual({ id: 'notif-corrida-1' });
    });
  });

  describe('createNotification - Materialização de Destinatários e Subscriptions', () => {
    it('deve materializar destinatários SPECIFIC_USERS marcando PENDING para quem tem push e NO_SUBSCRIPTION para quem não tem', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([{ id: 'user-com-push' }, { id: 'user-sem-push' }]);
      prisma.pushSubscription.findMany.mockResolvedValue([{ userId: 'user-com-push' }]);

      prisma.notification.create.mockImplementation(({ data }: any) => ({
        id: 'notif-created-1',
        ...data,
      }));

      await service.createNotification({
        tenantId: 'tenant-1',
        titulo: 'Aviso Importante',
        mensagem: 'Mensagem do comunicado',
        origem: NotificationOrigin.COMMUNICATION_GENERAL,
        tipoPublico: NotificationAudienceType.SPECIFIC_USERS,
        userIds: ['user-com-push', 'user-sem-push'],
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          titulo: 'Aviso Importante',
          status: NotificationStatus.SCHEDULED,
          destinatarios: {
            createMany: {
              data: [
                { userId: 'user-com-push', status: RecipientDeliveryStatus.PENDING },
                { userId: 'user-sem-push', status: RecipientDeliveryStatus.NO_SUBSCRIPTION },
              ],
            },
          },
        }),
        include: { destinatarios: true },
      });
    });

    it('deve buscar todos os membros ativos para ALL_MEMBERS', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]);
      prisma.pushSubscription.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);
      prisma.notification.create.mockResolvedValue({ id: 'notif-all' });

      await service.createNotification({
        tenantId: 'tenant-1',
        titulo: 'Geral',
        mensagem: 'Todos',
        origem: NotificationOrigin.COMMUNICATION_GENERAL,
        tipoPublico: NotificationAudienceType.ALL_MEMBERS,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          ativo: true,
        }),
        select: { id: true },
      });
    });

    it('deve buscar membros vinculados ao ministério para público MINISTRY', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      prisma.ministerioMembro.findMany.mockResolvedValue([
        { membro: { user: { id: 'user-louvor-1' } } },
        { membro: { user: { id: 'user-louvor-2' } } },
      ]);
      prisma.pushSubscription.findMany.mockResolvedValue([]);
      prisma.notification.create.mockResolvedValue({ id: 'notif-min' });

      await service.createNotification({
        tenantId: 'tenant-1',
        titulo: 'Ensaio',
        mensagem: 'Amanhã',
        origem: NotificationOrigin.COMMUNICATION_MINISTRY,
        tipoPublico: NotificationAudienceType.MINISTRY,
        ministerioId: 'min-1',
      });

      expect(prisma.ministerioMembro.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          ministerioId: 'min-1',
          ministerio: { tenantId: 'tenant-1' },
        }),
        select: expect.any(Object),
      });
    });

    it('deve marcar status COMPLETED se não houver destinatários para a notificação', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.pushSubscription.findMany.mockResolvedValue([]);
      prisma.notification.create.mockImplementation(({ data }: any) => ({ id: 'notif-empty', ...data }));

      await service.createNotification({
        tenantId: 'tenant-1',
        titulo: 'Vazio',
        mensagem: 'Sem público',
        origem: NotificationOrigin.COMMUNICATION_GENERAL,
        tipoPublico: NotificationAudienceType.ALL_MEMBERS,
      });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: NotificationStatus.COMPLETED,
          }),
        }),
      );
    });

    it('deve excluir destinatários que desativaram a categoria nas preferências pessoais', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-comum' },
        { id: 'user-que-desativou-aniversarios' },
      ]);
      prisma.userNotificationPreference.findMany.mockResolvedValue([
        { userId: 'user-que-desativou-aniversarios' },
      ]);
      prisma.pushSubscription.findMany.mockResolvedValue([
        { userId: 'user-comum' },
      ]);
      prisma.notification.create.mockImplementation(({ data }: any) => ({
        id: 'notif-filtered',
        ...data,
      }));

      await service.createNotification({
        tenantId: 'tenant-1',
        titulo: 'Aniversariantes',
        mensagem: 'Parabéns aos aniversariantes',
        origem: NotificationOrigin.SYSTEM_AUTOMATION,
        tipoPublico: NotificationAudienceType.ALL_MEMBERS,
        idempotencyKey: 'tenant:tenant-1:birthday-community:2026-11-04',
      });

      expect(prisma.userNotificationPreference.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          OR: [{ notifyBirthdays: false }],
        }),
        select: expect.any(Object),
      });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            destinatarios: {
              createMany: {
                data: [
                  {
                    userId: 'user-comum',
                    status: RecipientDeliveryStatus.PENDING,
                  },
                ],
              },
            },
          }),
        }),
      );
    });
  });

  describe('rescheduleNotification e cancelNotification', () => {
    it('deve reagendar notificação pendente', async () => {
      prisma.notification.findFirst.mockResolvedValue({
        id: 'notif-1',
        tenantId: 'tenant-1',
        status: NotificationStatus.SCHEDULED,
      });
      prisma.notification.update.mockResolvedValue({ id: 'notif-1', status: NotificationStatus.SCHEDULED });

      const newDate = new Date('2026-12-01T10:00:00Z');
      await service.rescheduleNotification('notif-1', 'tenant-1', newDate);

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: {
          scheduledAt: newDate,
          status: NotificationStatus.SCHEDULED,
        },
      });
    });

    it('deve cancelar notificação agendada', async () => {
      prisma.notification.findFirst.mockResolvedValue({
        id: 'notif-2',
        tenantId: 'tenant-1',
        status: NotificationStatus.SCHEDULED,
      });
      prisma.notification.update.mockResolvedValue({ id: 'notif-2', status: NotificationStatus.CANCELED });

      await service.cancelNotification('notif-2', 'tenant-1');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-2' },
        data: { status: NotificationStatus.CANCELED },
      });
    });

    it('não deve alterar notificação se já estiver COMPLETED', async () => {
      prisma.notification.findFirst.mockResolvedValue({
        id: 'notif-3',
        tenantId: 'tenant-1',
        status: NotificationStatus.COMPLETED,
      });

      await service.cancelNotification('notif-3', 'tenant-1');
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException se notificação não existir', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(service.cancelNotification('notif-inexistente', 'tenant-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listNotifications', () => {
    it('deve listar notificações paginadas com filtros e métricas do tenant', async () => {
      prisma.notification.count.mockResolvedValue(1);
      prisma.notification.findMany.mockResolvedValue([
        {
          id: 'notif-1',
          tenantId: 'tenant-1',
          titulo: 'Alerta Geral',
          mensagem: 'Culto hoje',
          scheduledAt: new Date(),
          status: 'COMPLETED',
          destinatarios: [
            { status: 'SENT' },
            { status: 'FAILED_RETRYABLE' },
            { status: 'NO_SUBSCRIPTION' },
          ],
        },
      ]);
      prisma.notificationRecipient.groupBy.mockResolvedValue([
        { status: 'SENT', _count: { status: 10 } },
        { status: 'PENDING', _count: { status: 2 } },
        { status: 'FAILED_RETRYABLE', _count: { status: 3 } },
        { status: 'NO_SUBSCRIPTION', _count: { status: 5 } },
      ]);

      const result = await service.listNotifications('tenant-1', {
        page: 1,
        limit: 10,
        status: NotificationStatus.COMPLETED,
        search: 'Culto',
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            status: NotificationStatus.COMPLETED,
          }),
          skip: 0,
          take: 10,
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].deliveryStats).toEqual({
        total: 3,
        sent: 1,
        pending: 0,
        failed: 1,
        noSubscription: 1,
      });
      expect(result.metrics).toEqual({
        totalSent: 10,
        totalPending: 2,
        totalFailed: 3,
        totalNoSubscription: 5,
      });
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('deve restringir listagem aos ministérios do líder quando user for BASIC', async () => {
      prisma.ministerioMembro.findMany.mockResolvedValue([
        { ministerioId: 'min-lider-1' },
      ]);
      prisma.notification.count.mockResolvedValue(1);
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notificationRecipient.groupBy.mockResolvedValue([]);

      await service.listNotifications(
        'tenant-1',
        { page: 1, limit: 10 },
        { sub: 'user-leader-1', role: Role.BASIC, tenantId: 'tenant-1' },
      );

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            ministerioId: { in: ['min-lider-1'] },
          }),
        }),
      );
    });

    it('deve retornar lista vazia se líder BASIC não tiver ministérios', async () => {
      prisma.ministerioMembro.findMany.mockResolvedValue([]);

      const result = await service.listNotifications(
        'tenant-1',
        {},
        { sub: 'user-basic-sem-lideranca', role: Role.BASIC, tenantId: 'tenant-1' },
      );

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('getNotificationById', () => {
    it('deve retornar detalhes da notificação com destinatários paginados', async () => {
      prisma.notification.findFirst.mockResolvedValue({
        id: 'notif-1',
        tenantId: 'tenant-1',
        titulo: 'Aviso',
      });
      prisma.notificationRecipient.count.mockResolvedValue(1);
      prisma.notificationRecipient.findMany.mockResolvedValue([
        {
          id: 'recip-1',
          userId: 'user-1',
          status: 'SENT',
          tentativas: 1,
          ultimoErro: null,
          enviadoEm: new Date(),
          createdAt: new Date(),
          user: {
            id: 'user-1',
            nome: 'Carlos',
            email: 'carlos@teste.com',
            membro: { nome: 'Carlos Membro', nomeExibicao: 'Carlinhos' },
          },
        },
      ]);
      prisma.notificationRecipient.groupBy.mockResolvedValue([
        { status: 'SENT', _count: { status: 1 } },
      ]);

      const result = await service.getNotificationById('tenant-1', 'notif-1', {
        page: 1,
        limit: 20,
      });

      expect(result.notification.id).toBe('notif-1');
      expect(result.stats.sent).toBe(1);
      expect(result.recipients.data[0].userName).toBe('Carlinhos');
      expect(result.recipients.data[0].userEmail).toBe('carlos@teste.com');
    });

    it('deve lançar NotFoundException se notificação pertencer a outro tenant', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.getNotificationById('tenant-outro', 'notif-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve lançar ForbiddenException se líder BASIC tentar ver notificação de ministério alheio', async () => {
      prisma.notification.findFirst.mockResolvedValue({
        id: 'notif-1',
        tenantId: 'tenant-1',
        ministerioId: 'min-outro',
      });
      prisma.ministerioMembro.findMany.mockResolvedValue([
        { ministerioId: 'meu-min' },
      ]);

      await expect(
        service.getNotificationById(
          'tenant-1',
          'notif-1',
          {},
          { sub: 'user-lider', role: Role.BASIC, tenantId: 'tenant-1' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('retryFailedRecipients', () => {
    it('deve resetar apenas destinatários em falha e reagendar notificação', async () => {
      prisma.notification.findFirst.mockResolvedValue({
        id: 'notif-1',
        tenantId: 'tenant-1',
      });
      prisma.notificationRecipient.updateMany.mockResolvedValue({ count: 2 });
      prisma.notification.update.mockResolvedValue({ id: 'notif-1' });

      const result = await service.retryFailedRecipients('tenant-1', 'notif-1');

      expect(prisma.notificationRecipient.updateMany).toHaveBeenCalledWith({
        where: {
          notificationId: 'notif-1',
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
      expect(prisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'notif-1' },
          data: expect.objectContaining({ status: NotificationStatus.SCHEDULED }),
        }),
      );
      expect(result).toEqual({ success: true, retriedCount: 2 });
    });
  });

  describe('createManualNotification', () => {
    const adminUser = {
      sub: 'admin-id',
      email: 'admin@oneelo.com',
      role: 'ADMIN' as any,
      tenantId: 'tenant-1',
    };

    const basicUser = {
      sub: 'basic-id',
      email: 'basic@oneelo.com',
      role: 'BASIC' as any,
      tenantId: 'tenant-1',
    };

    it('deve permitir ADMIN criar comunicado geral ALL_MEMBERS', async () => {
      jest.spyOn(service, 'createNotification').mockResolvedValue({ id: 'notif-manual' } as any);

      const result = await service.createManualNotification('tenant-1', adminUser, {
        titulo: 'Aviso importante',
        mensagem: 'Reunião geral',
        tipoPublico: NotificationAudienceType.ALL_MEMBERS,
      });

      expect(service.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          origem: NotificationOrigin.COMMUNICATION_GENERAL,
          tipoPublico: NotificationAudienceType.ALL_MEMBERS,
          criadoPorId: 'admin-id',
        }),
      );
      expect(result.id).toBe('notif-manual');
    });

    it('deve rejeitar se BASIC tentar criar comunicado ALL_MEMBERS', async () => {
      await expect(
        service.createManualNotification('tenant-1', basicUser, {
          titulo: 'Aviso geral',
          mensagem: 'Olá a todos',
          tipoPublico: NotificationAudienceType.ALL_MEMBERS,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve rejeitar público MINISTRY sem ministerioId', async () => {
      await expect(
        service.createManualNotification('tenant-1', adminUser, {
          titulo: 'Aviso ministério',
          mensagem: 'Treinamento',
          tipoPublico: NotificationAudienceType.MINISTRY,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve permitir líder ministerial criar comunicado para seu ministério', async () => {
      prisma.ministerioMembro.findFirst.mockResolvedValue({ id: 'mm-lead' });
      jest.spyOn(service, 'createNotification').mockResolvedValue({ id: 'notif-min' } as any);

      const result = await service.createManualNotification('tenant-1', basicUser, {
        titulo: 'Aviso Louvor',
        mensagem: 'Ensaio quinta',
        tipoPublico: NotificationAudienceType.MINISTRY,
        ministerioId: 'min-1',
      });

      expect(service.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          origem: NotificationOrigin.COMMUNICATION_MINISTRY,
          ministerioId: 'min-1',
        }),
      );
      expect(result.id).toBe('notif-min');
    });

    it('deve bloquear membro que não lidera o ministério', async () => {
      prisma.ministerioMembro.findFirst.mockResolvedValue(null);

      await expect(
        service.createManualNotification('tenant-1', basicUser, {
          titulo: 'Aviso Louvor',
          mensagem: 'Ensaio quinta',
          tipoPublico: NotificationAudienceType.MINISTRY,
          ministerioId: 'min-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
