import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotificationAutomationType } from '@prisma/client';
import {
  UpdateAutomationRulesDto,
  UpsertAutomationRuleDto,
} from '../dto/automation-rule.dto';

export interface AutomationRuleDefinition {
  tipo: NotificationAutomationType;
  nome: string;
  descricao: string;
  ativo: boolean;
  horario: string | null;
  antecedenciaHoras: number | null;
  titulo: string;
  mensagem: string;
  variaveisDisponiveis: string[];
}

export const DEFAULT_AUTOMATION_RULES: Record<
  NotificationAutomationType,
  AutomationRuleDefinition
> = {
  [NotificationAutomationType.BIRTHDAY_PERSONAL]: {
    tipo: NotificationAutomationType.BIRTHDAY_PERSONAL,
    nome: 'Parabéns ao Aniversariante',
    descricao:
      'Notificação pessoal enviada no dia do aniversário do membro celebrando a data.',
    ativo: true,
    horario: '08:00',
    antecedenciaHoras: null,
    titulo: 'Hoje é o seu dia, {nome}! 🎂',
    mensagem:
      'Feliz aniversário! Que este novo ciclo seja cheio de fé, alegria e boas histórias ao lado da família {igreja}.',
    variaveisDisponiveis: ['{nome}', '{igreja}'],
  },
  [NotificationAutomationType.BIRTHDAY_COMMUNITY]: {
    tipo: NotificationAutomationType.BIRTHDAY_COMMUNITY,
    nome: 'Aniversariantes do Dia (Comunidade)',
    descricao:
      'Comunicado para toda a igreja lembrando os membros dos aniversariantes daquele dia.',
    ativo: true,
    horario: '08:00',
    antecedenciaHoras: null,
    titulo: 'Hoje tem aniversário na {igreja}! 🎉',
    mensagem:
      '{nome} está celebrando mais um ano de vida. Que tal enviar uma mensagem especial?',
    variaveisDisponiveis: ['{nome}', '{igreja}'],
  },
  [NotificationAutomationType.SCHEDULE_DAY_REMINDER]: {
    tipo: NotificationAutomationType.SCHEDULE_DAY_REMINDER,
    nome: 'Lembrete do Dia da Escala',
    descricao:
      'Lembrete matinal enviado no dia do culto/evento aos voluntários escalados.',
    ativo: true,
    horario: '09:00',
    antecedenciaHoras: null,
    titulo: 'Sua escala é hoje',
    mensagem:
      'Hoje você servirá no ministério de {ministerio} às {horario}. Veja os detalhes.',
    variaveisDisponiveis: ['{nome}', '{ministerio}', '{horario}', '{igreja}'],
  },
  [NotificationAutomationType.SCHEDULE_CONFIRMATION_24H]: {
    tipo: NotificationAutomationType.SCHEDULE_CONFIRMATION_24H,
    nome: 'Aviso de Confirmação Pendente',
    descricao:
      'Aviso enviado antes da escala para voluntários que ainda não confirmaram presença.',
    ativo: true,
    horario: '08:00,13:00',
    antecedenciaHoras: 24,
    titulo: 'Confirmação pendente',
    mensagem:
      'Sua escala de amanhã ainda aguarda confirmação. Toque para confirmar ou informar indisponibilidade.',
    variaveisDisponiveis: ['{nome}', '{ministerio}', '{igreja}'],
  },
  [NotificationAutomationType.EVENT_REMINDER_BEFORE]: {
    tipo: NotificationAutomationType.EVENT_REMINDER_BEFORE,
    nome: 'Lembrete Antecipado de Evento',
    descricao:
      'Lembrete automático enviado aos participantes antes do início do evento ou culto.',
    ativo: true,
    horario: null,
    antecedenciaHoras: 2,
    titulo: 'Evento em {antecedencia}',
    mensagem: '{evento} começa às {horario}. Esperamos você!',
    variaveisDisponiveis: ['{evento}', '{horario}', '{antecedencia}', '{igreja}'],
  },
};

export function renderTemplate(
  template: string,
  variables: Record<string, string | number | undefined | null>,
): string {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = variables[key];
    return value !== undefined && value !== null ? String(value) : match;
  });
}

export function isRuleCustom(
  current: {
    ativo?: boolean;
    horario?: string | null;
    antecedenciaHoras?: number | null;
    titulo?: string;
    mensagem?: string;
  },
  defaultRule: AutomationRuleDefinition,
): boolean {
  const normalize = (s?: string | null) => (s ?? '').trim();
  const titleDiff = normalize(current.titulo) !== normalize(defaultRule.titulo);
  const msgDiff = normalize(current.mensagem) !== normalize(defaultRule.mensagem);
  const timeDiff = normalize(current.horario) !== normalize(defaultRule.horario);
  const antDiff =
    (current.antecedenciaHoras ?? null) !== (defaultRule.antecedenciaHoras ?? null);
  const activeDiff =
    current.ativo !== undefined && current.ativo !== defaultRule.ativo;

  return titleDiff || msgDiff || timeDiff || antDiff || activeDiff;
}

