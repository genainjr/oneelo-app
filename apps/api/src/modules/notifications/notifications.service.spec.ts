import { UserStatus } from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService birthday job', () => {
  it('envia mensagem pessoal ao aniversariante e coletiva aos demais membros', async () => {
    const prisma = {
      membro: {
        findMany: jest.fn().mockResolvedValue([
          {
            tenantId: 'tenant-1',
            nome: 'Joao da Silva',
            nomeExibicao: 'Joao',
            dataNascimento: new Date('1990-07-16T00:00:00.000Z'),
            tenant: { nome: 'Igreja Esperanca' },
            user: {
              id: 'birthday-user',
              ativo: true,
              status: UserStatus.ACTIVE,
            },
          },
          {
            tenantId: 'tenant-1',
            nome: 'Maria Souza',
            nomeExibicao: null,
            dataNascimento: new Date('1992-07-17T00:00:00.000Z'),
            tenant: { nome: 'Igreja Esperanca' },
            user: { id: 'other-user', ativo: true, status: UserStatus.ACTIVE },
          },
        ]),
      },
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'birthday-user' }, { id: 'other-user' }]),
      },
    };
    const config = { get: jest.fn() };
    const service = new NotificationsService(prisma as never, config as never);
    const sendSpy = jest.spyOn(service, 'sendToUsers').mockResolvedValue({
      sent: 1,
      failed: 0,
      total: 1,
    });

    const result = await service.runBirthdayNotificationJob(
      new Date('2026-07-16T11:00:00.000Z'),
    );

    expect(sendSpy).toHaveBeenNthCalledWith(
      1,
      'tenant-1',
      ['birthday-user'],
      {
        title: 'Hoje é o seu dia, Joao! \ud83c\udf82',
        body: 'Feliz aniversário! Que este novo ciclo seja cheio de fé, alegria e boas histórias ao lado da família Igreja Esperanca.',
        url: '/personal-panel',
      },
    );
    expect(sendSpy).toHaveBeenNthCalledWith(
      2,
      'tenant-1',
      ['other-user'],
      {
        title: 'Hoje tem aniversário na Igreja Esperanca! \ud83c\udf89',
        body: 'Joao está celebrando mais um ano de vida. Que tal enviar uma mensagem especial?',
        url: '/personal-panel',
      },
    );
    expect(result.birthdayMembers).toBe(1);
    expect(result.personalNotifications).toBe(1);
    expect(result.communityNotifications).toBe(1);
    expect(result.sent).toBe(2);
  });

  it('enfileira notificacao via NotificationDispatchService quando disponivel', async () => {
    const prisma = {
      membro: {
        findMany: jest.fn().mockResolvedValue([
          {
            tenantId: 'tenant-1',
            nome: 'Joao da Silva',
            nomeExibicao: 'Joao',
            dataNascimento: new Date('1990-07-16T00:00:00.000Z'),
            tenant: { nome: 'Igreja Esperanca' },
            user: {
              id: 'birthday-user',
              ativo: true,
              status: UserStatus.ACTIVE,
            },
          },
        ]),
      },
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'birthday-user' }, { id: 'other-user' }]),
      },
    };
    const config = { get: jest.fn() };
    const notificationDispatch = {
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    const service = new NotificationsService(
      prisma as never,
      config as never,
      notificationDispatch as never,
    );

    const result = await service.runBirthdayNotificationJob(
      new Date('2026-07-16T11:00:00.000Z'),
    );

    expect(notificationDispatch.createNotification).toHaveBeenCalledTimes(2);
    expect(notificationDispatch.createNotification).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        tenantId: 'tenant-1',
        origem: 'SYSTEM_AUTOMATION',
        idempotencyKey: 'tenant:tenant-1:membro:birthday-user:birthday-personal:2026',
        userIds: ['birthday-user'],
      }),
    );
    expect(result.personalNotifications).toBe(1);
    expect(result.communityNotifications).toBe(1);
  });

  describe('runPendingConfirmationReminderJob', () => {
    it('enfileira lembrete de confirmacao 24h via NotificationDispatchService', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const prisma = {
        escalaItem: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'item-1',
              membro: { user: { id: 'user-1', ativo: true } },
              escalaDia: {
                data: tomorrow,
                escala: {
                  tenantId: 'tenant-1',
                  ministerio: { nome: 'Louvor' },
                },
              },
            },
          ]),
        },
      };
      const notificationDispatch = {
        createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      };

      const service = new NotificationsService(
        prisma as never,
        { get: jest.fn() } as never,
        notificationDispatch as never,
      );

      const result = await service.runPendingConfirmationReminderJob();

      expect(notificationDispatch.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          origem: 'SYSTEM_AUTOMATION',
          userIds: ['user-1'],
        }),
      );
      expect(result.sent).toBe(1);
    });
  });

  describe('runScheduleDayReminderJob', () => {
    it('enfileira lembrete do dia da escala via NotificationDispatchService', async () => {
      const today = new Date();
      const prisma = {
        escalaItem: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'item-2',
              membro: { user: { id: 'user-2', ativo: true } },
              escalaDia: {
                data: today,
                evento: { dataInicio: today },
                escala: {
                  tenantId: 'tenant-1',
                  ministerio: { nome: 'Midia' },
                },
              },
            },
          ]),
        },
      };
      const notificationDispatch = {
        createNotification: jest.fn().mockResolvedValue({ id: 'notif-2' }),
      };

      const service = new NotificationsService(
        prisma as never,
        { get: jest.fn() } as never,
        notificationDispatch as never,
      );

      const result = await service.runScheduleDayReminderJob();

      expect(notificationDispatch.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          origem: 'SYSTEM_AUTOMATION',
          userIds: ['user-2'],
        }),
      );
      expect(result.sent).toBe(1);
    });
  });
});
