import { Test, TestingModule } from '@nestjs/testing';
import {
  NotificationAutomationRulesService,
  DEFAULT_AUTOMATION_RULES,
  renderTemplate,
} from './notification-automation-rules.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotificationAutomationType } from '@prisma/client';

describe('NotificationAutomationRulesService', () => {
  let service: NotificationAutomationRulesService;
  let prisma: {
    notificationAutomationRule: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
    userNotificationPreference: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const tenantId = 'tenant-123';

  beforeEach(async () => {
    prisma = {
      notificationAutomationRule: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      userNotificationPreference: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(({ create, update }) =>
          Promise.resolve({
            userId: 'user-1',
            tenantId,
            notifyBirthdays: true,
            notifyEvents: true,
            notifySchedules: true,
            ...create,
            ...update,
          }),
        ),
      },
      $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationAutomationRulesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<NotificationAutomationRulesService>(
      NotificationAutomationRulesService,
    );
  });

  describe('renderTemplate', () => {
    it('should replace dynamic variables correctly', () => {
      const template = 'Olá {nome}, bem-vindo à {igreja}!';
      const result = renderTemplate(template, {
        nome: 'João',
        igreja: 'Igreja Central',
      });
      expect(result).toBe('Olá João, bem-vindo à Igreja Central!');
    });

    it('should keep untouched variables that are not supplied', () => {
      const template = 'Escala de {ministerio} às {horario}';
      const result = renderTemplate(template, {
        ministerio: 'Louvor',
      });
      expect(result).toBe('Escala de Louvor às {horario}');
    });

    it('should handle empty or null template safely', () => {
      expect(renderTemplate('', { nome: 'João' })).toBe('');
    });
  });

  describe('getRules', () => {
    it('should return all 5 default rules when no database records exist', async () => {
      prisma.notificationAutomationRule.findMany.mockResolvedValue([]);

      const rules = await service.getRules(tenantId);
      expect(rules).toHaveLength(5);

      const birthdayPersonal = rules.find(
        (r) => r.tipo === NotificationAutomationType.BIRTHDAY_PERSONAL,
      );
      expect(birthdayPersonal).toBeDefined();
      expect(birthdayPersonal?.isCustom).toBe(false);
      expect(birthdayPersonal?.ativo).toBe(true);
      expect(birthdayPersonal?.horario).toBe('08:00');
      expect(birthdayPersonal?.titulo).toBe(
        DEFAULT_AUTOMATION_RULES[NotificationAutomationType.BIRTHDAY_PERSONAL].titulo,
      );
    });

    it('should return custom values when database records exist', async () => {
      prisma.notificationAutomationRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          tenantId,
          tipo: NotificationAutomationType.BIRTHDAY_PERSONAL,
          ativo: false,
          horario: '10:00',
          antecedenciaHoras: null,
          titulo: 'Parabéns especial, {nome}!',
          mensagem: 'Deus te abençoe!',
          updatedAt: new Date('2026-11-04T12:00:00Z'),
        },
      ]);

      const rules = await service.getRules(tenantId);
      const customRule = rules.find(
        (r) => r.tipo === NotificationAutomationType.BIRTHDAY_PERSONAL,
      );

      expect(customRule?.isCustom).toBe(true);
      expect(customRule?.id).toBe('rule-1');
      expect(customRule?.ativo).toBe(false);
      expect(customRule?.horario).toBe('10:00');
      expect(customRule?.titulo).toBe('Parabéns especial, {nome}!');
    });
  });

  describe('getRuleByType', () => {
    it('should return default rule when record not found', async () => {
      prisma.notificationAutomationRule.findUnique.mockResolvedValue(null);

      const rule = await service.getRuleByType(
        tenantId,
        NotificationAutomationType.SCHEDULE_DAY_REMINDER,
      );

      expect(rule.ativo).toBe(true);
      expect(rule.horario).toBe('09:00');
      expect(rule.titulo).toBe('Sua escala é hoje');
    });

    it('should return saved rule when found', async () => {
      prisma.notificationAutomationRule.findUnique.mockResolvedValue({
        id: 'rule-event',
        tenantId,
        tipo: NotificationAutomationType.EVENT_REMINDER_BEFORE,
        ativo: true,
        horario: null,
        antecedenciaHoras: 3,
        titulo: 'Faltam 3 horas para {evento}',
        mensagem: 'Nos vemos lá!',
      });

      const rule = await service.getRuleByType(
        tenantId,
        NotificationAutomationType.EVENT_REMINDER_BEFORE,
      );

      expect(rule.antecedenciaHoras).toBe(3);
      expect(rule.titulo).toBe('Faltam 3 horas para {evento}');
    });
  });

  describe('updateRules', () => {
    it('should upsert rules and return updated catalog', async () => {
      await service.updateRules(tenantId, {
        regras: [
          {
            tipo: NotificationAutomationType.BIRTHDAY_PERSONAL,
            ativo: true,
            horario: '08:30',
            antecedenciaHoras: null,
            titulo: 'Parabéns!',
            mensagem: 'Feliz aniversário!',
          },
        ],
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.notificationAutomationRule.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetRule', () => {
    it('should delete custom rule and return rules catalog', async () => {
      await service.resetRule(
        tenantId,
        NotificationAutomationType.BIRTHDAY_PERSONAL,
      );

      expect(prisma.notificationAutomationRule.deleteMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          tipo: NotificationAutomationType.BIRTHDAY_PERSONAL,
        },
      });
    });
  });

  describe('getUserPreferences', () => {
    it('should return all true defaults when user has no preference record', async () => {
      prisma.userNotificationPreference.findUnique.mockResolvedValue(null);

      const prefs = await service.getUserPreferences('user-1', tenantId);

      expect(prefs.notifyBirthdays).toBe(true);
      expect(prefs.notifyEvents).toBe(true);
      expect(prefs.notifySchedules).toBe(true);
    });

    it('should return saved preferences when record exists', async () => {
      prisma.userNotificationPreference.findUnique.mockResolvedValue({
        userId: 'user-1',
        tenantId,
        notifyBirthdays: false,
        notifyEvents: true,
        notifySchedules: false,
      });

      const prefs = await service.getUserPreferences('user-1', tenantId);

      expect(prefs.notifyBirthdays).toBe(false);
      expect(prefs.notifyEvents).toBe(true);
      expect(prefs.notifySchedules).toBe(false);
    });
  });

  describe('updateUserPreferences', () => {
    it('should upsert user preferences and return updated values', async () => {
      const result = await service.updateUserPreferences('user-1', tenantId, {
        notifyBirthdays: false,
      });

      expect(prisma.userNotificationPreference.upsert).toHaveBeenCalled();
      expect(result.notifyBirthdays).toBe(false);
    });
  });
});
