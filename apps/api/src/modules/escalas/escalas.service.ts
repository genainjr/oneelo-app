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
import { ManageEscalaItemDto } from './dto/manage-escala-item.dto';
import { ConfirmarEscalaItemDto } from './dto/confirmar-escala-item.dto';
import { Role, MinistryRole, StatusConfirmacao, StatusEscala } from '@prisma/client';
import { JwtPayload } from '../../common/types/jwt-payload.interface';

@Injectable()
export class EscalasService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.escala.create({
      data: {
        mes: dto.mes,
        ano: dto.ano,
        observacoes: dto.observacoes,
        ministerioId: dto.ministerioId,
        tenantId,
        status: StatusEscala.RASCUNHO,
      },
    });
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
          where.dias = {
            some: { itens: { some: { membroId: user.memberId } } }
          };
        } else {
          where.ministerioId = { in: idsLiderados };
        }
      } else {
        // Membro comum: vê apenas escalas onde está escalado
        where.dias = {
          some: { itens: { some: { membroId: user.memberId } } }
        };
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
          orderBy: { data: 'asc' },
          include: {
            itens: {
              include: {
                membro: { select: { id: true, nome: true, email: true, whatsapp: true } },
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

    return this.prisma.escala.update({
      where: { id },
      data,
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

    return this.prisma.escalaDia.create({
      data: {
        escalaId,
        data: new Date(body.data),
        titulo: body.titulo
      }
    });
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

    // Verificar conflito
    const hasConflito = await this.prisma.escalaItem.findFirst({
      where: {
        escalaDiaId: diaId,
        membroId: dto.membroId,
      }
    });

    if (hasConflito && hasConflito.ministerioFuncaoId !== dto.ministerioFuncaoId) {
      throw new BadRequestException('Membro já está escalado neste dia em outra função. Remova-o primeiro.');
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