import { Test, TestingModule } from '@nestjs/testing';
import {
  NotificationQueueProcessorService,
  ClaimedRecipientRow,
} from './notification-queue-processor.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  NotificationStatus,
  RecipientDeliveryStatus,
} from '@prisma/client';

describe('NotificationQueueProcessorService', () => {
  let service: NotificationQueueProcessorService;
  let prisma: any;
  let configService: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prisma)),
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      pushSubscription: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      notificationRecipient: {
        update: jest.fn(),
        groupBy: jest.fn(),
      },
      notification: {
        update: jest.fn(),
      },
    };

    configService = {
      get: jest.fn().mockReturnValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationQueueProcessorService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<NotificationQueueProcessorService>(
      NotificationQueueProcessorService,
    );
  });

  describe('claimBatch', () => {
    it('deve retornar array vazio se nenhuma notificação estiver pendente', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.claimBatch();

      expect(result).toEqual([]);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('deve bloquear atômica e temporariamente os itens retornados marcando PROCESSING', async () => {
      const mockRows: ClaimedRecipientRow[] = [
        {
          id: 'rec-1',
          notification_id: 'notif-1',
          user_id: 'user-1',
          attempt_count: 0,
          tenant_id: 'tenant-1',
          title: 'Culto',
          message: 'Início às 19h',
          target_url: null,
        },
      ];

      prisma.$queryRaw.mockResolvedValue(mockRows);

      const result = await service.claimBatch();

      expect(result).toEqual(mockRows);
      // Deve ter executado os 2 updates (recipient locked_until e notification PROCESSING)
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    });
  });

  describe('deliverRecipient', () => {
    const item: ClaimedRecipientRow = {
      id: 'rec-1',
      notification_id: 'notif-1',
      user_id: 'user-1',
      attempt_count: 0,
      tenant_id: 'tenant-1',
      title: 'Aviso',
      message: 'Mensagem',
      target_url: '/escalas',
    };

    it('deve marcar NO_SUBSCRIPTION se o usuário não possuir assinatura push ativa', async () => {
      prisma.pushSubscription.findMany.mockResolvedValue([]);

      await service.deliverRecipient(item);

      expect(prisma.notificationRecipient.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: expect.objectContaining({
          status: RecipientDeliveryStatus.NO_SUBSCRIPTION,
          lockedUntil: null,
        }),
      });
    });

    it('deve marcar SENT e salvar enviadoEm ao enviar push com sucesso', async () => {
      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: 'sub-1', endpoint: 'https://push.example.com/1', p256dh: 'k1', auth: 'a1' },
      ]);

      jest.spyOn(service, 'sendPush').mockResolvedValue({} as any);

      await service.deliverRecipient(item);

      expect(prisma.notificationRecipient.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: expect.objectContaining({
          status: RecipientDeliveryStatus.SENT,
          enviadoEm: expect.any(Date),
          lockedUntil: null,
          ultimoErro: null,
        }),
      });
    });

    it('deve desativar subscription em caso de 410 Gone e marcar FAILED_PERMANENT se não houver outras ativas', async () => {
      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: 'sub-expirada', endpoint: 'https://push.example.com/exp', p256dh: 'k1', auth: 'a1' },
      ]);

      const goneError = { statusCode: 410, message: 'Gone' };
      jest.spyOn(service, 'sendPush').mockRejectedValue(goneError);

      await service.deliverRecipient(item);

      // Desativa assinatura no banco
      expect(prisma.pushSubscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-expirada' },
        data: { ativo: false },
      });

      // Marca recipient como FAILED_PERMANENT
      expect(prisma.notificationRecipient.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: expect.objectContaining({
          status: RecipientDeliveryStatus.FAILED_PERMANENT,
          lockedUntil: null,
          tentativas: 1,
        }),
      });
    });

    it('deve incrementar tentativa e marcar FAILED_RETRYABLE em erro temporário de rede', async () => {
      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: 'sub-1', endpoint: 'https://push.example.com/1', p256dh: 'k1', auth: 'a1' },
      ]);

      const netError = { statusCode: 503, message: 'Service Unavailable' };
      jest.spyOn(service, 'sendPush').mockRejectedValue(netError);

      await service.deliverRecipient(item);

      expect(prisma.notificationRecipient.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: expect.objectContaining({
          status: RecipientDeliveryStatus.FAILED_RETRYABLE,
          tentativas: 1,
          lockedUntil: expect.any(Date),
        }),
      });
    });

    it('deve marcar FAILED_PERMANENT se o número de tentativas atingir o limite de 3', async () => {
      const itemExceeded: ClaimedRecipientRow = {
        ...item,
        attempt_count: 2, // próxima será 3
      };

      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: 'sub-1', endpoint: 'https://push.example.com/1', p256dh: 'k1', auth: 'a1' },
      ]);

      const netError = { statusCode: 500, message: 'Internal Server Error' };
      jest.spyOn(service, 'sendPush').mockRejectedValue(netError);

      await service.deliverRecipient(itemExceeded);

      expect(prisma.notificationRecipient.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: expect.objectContaining({
          status: RecipientDeliveryStatus.FAILED_PERMANENT,
          tentativas: 3,
          lockedUntil: null,
        }),
      });
    });
  });

  describe('updateNotificationCompletionStatus', () => {
    it('não deve finalizar notificação se ainda houver destinatários PENDING ou FAILED_RETRYABLE', async () => {
      prisma.notificationRecipient.groupBy.mockResolvedValue([
        { status: RecipientDeliveryStatus.PENDING, _count: { id: 2 } },
        { status: RecipientDeliveryStatus.SENT, _count: { id: 3 } },
      ]);

      await service.updateNotificationCompletionStatus('notif-1');

      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('deve marcar Notification como COMPLETED quando todos os destinatários forem finalizados e houver sucesso', async () => {
      prisma.notificationRecipient.groupBy.mockResolvedValue([
        { status: RecipientDeliveryStatus.SENT, _count: { id: 5 } },
        { status: RecipientDeliveryStatus.FAILED_PERMANENT, _count: { id: 1 } },
      ]);

      await service.updateNotificationCompletionStatus('notif-1');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { status: NotificationStatus.COMPLETED },
      });
    });

    it('deve marcar Notification como FAILED quando todos os destinatários falharem', async () => {
      prisma.notificationRecipient.groupBy.mockResolvedValue([
        { status: RecipientDeliveryStatus.FAILED_PERMANENT, _count: { id: 4 } },
      ]);

      await service.updateNotificationCompletionStatus('notif-2');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-2' },
        data: { status: NotificationStatus.FAILED },
      });
    });
  });
});
