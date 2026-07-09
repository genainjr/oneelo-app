import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventoTipo, MinistryRole, Prisma, Role } from '@prisma/client';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { CreateEventoDto } from './dto/create-evento.dto';
import { FilterEventosDto } from './dto/filter-eventos.dto';
import { UpdateEventoDto } from './dto/update-evento.dto';

const eventoInclude: Prisma.EventoInclude = {
  ministerios: {
    include: {
      ministerio: {
        select: {
          id: true,
          nome: true,
        },
      },
    },
  },
};

@Injectable()
export class EventosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  private uniqueIds(ids?: string[]) {
    return [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))];
  }

  private async getMinisterioIdsDoUsuario(tenantId: string, user: JwtPayload) {
    if (!user.memberId) {
      return [];
    }

    const liderancas = await this.prisma.ministerioMembro.findMany({
      where: {
        membroId: user.memberId,
        role: { in: [MinistryRole.LEADER, MinistryRole.ASSISTANT_LEADER] },
        ministerio: {
          tenantId,
          ativo: true,
        },
      },
      select: {
        ministerioId: true,
      },
    });

    return [...new Set(liderancas.map((lideranca) => lideranca.ministerioId))];
  }

  private async canManageEvent(tenantId: string, eventoId: string, user: JwtPayload) {
    if (this.authorization.canManageTenant(user)) {
      return true;
    }

    if (user.role !== Role.BASIC || !user.memberId) {
      return false;
    }

    const evento = await this.prisma.evento.findFirst({
      where: {
        id: eventoId,
        tenantId,
        tipo: { in: [EventoTipo.MINISTERIO, EventoTipo.REUNIAO_INTERNA] },
        ministerios: {
          some: {
            ministerio: {
              tenantId,
              ativo: true,
              membros: {
                some: {
                  membroId: user.memberId,
                  role: { in: [MinistryRole.LEADER, MinistryRole.ASSISTANT_LEADER] },
                },
              },
            },
          },
        },
      },
      select: { id: true },
    });

    return Boolean(evento);
  }

  private async validateMinisterios(
    tenantId: string,
    ministerioIds: string[],
    user: JwtPayload,
    tipo: EventoTipo,
  ) {
    if (ministerioIds.length === 0) {
      return [];
    }

    const ministerios = await this.prisma.ministerio.findMany({
      where: {
        id: { in: ministerioIds },
        tenantId,
        ativo: true,
      },
      select: { id: true },
    });

    if (ministerios.length !== ministerioIds.length) {
      throw new NotFoundException('Um ou mais ministérios não foram encontrados.');
    }

    if (this.authorization.canManageTenant(user)) {
      return ministerios.map((ministerio) => ministerio.id);
    }

    if (user.role !== Role.BASIC || !user.memberId) {
      throw new ForbiddenException('Acesso negado para manipular este evento.');
    }

    const permitidos = await this.getMinisterioIdsDoUsuario(tenantId, user);
    if (permitidos.length === 0) {
      throw new ForbiddenException('Você não lidera ou auxilia ministérios elegíveis.');
    }

    const invalidos = ministerioIds.filter((id) => !permitidos.includes(id));
    if (invalidos.length > 0) {
      throw new ForbiddenException('Você só pode usar ministérios que lidera ou auxilia.');
    }

    if (tipo === EventoTipo.MINISTERIO && ministerioIds.length === 0) {
      throw new BadRequestException('Evento do tipo ministério exige pelo menos 1 ministério vinculado.');
    }

    if (tipo === EventoTipo.REUNIAO_INTERNA && ministerioIds.length === 0) {
      throw new BadRequestException('Reunião interna exige ao menos 1 ministério para BASIC.');
    }

    return ministerioIds;
  }

  private async buildVisibilityWhere(tenantId: string, query: FilterEventosDto, user: JwtPayload) {
    const where: Prisma.EventoWhereInput = { tenantId };

    if (query.status) {
      where.status = query.status as any;
    }

    if (query.tipo) {
      where.tipo = query.tipo;
    }

    if (query.ministerioId) {
      where.ministerios = {
        some: {
          ministerioId: query.ministerioId,
        },
      };
    }

    if (query.dataInicio || query.dataFim) {
      where.AND = [];

      if (query.dataInicio) {
        where.AND.push({
          dataInicio: { gte: new Date(query.dataInicio) },
        });
      }

      if (query.dataFim) {
        where.AND.push({
          dataInicio: { lte: new Date(query.dataFim) },
        });
      }
    }

    if (user.role === Role.BASIC) {
      const ministerioIds = await this.getMinisterioIdsDoUsuario(tenantId, user);
      const visibleScopes: Prisma.EventoWhereInput[] = [
        {
          tipo: {
            in: [EventoTipo.GERAL, EventoTipo.MINISTERIO],
          },
        },
      ];

      if (ministerioIds.length > 0) {
        visibleScopes.push({
          tipo: EventoTipo.REUNIAO_INTERNA,
          ministerios: {
            some: {
              ministerioId: {
                in: ministerioIds,
              },
            },
          },
        });
      }

      return {
        ...where,
        OR: visibleScopes,
      };
    }

    return where;
  }

  private async getEventoPorId(tenantId: string, id: string, user: JwtPayload) {
    const where = await this.buildVisibilityWhere(tenantId, { } as FilterEventosDto, user);
    const evento = await this.prisma.evento.findFirst({
      where: {
        ...where,
        id,
      },
      include: eventoInclude,
    });

    if (!evento) {
      throw new NotFoundException('Evento não encontrado.');
    }

    return evento;
  }

  async create(tenantId: string, dto: CreateEventoDto, user: JwtPayload) {
    const tipo = dto.tipo ?? EventoTipo.GERAL;
    const ministerioIds = this.uniqueIds(dto.ministerioIds);

    if (dto.dataFim && new Date(dto.dataFim) < new Date(dto.dataInicio)) {
      throw new BadRequestException('Data final não pode ser anterior à data inicial.');
    }

    if (tipo === EventoTipo.GERAL && ministerioIds.length > 0) {
      throw new BadRequestException('Eventos gerais não devem possuir ministérios vinculados.');
    }

    if (tipo === EventoTipo.MINISTERIO && ministerioIds.length === 0) {
      throw new BadRequestException('Evento do tipo ministério exige pelo menos 1 ministério vinculado.');
    }

    if (user.role === Role.BASIC) {
      if (tipo === EventoTipo.GERAL) {
        throw new ForbiddenException('Usuários BASIC não podem criar eventos gerais.');
      }

      if (!user.memberId) {
        throw new ForbiddenException('Usuário BASIC sem membro vinculado não pode criar eventos.');
      }

      const ministeriosPermitidos = await this.getMinisterioIdsDoUsuario(tenantId, user);
      if (ministeriosPermitidos.length === 0) {
        throw new ForbiddenException('Você não lidera ou auxilia ministérios elegíveis.');
      }

      if (tipo === EventoTipo.REUNIAO_INTERNA && ministerioIds.length === 0) {
        throw new BadRequestException('Reunião interna exige ao menos um ministério.');
      }

      const invalidos = ministerioIds.filter((id) => !ministeriosPermitidos.includes(id));
      if (invalidos.length > 0) {
        throw new ForbiddenException('Você só pode criar eventos para ministérios que lidera ou auxilia.');
      }
    }

    const ministeriosValidos = await this.validateMinisterios(tenantId, ministerioIds, user, tipo);

    return this.prisma.evento.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        tipo,
        dataInicio: new Date(dto.dataInicio),
        dataFim: dto.dataFim ? new Date(dto.dataFim) : undefined,
        local: dto.local,
        status: dto.status,
        tenantId,
        ministerios: ministeriosValidos.length
          ? {
              create: ministeriosValidos.map((ministerioId) => ({
                ministerioId,
              })),
            }
          : undefined,
      },
      include: eventoInclude,
    });
  }

  async findAll(tenantId: string, query: FilterEventosDto, user: JwtPayload) {
    const where = await this.buildVisibilityWhere(tenantId, query, user);

    return this.prisma.evento.findMany({
      where,
      orderBy: { dataInicio: 'asc' },
      include: eventoInclude,
    });
  }

  async findOne(tenantId: string, id: string, user: JwtPayload) {
    return this.getEventoPorId(tenantId, id, user);
  }

  async update(tenantId: string, id: string, dto: UpdateEventoDto, user: JwtPayload) {
    if (!(await this.canManageEvent(tenantId, id, user))) {
      throw new ForbiddenException('Acesso negado para manipular este evento.');
    }

    const eventoAtual = await this.getEventoPorId(tenantId, id, user);
    const tipo = dto.tipo ?? eventoAtual.tipo;
    const ministerioIdsInput =
      dto.ministerioIds !== undefined
        ? this.uniqueIds(dto.ministerioIds)
        : tipo === EventoTipo.GERAL
          ? []
          : eventoAtual.ministerios.map((relacao) => relacao.ministerioId);

    if (dto.dataInicio && dto.dataFim && new Date(dto.dataFim) < new Date(dto.dataInicio)) {
      throw new BadRequestException('Data final não pode ser anterior à data inicial.');
    }

    if (tipo === EventoTipo.GERAL && ministerioIdsInput.length > 0) {
      throw new BadRequestException('Eventos gerais não devem possuir ministérios vinculados.');
    }

    if (user.role === Role.BASIC && tipo === EventoTipo.GERAL) {
      throw new ForbiddenException('Usuários BASIC não podem transformar eventos em gerais.');
    }

    if (tipo === EventoTipo.MINISTERIO && ministerioIdsInput.length === 0) {
      throw new BadRequestException('Evento de ministério exige ao menos um ministério.');
    }

    const ministeriosValidos = await this.validateMinisterios(
      tenantId,
      ministerioIdsInput,
      user,
      tipo,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.evento.update({
        where: { id },
        data: {
          titulo: dto.titulo,
          descricao: dto.descricao,
          tipo,
          dataInicio: dto.dataInicio ? new Date(dto.dataInicio) : undefined,
          dataFim: dto.dataFim ? new Date(dto.dataFim) : undefined,
          local: dto.local,
          status: dto.status,
        },
      });

      if (dto.tipo !== undefined || dto.ministerioIds !== undefined) {
        await tx.eventoMinisterio.deleteMany({ where: { eventoId: id } });

        if (ministeriosValidos.length > 0 && tipo !== EventoTipo.GERAL) {
          await tx.eventoMinisterio.createMany({
            data: ministeriosValidos.map((ministerioId) => ({
              eventoId: id,
              ministerioId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.evento.findFirst({
        where: { id, tenantId },
        include: eventoInclude,
      });
    });
  }

  async remove(tenantId: string, id: string, user: JwtPayload) {
    if (!(await this.canManageEvent(tenantId, id, user))) {
      throw new ForbiddenException('Acesso negado para manipular este evento.');
    }

    await this.getEventoPorId(tenantId, id, user);

    await this.prisma.evento.delete({ where: { id } });

    return { message: 'Evento removido com sucesso.' };
  }
}


