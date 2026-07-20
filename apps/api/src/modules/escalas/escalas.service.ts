import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateEscalaDto, ModoCriacaoEscala } from './dto/create-escala.dto';
import { UpdateEscalaDto } from './dto/update-escala.dto';
import { FilterEscalaDto } from './dto/filter-escala.dto';
import { FilterEscalaVisualizacaoDto } from './dto/filter-escala-visualizacao.dto';
import { ManageEscalaItemDto } from './dto/manage-escala-item.dto';
import { ConfirmarEscalaItemDto } from './dto/confirmar-escala-item.dto';
import { ReorderDiasDto } from './dto/reorder-dias.dto';
import { ToggleDiaFuncaoOcultaDto } from './dto/toggle-dia-funcao-oculta.dto';
import { EventosElegiveisDto } from './dto/eventos-elegiveis.dto';
import { AddEscalaDiaDto } from './dto/add-escala-dia.dto';
import { UpdateEscalaDiaEventoDto } from './dto/update-escala-dia-evento.dto';
import {
  MinistryRole,
  Prisma,
  Role,
  StatusConfirmacao,
  StatusEscala,
  StatusEvento,
  StatusMembro,
} from '@prisma/client';
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EscalasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private appendDiaFilter(where: any, diaFilter: any) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { dias: { some: diaFilter } },
    ];
  }

  private applyEscalaPendenciasFilter(where: any, requestedStatus?: StatusEscala): boolean {
    if (requestedStatus && requestedStatus !== StatusEscala.PUBLICADA) {
      return false;
    }

    where.status = StatusEscala.PUBLICADA;
    this.appendDiaFilter(where, {
      itens: {
        some: { statusConfirmacao: StatusConfirmacao.PENDENTE },
      },
    });

    return true;
  }

  private applyItemPendenciasFilter(
    itemWhere: any,
    escalaWhere: any,
    requestedStatus?: StatusEscala,
  ): boolean {
    if (requestedStatus && requestedStatus !== StatusEscala.PUBLICADA) {
      return false;
    }

    escalaWhere.status = StatusEscala.PUBLICADA;
    itemWhere.statusConfirmacao = StatusConfirmacao.PENDENTE;

    return true;
  }

  private getDateRangeForScheduleDay(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  private isValidStatusTransition(current: StatusEscala, next: StatusEscala) {
    return (
      (current === StatusEscala.RASCUNHO && next === StatusEscala.PUBLICADA) ||
      (current === StatusEscala.PUBLICADA && next === StatusEscala.ENCERRADA) ||
      (current === StatusEscala.PUBLICADA && next === StatusEscala.RASCUNHO) ||
      (current === StatusEscala.ENCERRADA && next === StatusEscala.PUBLICADA)
    );
  }

  private assertEscalaAbertaParaEdicao(status: StatusEscala) {
    if (status === StatusEscala.ENCERRADA) {
      throw new BadRequestException('Não é possível alterar uma escala encerrada. Reabra a escala antes de editar.');
    }
  }

  /**
   * Verifica se o usuário BASIC tem role de LEADER ou ASSISTANT_LEADER no ministério.
   */
  private async checkMinistryAccess(
    ministerioId: string,
    memberId: string | undefined,
  ): Promise<void> {
    if (!memberId) {
      throw new ForbiddenException('Acesso negado: usuário não vinculado a um membro.');
    }

    const membership = await this.prisma.ministerioMembro.findUnique({
      where: {
        ministerioId_membroId: { ministerioId, membroId: memberId },
      },
    });

    if (!membership || (membership.role !== MinistryRole.LEADER && membership.role !== MinistryRole.ASSISTANT_LEADER)) {
      throw new ForbiddenException('Acesso negado: você não lidera este ministério.');
    }
  }

  private async assertCanManageScheduleMinistry(
    tenantId: string,
    ministerioId: string,
    user: JwtPayload,
  ) {
    const ministerio = await this.prisma.ministerio.findFirst({
      where: { id: ministerioId, tenantId, ativo: true },
      select: { id: true },
    });

    if (!ministerio) {
      throw new NotFoundException('Ministério não encontrado.');
    }

    if (user.role === Role.BASIC) {
      await this.checkMinistryAccess(ministerioId, user.memberId);
    }
  }

  private resolveModoCriacao(dto: CreateEscalaDto) {
    const diasSemana = dto.diasSemana ?? [];
    const eventoIds = dto.eventoIds ?? [];

    if (new Set(eventoIds).size !== eventoIds.length) {
      throw new BadRequestException('Não repita o mesmo evento na criação da escala.');
    }

    if (diasSemana.length > 0 && eventoIds.length > 0) {
      throw new BadRequestException(
        'Escolha dias da semana ou eventos. Os dois modos não podem ser combinados.',
      );
    }

    const modo =
      dto.modoCriacao ??
      (eventoIds.length > 0
        ? ModoCriacaoEscala.EVENTOS
        : diasSemana.length > 0
          ? ModoCriacaoEscala.DIAS_SEMANA
          : ModoCriacaoEscala.VAZIA);

    if (modo === ModoCriacaoEscala.EVENTOS && eventoIds.length === 0) {
      throw new BadRequestException('Selecione ao menos um evento para criar a escala.');
    }

    if (modo === ModoCriacaoEscala.DIAS_SEMANA && diasSemana.length === 0) {
      throw new BadRequestException('Selecione ao menos um dia da semana.');
    }

    if (
      (modo === ModoCriacaoEscala.EVENTOS && diasSemana.length > 0) ||
      (modo === ModoCriacaoEscala.DIAS_SEMANA && eventoIds.length > 0) ||
      (modo === ModoCriacaoEscala.VAZIA &&
        (diasSemana.length > 0 || eventoIds.length > 0))
    ) {
      throw new BadRequestException('Os dados enviados não correspondem ao modo de criação.');
    }

    return { modo, diasSemana, eventoIds };
  }

  private toOperationalMidnightUtc(ano: number, mes: number, dia: number) {
    const desiredUtc = Date.UTC(ano, mes - 1, dia, 0, 0, 0, 0);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const getOffset = (instant: Date) => {
      const parts = Object.fromEntries(
        formatter
          .formatToParts(instant)
          .filter((part) => part.type !== 'literal')
          .map((part) => [part.type, Number(part.value)]),
      );

      return (
        Date.UTC(
          parts.year,
          parts.month - 1,
          parts.day,
          parts.hour,
          parts.minute,
          parts.second,
        ) - instant.getTime()
      );
    };

    let result = desiredUtc - getOffset(new Date(desiredUtc));
    result = desiredUtc - getOffset(new Date(result));
    return new Date(result);
  }

  private getOperationalMonthRange(mes: number, ano: number) {
    const nextMonth = mes === 12 ? 1 : mes + 1;
    const nextYear = mes === 12 ? ano + 1 : ano;

    return {
      start: this.toOperationalMidnightUtc(ano, mes, 1),
      end: this.toOperationalMidnightUtc(nextYear, nextMonth, 1),
    };
  }

  private getOperationalDateKey(date: Date) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .formatToParts(date)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );

    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  private getEscalaDiaDateKey(date: Date, eventoId?: string | null) {
    const isLegacyCivilMidnight =
      !eventoId &&
      date.getUTCHours() === 0 &&
      date.getUTCMinutes() === 0 &&
      date.getUTCSeconds() === 0;

    return isLegacyCivilMidnight
      ? date.toISOString().slice(0, 10)
      : this.getOperationalDateKey(date);
  }

  private async findEligibleEventForSchedule(
    client: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    escala: { id: string; ministerioId: string; mes: number; ano: number },
    eventoId: string,
    currentDiaId?: string,
  ) {
    return client.evento.findFirst({
      where: {
        ...this.buildEventosElegiveisWhere(
          tenantId,
          {
            ministerioId: escala.ministerioId,
            mes: escala.mes,
            ano: escala.ano,
          },
          [eventoId],
        ),
        escalasDias: {
          none: {
            escalaId: escala.id,
            id: currentDiaId ? { not: currentDiaId } : undefined,
          },
        },
      },
      select: { id: true, titulo: true, dataInicio: true },
    });
  }

  private buildEventosElegiveisWhere(
    tenantId: string,
    query: EventosElegiveisDto,
    eventoIds?: string[],
  ): Prisma.EventoWhereInput {
    const { start, end } = this.getOperationalMonthRange(query.mes, query.ano);

    return {
      tenantId,
      id: eventoIds ? { in: eventoIds } : undefined,
      status: StatusEvento.AGENDADO,
      dataInicio: { gte: start, lt: end },
      ministerios: {
        some: {
          ministerioId: query.ministerioId,
          requerEscala: true,
        },
      },
      escalasDias: {
        none: {
          escala: {
            ministerioId: query.ministerioId,
            mes: query.mes,
            ano: query.ano,
          },
        },
      },
    };
  }

  async findEventosElegiveis(
    tenantId: string,
    query: EventosElegiveisDto,
    user: JwtPayload,
  ) {
    await this.assertCanManageScheduleMinistry(tenantId, query.ministerioId, user);

    const eventos = await this.prisma.evento.findMany({
      where: this.buildEventosElegiveisWhere(tenantId, query),
      select: {
        id: true,
        titulo: true,
        tipo: true,
        dataInicio: true,
        dataFim: true,
        local: true,
        status: true,
      },
      orderBy: [{ dataInicio: 'asc' }, { titulo: 'asc' }],
    });

    return eventos.map((evento) => ({
      ...evento,
      ministerioId: query.ministerioId,
    }));
  }

  async create(tenantId: string, dto: CreateEscalaDto, user: JwtPayload) {
    await this.assertCanManageScheduleMinistry(tenantId, dto.ministerioId, user);
    const { modo, diasSemana, eventoIds } = this.resolveModoCriacao(dto);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.escala.findUnique({
            where: {
              ministerioId_mes_ano: {
                ministerioId: dto.ministerioId,
                mes: dto.mes,
                ano: dto.ano,
              },
            },
            select: { id: true },
          });

          if (existing) {
            throw new BadRequestException(
              'A escala mensal para este ministério neste mês e ano já existe.',
            );
          }

          let dias: Prisma.EscalaDiaCreateWithoutEscalaInput[] = [];

          if (modo === ModoCriacaoEscala.DIAS_SEMANA) {
            dias = this.gerarDiasDoMes(dto.mes, dto.ano, diasSemana).map(
              (data, ordem) => ({ data, ordem }),
            );
          }

          if (modo === ModoCriacaoEscala.EVENTOS) {
            const eventos = await tx.evento.findMany({
              where: this.buildEventosElegiveisWhere(
                tenantId,
                {
                  ministerioId: dto.ministerioId,
                  mes: dto.mes,
                  ano: dto.ano,
                },
                eventoIds,
              ),
              select: { id: true, titulo: true, dataInicio: true },
              orderBy: [{ dataInicio: 'asc' }, { titulo: 'asc' }],
            });

            if (eventos.length !== eventoIds.length) {
              throw new BadRequestException(
                'Um ou mais eventos não são elegíveis para esta escala.',
              );
            }

            dias = eventos.map((evento, ordem) => ({
              evento: { connect: { id: evento.id } },
              data: evento.dataInicio,
              titulo: evento.titulo,
              ordem,
            }));
          }

          return tx.escala.create({
            data: {
              mes: dto.mes,
              ano: dto.ano,
              observacoes: dto.observacoes,
              ministerioId: dto.ministerioId,
              tenantId,
              status: StatusEscala.RASCUNHO,
              dias: dias.length > 0 ? { create: dias } : undefined,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        throw new BadRequestException(
          'A escala mensal para este ministério neste mês e ano já existe ou está sendo criada.',
        );
      }

      throw error;
    }
  }

  private gerarDiasDoMes(mes: number, ano: number, diasSemana: number[]): Date[] {
    const dias: Date[] = [];
    const totalDias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    for (let d = 1; d <= totalDias; d++) {
      const weekday = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay();
      if (diasSemana.includes(weekday)) {
        dias.push(this.toOperationalMidnightUtc(ano, mes, d));
      }
    }
    return dias;
  }

  private async applyVisualizacaoScope(
    where: any,
    query: FilterEscalaVisualizacaoDto,
    user: JwtPayload,
  ): Promise<boolean> {
    if (query.ministerioId) {
      where.ministerioId = query.ministerioId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.mes) {
      where.mes = parseInt(query.mes, 10);
    }
    if (query.ano) {
      where.ano = parseInt(query.ano, 10);
    }
    if (query.pendentesApenas === 'true') {
      const hasCompatibleStatus = this.applyEscalaPendenciasFilter(where, query.status);
      if (!hasCompatibleStatus) return false;
    }

    if (user.role !== Role.BASIC) return true;
    if (!user.memberId) return false;

    const liderados = await this.prisma.ministerioMembro.findMany({
      where: {
        membroId: user.memberId,
        ministerio: {
          ativo: true,
          escalas: { some: {} },
        },
      },
      select: { ministerioId: true },
    });

    const idsLiderados = liderados.map((liderado) => liderado.ministerioId);
    if (idsLiderados.length === 0) return false;

    if (query.ministerioId && !idsLiderados.includes(query.ministerioId)) {
      return false;
    }

    where.ministerioId = query.ministerioId
      ? query.ministerioId
      : { in: idsLiderados };

    return true;
  }

  async findAll(tenantId: string, query: FilterEscalaDto, user: JwtPayload) {
    const where: any = { tenantId };

    if (query.ministerioId) {
      where.ministerioId = query.ministerioId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.mes) {
      where.mes = parseInt(query.mes, 10);
    }
    if (query.ano) {
      where.ano = parseInt(query.ano, 10);
    }
    if (query.pendentesApenas === 'true') {
      const hasCompatibleStatus = this.applyEscalaPendenciasFilter(where, query.status);
      if (!hasCompatibleStatus) return [];
    }

    if (user.role === Role.BASIC) {
      if (!user.memberId) return [];

      // Buscar ministérios onde é LEADER ou ASSISTANT_LEADER
      const liderados = await this.prisma.ministerioMembro.findMany({
        where: {
          membroId: user.memberId,
          role: { in: [MinistryRole.LEADER, MinistryRole.ASSISTANT_LEADER] },
        },
        select: { ministerioId: true },
      });
      const idsLiderados = liderados.map((l) => l.ministerioId);

      if (idsLiderados.length > 0) {
        // Líder/co-líder vê escalas dos seus ministérios
        if (query.ministerioId && !idsLiderados.includes(query.ministerioId)) {
          // Se pediu um ministério específico que não lidera, mostra só onde está escalado
          this.appendDiaFilter(where, { itens: { some: { membroId: user.memberId } } });
        } else {
          where.ministerioId = { in: idsLiderados };
        }
      } else {
        // Membro comum: vê apenas escalas onde está escalado
        this.appendDiaFilter(where, { itens: { some: { membroId: user.memberId } } });
      }
    }

    return this.prisma.escala.findMany({
      where,
      include: {
        ministerio: {
          select: { id: true, nome: true },
        },
        _count: {
          select: { dias: true }
        }
      },
      orderBy: [
        { ano: 'desc' },
        { mes: 'desc' },
      ],
    });
  }

  async findVisualizacao(
    tenantId: string,
    query: FilterEscalaVisualizacaoDto,
    user: JwtPayload,
  ) {
    const where: any = { tenantId };
    const hasAccess = await this.applyVisualizacaoScope(where, query, user);
    if (!hasAccess) return [];

    return this.prisma.escala.findMany({
      where,
      include: {
        ministerio: {
          include: {
            funcoes: { orderBy: { ordem: 'asc' } },
          },
        },
        dias: {
          orderBy: [
            { ordem: 'asc' },
            { data: 'asc' },
          ],
          include: {
            evento: {
              select: {
                id: true,
                titulo: true,
                dataInicio: true,
                dataFim: true,
                local: true,
                status: true,
                tipo: true,
              },
            },
            funcoesOcultas: { select: { funcaoId: true } },
            itens: {
              include: {
                membro: {
                  select: {
                    id: true,
                    nome: true,
                    nomeExibicao: true,
                    email: true,
                    whatsapp: true,
                    status: true,
                  } as any,
                },
                funcao: true,
              },
              orderBy: {
                membro: { nome: 'asc' },
              },
            },
          },
        },
      },
      orderBy: [
        { ano: 'desc' },
        { mes: 'desc' },
        { ministerio: { nome: 'asc' } },
      ],
    });
  }

  async findMinhas(
    tenantId: string,
    query: FilterEscalaVisualizacaoDto,
    user: JwtPayload,
  ) {
    if (!user.memberId) return [];

    const escalaWhere: any = { tenantId };
    if (query.ministerioId) {
      escalaWhere.ministerioId = query.ministerioId;
    }
    if (query.status) {
      escalaWhere.status = query.status;
    }
    if (query.mes) {
      escalaWhere.mes = parseInt(query.mes, 10);
    }
    if (query.ano) {
      escalaWhere.ano = parseInt(query.ano, 10);
    }

    const where: any = {
      membroId: user.memberId,
      escalaDia: {
        escala: escalaWhere,
      },
    };

    if (query.pendentesApenas === 'true') {
      const hasCompatibleStatus = this.applyItemPendenciasFilter(where, escalaWhere, query.status);
      if (!hasCompatibleStatus) return [];
    }

    const itens = await this.prisma.escalaItem.findMany({
      where,
      include: {
        membro: { select: { id: true, nome: true, nomeExibicao: true, email: true, whatsapp: true } as any },
        funcao: true,
        escalaDia: {
          include: {
            evento: {
              select: {
                id: true,
                titulo: true,
                dataInicio: true,
                dataFim: true,
                local: true,
                status: true,
                tipo: true,
              },
            },
            escala: {
              include: {
                ministerio: { select: { id: true, nome: true } },
              },
            },
          },
        },
      },
    }) as any[];

    return itens
      .sort((a, b) => a.escalaDia.data.getTime() - b.escalaDia.data.getTime())
      .map((item) => ({
        id: item.id,
        escalaDiaId: item.escalaDiaId,
        membroId: item.membroId,
        ministerioFuncaoId: item.ministerioFuncaoId,
        statusConfirmacao: item.statusConfirmacao,
        observacoes: item.observacoes,
        data: item.escalaDia.data,
        titulo: item.escalaDia.titulo ?? item.escalaDia.evento?.titulo ?? null,
        evento: item.escalaDia.evento,
        funcao: item.funcao,
        membro: item.membro,
        escala: item.escalaDia.escala,
      }));
  }

  async findOne(tenantId: string, id: string, user: JwtPayload) {
    const escala = await this.prisma.escala.findFirst({
      where: { id, tenantId },
      include: {
        ministerio: {
          include: {
            funcoes: { orderBy: { ordem: 'asc' } }
          }
        },
        dias: {
          orderBy: { ordem: 'asc' },
          include: {
            evento: {
              select: {
                id: true,
                titulo: true,
                dataInicio: true,
                dataFim: true,
                local: true,
                status: true,
                tipo: true,
              },
            },
            funcoesOcultas: { select: { funcaoId: true } },
            itens: {
              include: {
                membro: { select: { id: true, nome: true, nomeExibicao: true, email: true, whatsapp: true } as any },
                user: { select: { id: true, nome: true } },
                funcao: true
              }
            }
          }
        }
      },
    });

    if (!escala) {
      throw new NotFoundException('Escala não encontrada.');
    }

    if (user.role === Role.BASIC) {
      if (!user.memberId) {
        throw new ForbiddenException('Acesso negado: usuário não vinculado a um membro.');
      }

      // Checar se é líder/co-líder do ministério
      const membership = await this.prisma.ministerioMembro.findUnique({
        where: {
          ministerioId_membroId: { ministerioId: escala.ministerioId, membroId: user.memberId },
        },
      });

      const isLeaderOrAssistant = membership &&
        (membership.role === MinistryRole.LEADER || membership.role === MinistryRole.ASSISTANT_LEADER);

      if (!isLeaderOrAssistant) {
        // Verificar se está escalado
        let isEscalado = false;
        for (const d of escala.dias) {
          if (d.itens.some((item) => item.membroId === user.memberId)) {
            isEscalado = true;
            break;
          }
        }
        if (!isEscalado) {
          throw new ForbiddenException('Acesso negado: você não está associado a esta escala.');
        }
      }
    }

    return escala;
  }

  async update(tenantId: string, id: string, dto: UpdateEscalaDto, user: JwtPayload) {
    const escala = await this.findOne(tenantId, id, user);

    if (user.role === Role.BASIC) {
      await this.checkMinistryAccess(escala.ministerioId, user.memberId);
    }

    if (dto.status && dto.status !== escala.status) {
      const transicaoValida = this.isValidStatusTransition(escala.status, dto.status);

      if (!transicaoValida) {
        throw new BadRequestException(
          `Transição de status inválida: não é possível ir de "${escala.status}" para "${dto.status}".`,
        );
      }
    }

    const shouldNotifyPublished =
      escala.status === StatusEscala.RASCUNHO &&
      dto.status === StatusEscala.PUBLICADA &&
      Math.abs(escala.updatedAt.getTime() - escala.createdAt.getTime()) < 1000;

    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    const updated = await this.prisma.escala.update({
      where: { id },
      data,
      });

    if (shouldNotifyPublished) {
      await this.notifyEscalaPublished(tenantId, id);
    }

    return updated;
  }

  private async notifyEscalaPublished(tenantId: string, escalaId: string) {
    const escala = await this.prisma.escala.findFirst({
      where: {
        id: escalaId,
        tenantId,
        status: StatusEscala.PUBLICADA,
      },
      include: {
        ministerio: { select: { nome: true } },
        dias: {
          include: {
            itens: {
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
                funcao: {
                  select: {
                    nome: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!escala) return;

    const notificationsByUser = new Map<string, { funcaoNome: string }>();

    escala.dias
      .flatMap((dia) => dia.itens)
      .forEach((item) => {
        const user = item.membro.user;
        if (!user?.id || !user.ativo || notificationsByUser.has(user.id)) return;

        notificationsByUser.set(user.id, {
          funcaoNome: item.funcao.nome,
        });
      });

    if (notificationsByUser.size === 0) return;

    await Promise.all(
      Array.from(notificationsByUser.entries()).map(([userId, notification]) =>
        this.notificationsService.sendToUsers(tenantId, [userId], {
          title: 'Você foi escalado',
          body: `Você servirá no ministério de ${escala.ministerio.nome} como ${notification.funcaoNome}. Confirme sua presença.`,
          url: '/minhas-escalas?pendentesApenas=true',
        }),
      ),
    );
  }

  private getMembroDisplayName(membro: { nome: string; nomeExibicao?: string | null }) {
    return membro.nomeExibicao?.trim() || membro.nome;
  }

  private async getLeadershipUserIds(
    tenantId: string,
    ministerioId: string,
    excludedUserId?: string,
  ) {
    const liderancas = await this.prisma.ministerioMembro.findMany({
      where: {
        ministerioId,
        role: {
          in: [MinistryRole.LEADER, MinistryRole.ASSISTANT_LEADER],
        },
        membro: {
          tenantId,
          deletedAt: null,
          status: StatusMembro.ATIVO,
          user: {
            is: {
              ativo: true,
            },
          },
        },
      },
      select: {
        membro: {
          select: {
            user: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    return Array.from(
      new Set(
        liderancas
          .map((lideranca) => lideranca.membro.user?.id)
          .filter((userId): userId is string => Boolean(userId && userId !== excludedUserId)),
      ),
    );
  }

  private async notifyLeadershipAboutConfirmationResponse(
    tenantId: string,
    item: {
      membro: { nome: string; nomeExibicao?: string | null };
      funcao?: { nome: string } | null;
      escalaDia: {
        escala: {
          ministerioId: string;
          ministerio: { nome: string };
        };
      };
    },
    statusConfirmacao: StatusConfirmacao,
    actorUserId?: string,
  ) {
    if (
      statusConfirmacao !== StatusConfirmacao.CONFIRMADO &&
      statusConfirmacao !== StatusConfirmacao.RECUSADO
    ) {
      return;
    }

    const userIds = await this.getLeadershipUserIds(
      tenantId,
      item.escalaDia.escala.ministerioId,
      actorUserId,
    );

    if (userIds.length === 0) return;

    const membroNome = this.getMembroDisplayName(item.membro);
    const ministerioNome = item.escalaDia.escala.ministerio.nome;

    if (statusConfirmacao === StatusConfirmacao.CONFIRMADO) {
      await this.notificationsService.sendToUsers(tenantId, userIds, {
        title: `${membroNome} confirmou presença`,
        body: `Escala de ${ministerioNome} atualizada.`,
        url: '/escalas',
      });
      return;
    }

    await this.notificationsService.sendToUsers(tenantId, userIds, {
      title: `${membroNome} não poderá servir`,
      body: `A escala de ${ministerioNome} precisa de atenção.`,
      url: '/escalas',
    });
  }

  async countPendencias(tenantId: string) {
    return this.prisma.escalaItem.count({
      where: {
        statusConfirmacao: StatusConfirmacao.PENDENTE,
        escalaDia: {
          escala: {
            tenantId,
            status: StatusEscala.PUBLICADA,
          },
        },
      },
    });
  }

  async remove(tenantId: string, id: string, user: JwtPayload) {
    const escala = await this.findOne(tenantId, id, user);

    if (user.role === Role.BASIC) {
      await this.checkMinistryAccess(escala.ministerioId, user.memberId);
    }

    await this.prisma.escala.delete({
      where: { id },
    });

    return { message: 'Escala removida com sucesso.' };
  }

  // ─── Gestão de Dias ─────────────────────────────
  async addDia(
    tenantId: string,
    escalaId: string,
    dto: AddEscalaDiaDto,
    user: JwtPayload,
  ) {
    const escala = await this.findOne(tenantId, escalaId, user);
    if (user.role === Role.BASIC) {
      await this.checkMinistryAccess(escala.ministerioId, user.memberId);
    }

    this.assertEscalaAbertaParaEdicao(escala.status);

    if (!dto.eventoId && !dto.data) {
      throw new BadRequestException('Informe a data ou selecione um evento.');
    }

    const evento = dto.eventoId
      ? await this.findEligibleEventForSchedule(
          this.prisma,
          tenantId,
          escala,
          dto.eventoId,
        )
      : null;

    if (dto.eventoId && !evento) {
      throw new BadRequestException('O evento selecionado nÃ£o Ã© elegÃ­vel para esta escala.');
    }

    const last = await this.prisma.escalaDia.findFirst({
      where: { escalaId },
      orderBy: { ordem: 'desc' },
      select: { ordem: true },
    });
    const ordem = (last?.ordem ?? -1) + 1;

    return this.prisma.escalaDia.create({
      data: {
        escalaId,
        data: evento?.dataInicio ?? new Date(dto.data!),
        titulo: evento?.titulo ?? dto.titulo,
        eventoId: evento?.id,
        ordem,
      }
    });
  }

  async updateDiaEvento(
    tenantId: string,
    diaId: string,
    dto: UpdateEscalaDiaEventoDto,
    user: JwtPayload,
  ) {
    const dia = await this.prisma.escalaDia.findFirst({
      where: { id: diaId, escala: { tenantId } },
      include: { escala: true },
    });

    if (!dia) throw new NotFoundException('Dia nÃ£o encontrado.');
    if (user.role === Role.BASIC) {
      await this.checkMinistryAccess(dia.escala.ministerioId, user.memberId);
    }
    this.assertEscalaAbertaParaEdicao(dia.escala.status);

    if (!dto.eventoId) {
      return this.prisma.escalaDia.update({
        where: { id: diaId },
        data: { eventoId: null },
      });
    }

    const evento = await this.findEligibleEventForSchedule(
      this.prisma,
      tenantId,
      dia.escala,
      dto.eventoId,
      diaId,
    );

    if (!evento) {
      throw new BadRequestException('O evento selecionado nÃ£o Ã© elegÃ­vel para esta escala.');
    }

    if (
      this.getOperationalDateKey(evento.dataInicio) !==
      this.getEscalaDiaDateKey(dia.data, dia.eventoId)
    ) {
      throw new BadRequestException(
        'O evento selecionado deve ocorrer na mesma data do dia da escala.',
      );
    }

    return this.prisma.escalaDia.update({
      where: { id: diaId },
      data: {
        eventoId: evento.id,
        data: evento.dataInicio,
        titulo: evento.titulo,
      },
      include: {
        evento: {
          select: {
            id: true,
            titulo: true,
            dataInicio: true,
            dataFim: true,
            local: true,
            status: true,
            tipo: true,
          },
        },
      },
    });
  }

  async reorderDias(tenantId: string, escalaId: string, dto: ReorderDiasDto, user: JwtPayload) {
    const escala = await this.findOne(tenantId, escalaId, user);
    if (user.role === Role.BASIC) {
      await this.checkMinistryAccess(escala.ministerioId, user.memberId);
    }

    this.assertEscalaAbertaParaEdicao(escala.status);

    await Promise.all(
      dto.diaIds.map((id, index) =>
        this.prisma.escalaDia.update({ where: { id }, data: { ordem: index } })
      )
    );

    return { message: 'Dias reordenados com sucesso.' };
  }

  async removeDia(tenantId: string, diaId: string, user: JwtPayload) {
    const dia = await this.prisma.escalaDia.findUnique({
      where: { id: diaId },
      include: { escala: true }
    });
    if (!dia) throw new NotFoundException('Dia não encontrado.');

    if (dia.escala.tenantId !== tenantId) throw new ForbiddenException();

    if (user.role === Role.BASIC) {
      await this.checkMinistryAccess(dia.escala.ministerioId, user.memberId);
    }

    this.assertEscalaAbertaParaEdicao(dia.escala.status);

    await this.prisma.escalaDia.delete({ where: { id: diaId } });
    return { message: 'Dia removido com sucesso.' };
  }

  // ─── Gestão de Itens da Escala ─────────────────────────────

  async addMembro(
    tenantId: string,
    diaId: string,
    dto: ManageEscalaItemDto,
    user: JwtPayload,
  ) {
    const dia = await this.prisma.escalaDia.findUnique({
      where: { id: diaId },
      include: { escala: true }
    });
    if (!dia) throw new NotFoundException('Dia não encontrado.');

    const escala = dia.escala;

    if (user.role === Role.BASIC) {
      await this.checkMinistryAccess(escala.ministerioId, user.memberId);
    }

    this.assertEscalaAbertaParaEdicao(escala.status);

    const membro = await this.prisma.client.membro.findFirst({
      where: { id: dto.membroId, tenantId },
    });

    if (!membro) {
      throw new NotFoundException('Membro não encontrado neste tenant.');
    }

    const { start, end } = this.getDateRangeForScheduleDay(dia.data);
    const conflitoNoDia = await this.prisma.escalaItem.findFirst({
      where: {
        membroId: dto.membroId,
        NOT: {
          escalaDiaId: diaId,
          ministerioFuncaoId: dto.ministerioFuncaoId,
        },
        escalaDia: {
          data: {
            gte: start,
            lte: end,
          },
          escala: {
            tenantId,
          },
        },
      },
      include: {
        funcao: { select: { nome: true } },
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

    if (conflitoNoDia) {
      const ministerio = conflitoNoDia.escalaDia.escala.ministerio?.nome ?? 'outro ministerio';
      const funcao = conflitoNoDia.funcao?.nome ?? 'outra funcao';

      throw new BadRequestException(
        `Membro ja esta escalado neste dia em ${ministerio} (${funcao}). Escolha outro membro ou entre em contato com a lideranca desse ministerio.`,
      );
    }
    return this.prisma.escalaItem.upsert({
      where: {
        escalaDiaId_membroId_ministerioFuncaoId: {
          escalaDiaId: dto.escalaDiaId,
          membroId: dto.membroId,
          ministerioFuncaoId: dto.ministerioFuncaoId,
        },
      },
      create: {
        escalaDiaId: dto.escalaDiaId,
        membroId: dto.membroId,
        ministerioFuncaoId: dto.ministerioFuncaoId,
        userId: user.sub,
        observacoes: dto.observacoes,
      },
      update: {
        observacoes: dto.observacoes,
      },
      include: {
        membro: { select: { id: true, nome: true, nomeExibicao: true, email: true, whatsapp: true } as any },
        funcao: true,
      },
    });
  }

  async removeMembro(
    tenantId: string,
    itemId: string,
    user: JwtPayload,
  ) {
    const item = await this.prisma.escalaItem.findUnique({
      where: { id: itemId },
      include: {
        escalaDia: {
          include: { escala: true }
        }
      }
    });
    if (!item) throw new NotFoundException('Item não encontrado.');

    const escala = item.escalaDia.escala;
    if (escala.tenantId !== tenantId) throw new ForbiddenException();

    if (user.role === Role.BASIC) {
      await this.checkMinistryAccess(escala.ministerioId, user.memberId);
    }

    this.assertEscalaAbertaParaEdicao(escala.status);

    await this.prisma.escalaItem.delete({
      where: { id: itemId },
    });

    return { message: 'Membro removido da escala com sucesso.' };
  }

  // ─── Confirmação / Update Status ─────────────────────────────

  async confirmar(
    tenantId: string,
    itemId: string,
    dto: ConfirmarEscalaItemDto,
    user: JwtPayload,
  ) {
    const item = await this.prisma.escalaItem.findUnique({
      where: { id: itemId },
      include: {
        escalaDia: {
          include: {
            escala: {
              include: {
                ministerio: { select: { nome: true } },
              },
            },
          },
        },
        membro: { select: { id: true, nome: true, nomeExibicao: true } },
        funcao: { select: { nome: true } },
      }
    });

    if (!item) {
      throw new NotFoundException('Item de escala não encontrado.');
    }

    const escala = item.escalaDia.escala;

    if (escala.tenantId !== tenantId) throw new ForbiddenException();

    if (escala.status !== StatusEscala.PUBLICADA) {
      throw new BadRequestException(
        'Só é possível confirmar itens de uma escala publicada.',
      );
    }

    // BASIC só pode confirmar a própria escalação
    if (user.role === Role.BASIC && item.membroId !== user.memberId) {
      throw new ForbiddenException(
        'Você só pode confirmar ou recusar a sua própria escalação.',
      );
    }

    const shouldNotifyLeadership =
      item.statusConfirmacao !== dto.statusConfirmacao &&
      (dto.statusConfirmacao === StatusConfirmacao.CONFIRMADO ||
        dto.statusConfirmacao === StatusConfirmacao.RECUSADO);

    const updated = await this.prisma.escalaItem.update({
      where: { id: itemId },
      data: {
        statusConfirmacao: dto.statusConfirmacao,
        observacoes: dto.observacoes || item.observacoes,
      },
    });

    if (shouldNotifyLeadership) {
      await this.notifyLeadershipAboutConfirmationResponse(
        tenantId,
        item,
        dto.statusConfirmacao,
        user.sub,
      );
    }

    return updated;
  }

  async toggleDiaFuncaoOculta(
    tenantId: string,
    diaId: string,
    dto: ToggleDiaFuncaoOcultaDto,
    user: JwtPayload,
  ) {
    const dia = await this.prisma.escalaDia.findUnique({
      where: { id: diaId },
      include: { escala: true },
    });
    if (!dia) throw new NotFoundException('Dia não encontrado.');
    if (dia.escala.tenantId !== tenantId) throw new ForbiddenException();

    if (user.role === Role.BASIC) {
      await this.checkMinistryAccess(dia.escala.ministerioId, user.memberId);
    }

    this.assertEscalaAbertaParaEdicao(dia.escala.status);

    if (dto.ocultar) {
      await this.prisma.escalaDiaFuncaoOculta.upsert({
        where: { diaId_funcaoId: { diaId, funcaoId: dto.funcaoId } },
        create: { diaId, funcaoId: dto.funcaoId },
        update: {},
      });
    } else {
      await this.prisma.escalaDiaFuncaoOculta.deleteMany({
        where: { diaId, funcaoId: dto.funcaoId },
      });
    }

    return { diaId, funcaoId: dto.funcaoId, ocultar: dto.ocultar };
  }

  async updateItemStatus(
    tenantId: string,
    itemId: string,
    dto: ConfirmarEscalaItemDto,
    user: JwtPayload,
  ) {
    const item = await this.prisma.escalaItem.findUnique({
      where: { id: itemId },
      include: {
        escalaDia: {
          include: { escala: true }
        }
      }
    });

    if (!item) throw new NotFoundException();

    const escala = item.escalaDia.escala;

    if (user.role === Role.BASIC) {
      await this.checkMinistryAccess(escala.ministerioId, user.memberId);
    }

    return this.prisma.escalaItem.update({
      where: { id: itemId },
      data: {
        statusConfirmacao: dto.statusConfirmacao,
        observacoes: dto.observacoes,
      },
    });
  }
}
