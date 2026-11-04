import { Test, TestingModule } from '@nestjs/testing';
import { NotificationDispatchService } from './notification-dispatch.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  NotificationOrigin,
  NotificationAudienceType,
  NotificationStatus,
  RecipientDeliveryStatus,
  Prisma,
} from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('NotificationDispatchService', () => {
  let service: NotificationDispatchService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      notification: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      ministerioMembro: {
        findMany: jest.fn(),
      },
      pushSubscription: {
        findMany: jest.fn(),
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
});
