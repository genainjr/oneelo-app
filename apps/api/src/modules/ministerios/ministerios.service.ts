import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateMinisterioDto } from './dto/create-ministerio.dto';
import { UpdateMinisterioDto } from './dto/update-ministerio.dto';
import { Role, MinistryRole, StatusMembro } from '@prisma/client';
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { AuthorizationService } from '../../common/authorization/authorization.service';

@Injectable()
export class MinisteriosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  private buildVisibleWhere(tenantId: string, user: JwtPayload) {
    const where: any = { tenantId, ativo: true };

    // BASIC vê apenas os ministérios em que participa como LEADER ou ASSISTANT_LEADER
    if (user.role === Role.BASIC) {
      if (!user.memberId) return null;
      where.membros = {
        some: {
          membroId: user.memberId,
          role: { in: [MinistryRole.LEADER, MinistryRole.ASSISTANT_LEADER] },
        },
      };
    }

    return where;
  }

  async create(tenantId: string, dto: CreateMinisterioDto) {
    const { funcoes, ...ministerioData } = dto;
    const ministerio = await this.prisma.ministerio.create({
      data: {
        ...ministerioData,
        tenantId,
      },
    });

    if (funcoes && funcoes.length > 0) {
      await this.prisma.ministerioFuncao.createMany({
        data: funcoes.map((f, i) => ({
          ministerioId: ministerio.id,
          nome: f,
          ordem: i
        }))
      });
    }

    return ministerio;
  }

  async findAll(tenantId: string, user: JwtPayload) {
    const where = this.buildVisibleWhere(tenantId, user);
    if (!where) return [];

    const ministerios = await this.prisma.ministerio.findMany({
      where,
      include: {
        membros: {
          where: {
            role: { in: [MinistryRole.LEADER, MinistryRole.ASSISTANT_LEADER] },
            membro: { deletedAt: null, status: StatusMembro.ATIVO },
          },
          orderBy: {
            membro: { nome: 'asc' },
          },
          include: {
            membro: { select: { id: true, nome: true, nomeExibicao: true, email: true } },
          },
        },
        _count: {
          select: {
            membros: {
              where: {
                membro: { deletedAt: null, status: StatusMembro.ATIVO },
              },
            },
            escalas: true,
          },
        },
        funcoes: {
          orderBy: { ordem: 'asc' }
        }
      },
      orderBy: { nome: 'asc' },
    });

    const roleOrder: Record<MinistryRole, number> = {
      LEADER: 0,
      ASSISTANT_LEADER: 1,
      MEMBER: 2,
    };

    return ministerios.map((ministerio) => ({
      ...ministerio,
      membros: ministerio.membros.slice().sort((a, b) => {
        const roleDiff = roleOrder[a.role] - roleOrder[b.role];
        if (roleDiff !== 0) return roleDiff;
        return (a.membro?.nome ?? '').localeCompare(b.membro?.nome ?? '', 'pt-BR');
      }),
    }));
  }

  async findResumo(tenantId: string, user: JwtPayload) {
    const where = this.buildVisibleWhere(tenantId, user);
    if (!where) {
      return { ministerios: 0, membros: 0, aniversariantes: 0 };
    }

    const currentMonth = new Date().getMonth() + 1;

    const [ministeriosCount, membros, aniversariantes] = await Promise.all([
      this.prisma.ministerio.count({ where }),
      this.prisma.client.ministerioMembro.findMany({
        where: {
          ministerio: where,
          membro: { deletedAt: null, status: StatusMembro.ATIVO },
        },
        select: {
          membroId: true,
        },
        distinct: ['membroId'],
      }),
      this.prisma.client.ministerioMembro.findMany({
        where: {
          ministerio: where,
          membro: {
            deletedAt: null,
            status: StatusMembro.ATIVO,
            dataNascimento: { not: null },
          },
        },
        distinct: ['membroId'],
        select: {
          membroId: true,
          membro: {
            select: {
              dataNascimento: true,
            },
          },
        },
      }),
    ]);

    return {
      ministerios: ministeriosCount,
      membros: membros.length,
      aniversariantes: aniversariantes.filter((item) => {
        if (!item.membro?.dataNascimento) return false;
        return new Date(item.membro.dataNascimento).getMonth() + 1 === currentMonth;
      }).length,
    };
  }

  async findOne(tenantId: string, id: string, user: JwtPayload) {
    const ministerio = await this.prisma.ministerio.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        membros: {
          where: {
            membro: { deletedAt: null, status: StatusMembro.ATIVO },
          },
          orderBy: {
            membro: { nome: 'asc' },
          },
          include: {
            membro: {
              select: {
                id: true,
                nome: true,
                nomeExibicao: true,
                whatsapp: true,
                email: true,
                status: true,
              },
            },
            funcoesDisponiveis: {
              include: { funcao: { select: { id: true, nome: true } } },
            },
          },
        },
        _count: {
          select: { escalas: true },
        },
        funcoes: {
          orderBy: { ordem: 'asc' }
        }
      },
    });

    if (!ministerio) {
      throw new NotFoundException('Ministério não encontrado.');
    }

    // BASIC só pode ver ministérios em que participa como LEADER/ASSISTANT_LEADER
    if (user.role === Role.BASIC) {
      const isLeader = ministerio.membros.some(
        (m) => m.membroId === user.memberId &&
          (m.role === MinistryRole.LEADER || m.role === MinistryRole.ASSISTANT_LEADER),
      );
      if (!isLeader) {
        throw new ForbiddenException('Acesso negado a este ministério.');
      }
    }

    return ministerio;
  }

  async findMembrosDisponiveis(tenantId: string, ministerioId: string, user: JwtPayload) {
    const ministerio = await this.prisma.ministerio.findFirst({
      where: { id: ministerioId, tenantId },
    });
    if (!ministerio) {
      throw new NotFoundException('Ministério não encontrado.');
    }

    await this.authorization.assertCanManageMinistry(user, ministerioId);

    return this.prisma.client.membro.findMany({
      where: {
        tenantId,
        status: StatusMembro.ATIVO,
        ministerios: {
          none: { ministerioId },
        },
      },
      select: {
        id: true,
        tenantId: true,
        nome: true,
        email: true,
        whatsapp: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { nome: 'asc' },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateMinisterioDto, user: JwtPayload) {
    await this.findOne(tenantId, id, user);

    const { funcoes, ...ministerioData } = dto;

    await this.prisma.ministerio.update({
      where: { id },
      data: ministerioData,
    });

    if (funcoes) {
      try {
        await this.prisma.ministerioFuncao.deleteMany({
          where: {
            ministerioId: id,
            nome: { notIn: funcoes }
          }
        });
      } catch (e) {
        // Ignora possíveis erros de foreign key
      }

      for (let i = 0; i < funcoes.length; i++) {
        const fNome = funcoes[i];
        await this.prisma.ministerioFuncao.upsert({
          where: { ministerioId_nome: { ministerioId: id, nome: fNome } },
          create: { ministerioId: id, nome: fNome, ordem: i },
          update: { ordem: i }
        });
      }
    }

    return this.findOne(tenantId, id, user);
  }

  async remove(tenantId: string, id: string, user: JwtPayload) {
    await this.findOne(tenantId, id, user);

    return this.prisma.ministerio.update({
      where: { id },
      data: { ativo: false },
    });
  }

  async addMembro(
    tenantId: string,
    ministerioId: string,
    membroId: string,
    role: MinistryRole = MinistryRole.MEMBER,
    funcaoIds: string[] | undefined,
    user: JwtPayload,
  ) {
    const ministerio = await this.prisma.ministerio.findFirst({
      where: { id: ministerioId, tenantId },
    });
    if (!ministerio) throw new NotFoundException('Ministério não encontrado.');

    await this.authorization.assertCanManageMinistry(user, ministerioId);

    if (role === MinistryRole.LEADER && !this.authorization.canManageTenant(user)) {
      throw new ForbiddenException('Apenas administradores podem definir líderes.');
    }

    const membro = await this.prisma.client.membro.findFirst({
      where: { id: membroId, tenantId, status: StatusMembro.ATIVO },
    });
    if (!membro) throw new NotFoundException('Membro não encontrado.');

    await this.prisma.ministerioMembro.upsert({
      where: {
        ministerioId_membroId: { ministerioId, membroId },
      },
      create: { ministerioId, membroId, role },
      update: { role },
    });

    if (funcaoIds !== undefined) {
      await this.syncFuncoesDisponiveis(ministerioId, membroId, funcaoIds);
    }

    return { message: 'Membro adicionado ao ministério com sucesso.' };
  }

  private async syncFuncoesDisponiveis(ministerioId: string, membroId: string, funcaoIds: string[]) {
    await this.prisma.ministerioMembroFuncao.deleteMany({
      where: { ministerioId, membroId, funcaoId: { notIn: funcaoIds } },
    });
    if (funcaoIds.length > 0) {
      await this.prisma.ministerioMembroFuncao.createMany({
        data: funcaoIds.map((funcaoId) => ({ ministerioId, membroId, funcaoId })),
        skipDuplicates: true,
      });
    }
  }

  async removeMembro(tenantId: string, ministerioId: string, membroId: string, user: JwtPayload) {
    const ministerio = await this.prisma.ministerio.findFirst({
      where: { id: ministerioId, tenantId },
    });
    if (!ministerio) throw new NotFoundException('Ministério não encontrado.');

    // LEADER não pode remover outro LEADER
    await this.authorization.assertCanManageMinistry(user, ministerioId);

    if (!this.authorization.canManageTenant(user)) {
      const targetMember = await this.prisma.ministerioMembro.findUnique({
        where: { ministerioId_membroId: { ministerioId, membroId } },
      });
      if (targetMember?.role === MinistryRole.LEADER) {
        throw new ForbiddenException('Líderes não podem remover outros líderes.');
      }
    }

    await this.prisma.ministerioMembro.deleteMany({
      where: { ministerioId, membroId },
    });

    return { message: 'Membro removido do ministério com sucesso.' };
  }

  async updateMembroRole(tenantId: string, ministerioId: string, membroId: string, role: MinistryRole | undefined, funcaoIds: string[] | undefined, user: JwtPayload) {
    const ministerio = await this.prisma.ministerio.findFirst({
      where: { id: ministerioId, tenantId },
    });
    if (!ministerio) throw new NotFoundException('Ministério não encontrado.');

    await this.authorization.assertCanManageMinistry(user, ministerioId);

    const membership = await this.prisma.ministerioMembro.findUnique({
      where: { ministerioId_membroId: { ministerioId, membroId } },
    });
    if (!membership) throw new NotFoundException('Membro não participa deste ministério.');

    if (role !== undefined) {
      if (
        !this.authorization.canManageTenant(user) &&
        (role === MinistryRole.LEADER ||
          membership.role === MinistryRole.LEADER ||
          user.memberId === membroId)
      ) {
        throw new ForbiddenException('Apenas administradores podem alterar papéis no ministério.');
      }
      // Apenas ADMIN/STAFF podem promover a LEADER
      if (role === MinistryRole.LEADER && user.role === Role.BASIC) {
        throw new ForbiddenException('Apenas administradores podem definir líderes.');
      }
      // LEADER não pode se auto-promover
      if (user.memberId === membroId && role === MinistryRole.LEADER) {
        throw new ForbiddenException('Você não pode se auto-promover a líder.');
      }
      await this.prisma.ministerioMembro.update({
        where: { ministerioId_membroId: { ministerioId, membroId } },
        data: { role },
      });
    }

    if (funcaoIds !== undefined) {
      await this.syncFuncoesDisponiveis(ministerioId, membroId, funcaoIds);
    }

    return { message: 'Membro atualizado com sucesso.' };
  }
}