@Injectable()
export class NotificationAutomationRulesService {
  private readonly logger = new Logger(NotificationAutomationRulesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getRules(tenantId: string) {
    const existingRules = await this.prisma.notificationAutomationRule.findMany({
      where: { tenantId },
    });

    const existingMap = new Map(
      existingRules.map((rule) => [rule.tipo, rule]),
    );

    const result = Object.values(NotificationAutomationType).map((tipo) => {
      const defaultRule = DEFAULT_AUTOMATION_RULES[tipo];
      const saved = existingMap.get(tipo);

      if (saved) {
        return {
          id: saved.id,
          tipo: saved.tipo,
          nome: defaultRule.nome,
          descricao: defaultRule.descricao,
          ativo: saved.ativo,
          horario: saved.horario,
          antecedenciaHoras: saved.antecedenciaHoras,
          titulo: saved.titulo,
          mensagem: saved.mensagem,
          isCustom: isRuleCustom(saved, defaultRule),
          variaveisDisponiveis: defaultRule.variaveisDisponiveis,
          updatedAt: saved.updatedAt,
        };
      }

      return {
        id: null,
        tipo: defaultRule.tipo,
        nome: defaultRule.nome,
        descricao: defaultRule.descricao,
        ativo: defaultRule.ativo,
        horario: defaultRule.horario,
        antecedenciaHoras: defaultRule.antecedenciaHoras,
        titulo: defaultRule.titulo,
        mensagem: defaultRule.mensagem,
        isCustom: false,
        variaveisDisponiveis: defaultRule.variaveisDisponiveis,
        updatedAt: null,
      };
    });

    return result;
  }

  async getRuleByType(
    tenantId: string,
    tipo: NotificationAutomationType,
  ): Promise<{
    ativo: boolean;
    horario: string | null;
    antecedenciaHoras: number | null;
    titulo: string;
    mensagem: string;
  }> {
    const saved = await this.prisma.notificationAutomationRule.findUnique({
      where: {
        tenantId_tipo: {
          tenantId,
          tipo,
        },
      },
    });

    const defaultRule = DEFAULT_AUTOMATION_RULES[tipo];

    if (!saved) {
      return {
        ativo: defaultRule.ativo,
        horario: defaultRule.horario,
        antecedenciaHoras: defaultRule.antecedenciaHoras,
        titulo: defaultRule.titulo,
        mensagem: defaultRule.mensagem,
      };
    }

    return {
      ativo: saved.ativo,
      horario: saved.horario ?? defaultRule.horario,
      antecedenciaHoras: saved.antecedenciaHoras ?? defaultRule.antecedenciaHoras,
      titulo: saved.titulo,
      mensagem: saved.mensagem,
    };
  }

  async updateRules(tenantId: string, dto: UpdateAutomationRulesDto) {
    const operations = dto.regras.map((rule) => {
      const defaultRule = DEFAULT_AUTOMATION_RULES[rule.tipo];
      const isCustom = isRuleCustom(rule, defaultRule);

      if (!isCustom) {
        return this.prisma.notificationAutomationRule.deleteMany({
          where: {
            tenantId,
            tipo: rule.tipo,
          },
        });
      }

      return this.prisma.notificationAutomationRule.upsert({
        where: {
          tenantId_tipo: {
            tenantId,
            tipo: rule.tipo,
          },
        },
        create: {
          tenantId,
          tipo: rule.tipo,
          ativo: rule.ativo,
          horario: rule.horario ?? defaultRule.horario,
          antecedenciaHoras:
            rule.antecedenciaHoras ?? defaultRule.antecedenciaHoras,
          titulo: rule.titulo.trim() || defaultRule.titulo,
          mensagem: rule.mensagem.trim() || defaultRule.mensagem,
        },
        update: {
          ativo: rule.ativo,
          horario: rule.horario ?? defaultRule.horario,
          antecedenciaHoras:
            rule.antecedenciaHoras ?? defaultRule.antecedenciaHoras,
          titulo: rule.titulo.trim() || defaultRule.titulo,
          mensagem: rule.mensagem.trim() || defaultRule.mensagem,
        },
      });
    });

    await this.prisma.$transaction(operations);
    this.logger.log(
      `Regras de automação atualizadas para o tenant ${tenantId}: ${dto.regras.length} regras`,
    );

    return this.getRules(tenantId);
  }

  async resetRule(tenantId: string, tipo: NotificationAutomationType) {
    if (!tipo) {
      throw new BadRequestException('Tipo de regra é obrigatório para restauração.');
    }

    await this.prisma.notificationAutomationRule.deleteMany({
      where: {
        tenantId,
        tipo,
      },
    });

    this.logger.log(
      `Regra ${tipo} restaurada para padrão no tenant ${tenantId}`,
    );

    return this.getRules(tenantId);
  }

  async getUserPreferences(userId: string, tenantId: string) {
    const pref = await this.prisma.userNotificationPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      return {
        userId,
        tenantId,
        notifyBirthdays: true,
        notifyEvents: true,
        notifySchedules: true,
      };
    }

    return {
      userId: pref.userId,
      tenantId: pref.tenantId,
      notifyBirthdays: pref.notifyBirthdays,
      notifyEvents: pref.notifyEvents,
      notifySchedules: pref.notifySchedules,
    };
  }

  async updateUserPreferences(
    userId: string,
    tenantId: string,
    dto: {
      notifyBirthdays?: boolean;
      notifyEvents?: boolean;
      notifySchedules?: boolean;
    },
  ) {
    const updated = await this.prisma.userNotificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        tenantId,
        notifyBirthdays: dto.notifyBirthdays ?? true,
        notifyEvents: dto.notifyEvents ?? true,
        notifySchedules: dto.notifySchedules ?? true,
      },
      update: {
        ...(dto.notifyBirthdays !== undefined && {
          notifyBirthdays: dto.notifyBirthdays,
        }),
        ...(dto.notifyEvents !== undefined && {
          notifyEvents: dto.notifyEvents,
        }),
        ...(dto.notifySchedules !== undefined && {
          notifySchedules: dto.notifySchedules,
        }),
      },
    });

    return {
      userId: updated.userId,
      tenantId: updated.tenantId,
      notifyBirthdays: updated.notifyBirthdays,
      notifyEvents: updated.notifyEvents,
      notifySchedules: updated.notifySchedules,
    };
  }
}
