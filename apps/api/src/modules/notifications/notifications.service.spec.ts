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

    it('nao envia notificacao se a regra estiver desativada pelo tenant', async () => {
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
      const automationRules = {
        getRuleByType: jest.fn().mockResolvedValue({
          ativo: false,
          titulo: 'Ignorado',
          mensagem: 'Ignorado',
        }),
      };

      const service = new NotificationsService(
        prisma as never,
        { get: jest.fn() } as never,
        notificationDispatch as never,
        automationRules as never,
      );

      const result = await service.runPendingConfirmationReminderJob();

      expect(notificationDispatch.createNotification).not.toHaveBeenCalled();
      expect(result.sent).toBe(0);
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

    it('aplica template customizado da regra de escala do dia', async () => {
      const today = new Date();
      const prisma = {
        escalaItem: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'item-2',
              membro: {
                nome: 'Lucas Silva',
                user: { id: 'user-2', ativo: true },
              },
              escalaDia: {
                data: today,
                evento: { dataInicio: today },
                escala: {
                  tenantId: 'tenant-1',
                  ministerio: { nome: 'Teatro' },
                },
              },
            },
          ]),
        },
      };
      const notificationDispatch = {
        createNotification: jest.fn().mockResolvedValue({ id: 'notif-2' }),
      };
      const automationRules = {
        getRuleByType: jest.fn().mockResolvedValue({
          ativo: true,
          titulo: 'Atenção, {nome}!',
          mensagem: 'Lembre-se de sua escala no {ministerio}.',
        }),
      };

      const service = new NotificationsService(
        prisma as never,
        { get: jest.fn() } as never,
        notificationDispatch as never,
        automationRules as never,
      );

      const result = await service.runScheduleDayReminderJob();

      expect(notificationDispatch.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          titulo: 'Atenção, Lucas Silva!',
          mensagem: 'Lembre-se de sua escala no Teatro.',
        }),
      );
      expect(result.sent).toBe(1);
    });
  });

  describe('executeInternalCron', () => {
    const validKey = 'super-secret-cron-token-12345';

    it('lanca UnauthorizedException se a chave nao estiver configurada ou header for nulo', async () => {
      const config = { get: jest.fn().mockReturnValue(undefined) };
      const service = new NotificationsService({} as never, config as never);

      await expect(service.executeInternalCron(undefined)).rejects.toThrow(
        'Chave de API interna inválida ou não configurada.',
      );
      await expect(service.executeInternalCron('any-key')).rejects.toThrow(
        'Chave de API interna inválida ou não configurada.',
      );
    });

    it('lanca UnauthorizedException se o header for incorreto ou tiver tamanho diferente', async () => {
      const config = {
        get: jest.fn((key: string) =>
          key === 'INTERNAL_CRON_API_KEY' ? validKey : undefined,
        ),
      };
      const service = new NotificationsService({} as never, config as never);

      await expect(service.executeInternalCron('wrong-key')).rejects.toThrow(
        'Chave de API interna inválida ou não configurada.',
      );
      await expect(
        service.executeInternalCron('super-secret-cron-token-12349'),
      ).rejects.toThrow('Chave de API interna inválida ou não configurada.');
    });

    it('executa todos os jobs e aciona queueProcessor quando job for "all"', async () => {
      const config = {
        get: jest.fn((key: string) =>
          key === 'INTERNAL_CRON_API_KEY' ? validKey : undefined,
        ),
      };
      const queueProcessor = { triggerImmediateProcessing: jest.fn() };
      const service = new NotificationsService(
        {} as never,
        config as never,
        undefined,
        undefined,
        queueProcessor as never,
      );

      jest
        .spyOn(service, 'runBirthdayNotificationJob')
        .mockResolvedValue({ birthdays: 1 } as never);
      jest
        .spyOn(service, 'runPendingConfirmationReminderJob')
        .mockResolvedValue({ confirmations: 2 } as never);
      jest
        .spyOn(service, 'runScheduleDayReminderJob')
        .mockResolvedValue({ schedule: 3 } as never);

      const result = await service.executeInternalCron(validKey, 'all');

      expect(result.success).toBe(true);
      expect(result.job).toBe('all');
      expect(result.results.birthdays).toEqual({ birthdays: 1 });
      expect(result.results.confirmations24h).toEqual({ confirmations: 2 });
      expect(result.results.scheduleDay).toEqual({ schedule: 3 });
      expect(queueProcessor.triggerImmediateProcessing).toHaveBeenCalledTimes(1);
    });

    it('executa apenas birthdays quando job for "birthdays"', async () => {
      const config = {
        get: jest.fn((key: string) =>
          key === 'INTERNAL_CRON_API_KEY' ? validKey : undefined,
        ),
      };
      const queueProcessor = { triggerImmediateProcessing: jest.fn() };
      const service = new NotificationsService(
        {} as never,
        config as never,
        undefined,
        undefined,
        queueProcessor as never,
      );

      jest
        .spyOn(service, 'runBirthdayNotificationJob')
        .mockResolvedValue({ birthdays: 1 } as never);
      const confSpy = jest.spyOn(service, 'runPendingConfirmationReminderJob');
      const schedSpy = jest.spyOn(service, 'runScheduleDayReminderJob');

      const result = await service.executeInternalCron(validKey, 'birthdays');

      expect(result.success).toBe(true);
      expect(result.job).toBe('birthdays');
      expect(result.results.birthdays).toBeDefined();
      expect(confSpy).not.toHaveBeenCalled();
      expect(schedSpy).not.toHaveBeenCalled();
      expect(queueProcessor.triggerImmediateProcessing).toHaveBeenCalledTimes(1);
    });

    it('aciona apenas a fila quando job for "queue"', async () => {
      const config = {
        get: jest.fn((key: string) =>
          key === 'INTERNAL_CRON_API_KEY' ? validKey : undefined,
        ),
      };
      const queueProcessor = { triggerImmediateProcessing: jest.fn() };
      const service = new NotificationsService(
        {} as never,
        config as never,
        undefined,
        undefined,
        queueProcessor as never,
      );

      const bdaySpy = jest.spyOn(service, 'runBirthdayNotificationJob');

      const result = await service.executeInternalCron(validKey, 'queue');

      expect(result.success).toBe(true);
      expect(result.job).toBe('queue');
      expect(result.results.queue).toEqual({ triggered: true });
      expect(bdaySpy).not.toHaveBeenCalled();
      expect(queueProcessor.triggerImmediateProcessing).toHaveBeenCalledTimes(1);
    });
  });
});
