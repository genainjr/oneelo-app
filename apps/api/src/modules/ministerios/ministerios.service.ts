import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateMinisterioDto } from './dto/create-ministerio.dto';
import { UpdateMinisterioDto } from './dto/update-ministerio.dto';
import { Role, MinistryRole } from '@prisma/client';
import { JwtPayload } from '../../common/types/jwt-payload.interface';

@Injectable()
export class MinisteriosService {
  constructor(private readonly prisma: PrismaService) {}

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
    const where: any = { tenantId, ativo: true };

    // BASIC vê apenas os ministérios em que participa como LEADER ou ASSISTANT_LEADER
    if (user.role === Role.BASIC) {
      if (!user.memberId) return [];
      where.membros = {
        some: {
          membroId: user.memberId,
          role: { in: [MinistryRole.LEADER, MinistryRole.ASSISTANT_LEADER] },
        },
      };
    }

    return this.prisma.ministerio.findMany({
      where,
      include: {
        membros: {
          where: { role: { in: [MinistryRole.LEADER, MinistryRole.ASSISTANT_LEADER] } },
          include: {
            membro: { select: { id: true, nome: true, email: true } },
          },
        },
        _count: {
          select: { membros: true, escalas: true },
        },
        funcoes: {
          orderBy: { ordem: 'asc' }
        }
      },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string, user: JwtPayload) {
    const ministerio = await this.prisma.ministerio.findFirst({
      where: { id, tenantId },
      include: {
        membros: {
          include: {
            membro: {
              select: {
                id: true,
                nome: true,
                whatsapp: true,
                email: true,
                status: true,
              },
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

  async addMembro(tenantId: string, ministerioId: string, membroId: string, role: MinistryRole = MinistryRole.MEMBER) {
    const ministerio = await this.prisma.ministerio.findFirst({
      where: { id: ministerioId, tenantId },
    });
    if (!ministerio) throw new NotFoundException('Ministério não encontrado.');

    const membro = await this.prisma.client.membro.findFirst({
      where: { id: membroId, tenantId },
    });
    if (!membro) throw new NotFoundException('Membro não encontrado.');

    await this.prisma.ministerioMembro.upsert({
      where: {
        ministerioId_membroId: { ministerioId, membroId },
      },
      create: { ministerioId, membroId, role },
      update: { role },
    });

    return { message: 'Membro adicionado ao ministério com sucesso.' };
  }

  async removeMembro(tenantId: string, ministerioId: string, membroId: string, user: JwtPayload) {
    const ministerio = await this.prisma.ministerio.findFirst({
      where: { id: ministerioId, tenantId },
    });
    if (!ministerio) throw new NotFoundException('Ministério não encontrado.');

    // LEADER não pode remover outro LEADER
    if (user.role === Role.BASIC) {
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

  async updateMembroRole(tenantId: string, ministerioId: string, membroId: string, role: MinistryRole, user: JwtPayload) {
    const ministerio = await this.prisma.ministerio.findFirst({
      where: { id: ministerioId, tenantId },
    });
    if (!ministerio) throw new NotFoundException('Ministério não encontrado.');

    // Apenas ADMIN/STAFF podem promover a LEADER
    if (role === MinistryRole.LEADER && user.role === Role.BASIC) {
      throw new ForbiddenException('Apenas administradores podem definir líderes.');
    }

    // LEADER não pode se auto-promover
    if (user.memberId === membroId && role === MinistryRole.LEADER) {
      throw new ForbiddenException('Você não pode se auto-promover a líder.');
    }

    const membership = await this.prisma.ministerioMembro.findUnique({
      where: { ministerioId_membroId: { ministerioId, membroId } },
    });
    if (!membership) throw new NotFoundException('Membro não participa deste ministério.');

    await this.prisma.ministerioMembro.update({
      where: { ministerioId_membroId: { ministerioId, membroId } },
      data: { role },
    });

    return { message: 'Função do membro atualizada com sucesso.' };
  }
}