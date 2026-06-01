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
import { Role, StatusConfirmacao, StatusEscala } from '@prisma/client';
import { JwtPayload } from '../../common/types/jwt-payload.interface';

@Injectable()
export class EscalasService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkMinistryLeadership(
    ministerioId: string,
    userId: string,
  ): Promise<void> {
    const isLider = await this.prisma.ministerioLider.findUnique({
      where: {
        ministerioId_userId: {
          ministerioId,
          userId,
        },
      },
    });

    if (!isLider) {
      throw new ForbiddenException(
        'Acesso negado: você não lidera este ministério.',
      );
    }
  }

  async create(tenantId: string, dto: CreateEscalaDto, user: JwtPayload) {
    const ministerio = await this.prisma.ministerio.findFirst({
      where: { id: dto.ministerioId, tenantId },
    });

    if (!ministerio) {
      throw new NotFoundException('Ministério não encontrado.');
    }

    if (user.role === Role.LIDER_MINISTERIO) {
      await this.checkMinistryLeadership(dto.ministerioId, user.sub);
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

    if (user.role === Role.LIDER_MINISTERIO) {
      const liderados = await this.prisma.ministerioLider.findMany({
        where: { userId: user.sub },
        select: { ministerioId: true },
      });
      const idsLiderados = liderados.map((l) => l.ministerioId);

      if (query.ministerioId && !idsLiderados.includes(query.ministerioId)) {
        throw new ForbiddenException(
          'Acesso negado: você não lidera o ministério solicitado.',
        );
      }
      where.ministerioId = { in: idsLiderados };
    } else if (user.role === Role.MEMBRO) {
      const membro = await this.prisma.client.membro.findFirst({
        where: { email: user.email, tenantId },
      });
      if (!membro) return [];

      where.dias = {
        some: {
          itens: { some: { membroId: membro.id } }
        }
      };
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

    if (user.role === Role.LIDER_MINISTERIO) {
      await this.checkMinistryLeadership(escala.ministerioId, user.sub);
    } else if (user.role === Role.MEMBRO) {
      const membro = await this.prisma.client.membro.findFirst({
        where: { email: user.email, tenantId },
      });
      if (!membro) {
        throw new ForbiddenException('Acesso negado: você não possui um membro vinculado.');
      }
      
      let isEscalado = false;
      for(const d of escala.dias) {
         if (d.itens.some((item) => item.membroId === membro.id)) {
           isEscalado = true;
           break;
         }
      }
      if (!isEscalado) {
        throw new ForbiddenException('Acesso negado: você não está associado a esta escala.');
      }
    }

    return escala;
  }

  async update(tenantId: string, id: string, dto: UpdateEscalaDto, user: JwtPayload) {
    const escala = await this.findOne(tenantId, id, user);

    if (user.role === Role.LIDER_MINISTERIO) {
      await this.checkMinistryLeadership(escala.ministerioId, user.sub);
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

    if (user.role === Role.LIDER_MINISTERIO) {
      await this.checkMinistryLeadership(escala.ministerioId, user.sub);
    }

    await this.prisma.escala.delete({
      where: { id },
    });

    return { message: 'Escala removida com sucesso.' };
  }

  // ─── Gestão de Dias ─────────────────────────────
  async addDia(tenantId: string, escalaId: string, body: { data: string, titulo?: string }, user: JwtPayload) {
    const escala = await this.findOne(tenantId, escalaId, user);
    if (user.role === Role.LIDER_MINISTERIO) {
      await this.checkMinistryLeadership(escala.ministerioId, user.sub);
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
    if(!dia) throw new NotFoundException('Dia não encontrado.');

    if (dia.escala.tenantId !== tenantId) throw new ForbiddenException();

    if (user.role === Role.LIDER_MINISTERIO) {
      await this.checkMinistryLeadership(dia.escala.ministerioId, user.sub);
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
    if(!dia) throw new NotFoundException('Dia não encontrado.');

    const escala = dia.escala;

    if (user.role === Role.LIDER_MINISTERIO) {
      await this.checkMinistryLeadership(escala.ministerioId, user.sub);
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

    if (user.role === Role.LIDER_MINISTERIO) {
      await this.checkMinistryLeadership(escala.ministerioId, user.sub);
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

    if (item.membro.email !== user.email && user.role === Role.MEMBRO) {
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

    if (user.role === Role.LIDER_MINISTERIO) {
      await this.checkMinistryLeadership(escala.ministerioId, user.sub);
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
