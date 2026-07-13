import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateEscalaDto } from './dto/create-escala.dto';
import { UpdateEscalaDto } from './dto/update-escala.dto';
import { FilterEscalaDto } from './dto/filter-escala.dto';
import { FilterEscalaVisualizacaoDto } from './dto/filter-escala-visualizacao.dto';
import { ManageEscalaItemDto } from './dto/manage-escala-item.dto';
import { ConfirmarEscalaItemDto } from './dto/confirmar-escala-item.dto';
import { ReorderDiasDto } from './dto/reorder-dias.dto';
import { ToggleDiaFuncaoOcultaDto } from './dto/toggle-dia-funcao-oculta.dto';
import { Role, MinistryRole, StatusConfirmacao, StatusEscala } from '@prisma/client';
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

  async create(tenantId: string, dto: CreateEscalaDto, user: JwtPayload) {
    const ministerio = await this.prisma.ministerio.findFirst({
      where: { id: dto.ministerioId, tenantId },
    });

    if (!ministerio) {
      throw new NotFoundException('Ministério não encontrado.');
    }

    if (user.role === Role.BASIC) {
      await this.checkMinistryAccess(dto.ministerioId, user.memberId);
    }

    const existing = await this.prisma.escala.findUnique({
      where: {
        ministerioId_mes_ano: {
          ministerioId: dto.ministerioId,
          mes: dto.mes,
          ano: dto.ano,
        }
      }
    });

    if (existing) {
      throw new BadRequestException('A escala mensal para este ministério neste mês e ano já existe.');
    }

    const escala = await this.prisma.escala.create({
      data: {
        mes: dto.mes,
        ano: dto.ano,
        observacoes: dto.observacoes,
        ministerioId: dto.ministerioId,
        tenantId,
        status: StatusEscala.RASCUNHO,
      },
    });

    if (dto.diasSemana?.length) {
      const datas = this.gerarDiasDoMes(dto.mes, dto.ano, dto.diasSemana);
      if (datas.length > 0) {
        await this.prisma.escalaDia.createMany({
          data: datas.map((data) => ({ escalaId: escala.id, data })),
        });
      }
    }

    return escala;
  }

  private gerarDiasDoMes(mes: number, ano: number, diasSemana: number[]): Date[] {
    const dias: Date[] = [];
    const totalDias = new Date(ano, mes, 0).getDate();
    for (let d = 1; d <= totalDias; d++) {
      const dt = new Date(ano, mes - 1, d);
      if (diasSemana.includes(dt.getDay())) {
        dias.push(dt);
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
        titulo: item.escalaDia.titulo,
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
      const transicaoValida =
        (escala.status === StatusEscala.RASCUNHO && dto.status === StatusEscala.PUBLICADA) ||
        (escala.status === StatusEscala.PUBLICADA && dto.status === StatusEscala.ENCERRADA);

      if (!transicaoValida) {
        throw new BadRequestException(
          `Transição de status inválida: não é possível ir de "${escala.status}" para "${dto.status}".`,
        );
      }
    }

    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    const updated = await this.prisma.escala.update({
      where: { id },
      data,
      });

    if (escala.status === StatusEscala.RASCUNHO && dto.status === StatusEscala.PUBLICADA) {
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
              },
            },
          },
        },
      },
    });

    if (!escala) return;

    const userIds = escala.dias
      .flatMap((dia) => dia.itens)
      .map((item) => item.membro.user)
      .filter((user): user is { id: string; ativo: boolean } => Boolean(user?.id && user.ativo))
      .map((user) => user.id);

    if (userIds.length === 0) return;

    await this.notificationsService.sendToUsers(tenantId, userIds, {
      title: 'Nova Escala Publicada',
      body: `Você foi escalado em ${escala.ministerio.nome}.\nConfirme sua presença no One Elo.`,
      url: '/minhas-escalas?pendentesApenas=true',
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
  async addDia(tenantId: string, escalaId: string, body: { data: string, titulo?: string }, user: JwtPayload) {
    const escala = await this.findOne(tenantId, escalaId, user);
    if (user.role === Role.BASIC) {
      await this.checkMinistryAccess(escala.ministerioId, user.memberId);
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
        data: new Date(body.data),
        titulo: body.titulo,
        ordem,
      }
    });
  }

  async reorderDias(tenantId: string, escalaId: string, dto: ReorderDiasDto, user: JwtPayload) {
    const escala = await this.findOne(tenantId, escalaId, user);
    if (user.role === Role.BASIC) {
      await this.checkMinistryAccess(escala.ministerioId, user.memberId);
    }

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

    if (escala.status === StatusEscala.ENCERRADA) {
      throw new BadRequestException('Não é possível adicionar membros a uma escala encerrada.');
    }

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

    if (escala.status === StatusEscala.ENCERRADA) {
      throw new BadRequestException('Não é possível remover membros de uma escala encerrada.');
    }

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
          include: { escala: true }
        },
        membro: true
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

    return this.prisma.escalaItem.update({
      where: { id: itemId },
      data: {
        statusConfirmacao: dto.statusConfirmacao,
        observacoes: dto.observacoes || item.observacoes,
      },
    });
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
