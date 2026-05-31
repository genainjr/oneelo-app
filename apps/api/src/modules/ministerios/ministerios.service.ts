import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateMinisterioDto } from './dto/create-ministerio.dto';
import { UpdateMinisterioDto } from './dto/update-ministerio.dto';
import { Role } from '@prisma/client';
import { JwtPayload } from '../../common/types/jwt-payload.interface';

@Injectable()
export class MinisteriosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateMinisterioDto) {
    return this.prisma.ministerio.create({
      data: {
        ...dto,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string, user: JwtPayload) {
    const where: any = { tenantId, ativo: true };

    // LIDER_MINISTERIO vê apenas os ministérios que lidera
    if (user.role === Role.LIDER_MINISTERIO) {
      where.lideres = {
        some: { userId: user.sub },
      };
    }

    return this.prisma.ministerio.findMany({
      where,
      include: {
        lideres: {
          include: {
            user: { select: { id: true, nome: true, email: true, role: true } },
          },
        },
        _count: {
          select: { membros: true, escalas: true },
        },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string, user: JwtPayload) {
    const ministerio = await this.prisma.ministerio.findFirst({
      where: { id, tenantId },
      include: {
        lideres: {
          include: {
            user: { select: { id: true, nome: true, email: true, role: true } },
          },
        },
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
      },
    });

    if (!ministerio) {
      throw new NotFoundException('Ministério não encontrado.');
    }

    // LIDER_MINISTERIO só pode ver o próprio ministério
    if (user.role === Role.LIDER_MINISTERIO) {
      const isLider = ministerio.lideres.some((l) => l.userId === user.sub);
      if (!isLider) {
        throw new ForbiddenException(
          'Acesso negado a este ministério.',
        );
      }
    }

    return ministerio;
  }

  async update(tenantId: string, id: string, dto: UpdateMinisterioDto, user: JwtPayload) {
    await this.findOne(tenantId, id, user);

    return this.prisma.ministerio.update({
      where: { id },
      data: dto,
      include: {
        lideres: {
          include: {
            user: { select: { id: true, nome: true, email: true, role: true } },
          },
        },
        _count: {
          select: { membros: true, escalas: true },
        },
      },
    });
  }

  async remove(tenantId: string, id: string, user: JwtPayload) {
    await this.findOne(tenantId, id, user);

    // Soft delete via campo ativo
    return this.prisma.ministerio.update({
      where: { id },
      data: { ativo: false },
    });
  }

  async addMembro(tenantId: string, ministerioId: string, membroId: string) {
    // Valida que o ministério pertence ao tenant
    const ministerio = await this.prisma.ministerio.findFirst({
      where: { id: ministerioId, tenantId },
    });
    if (!ministerio) throw new NotFoundException('Ministério não encontrado.');

    // Valida que o membro pertence ao tenant (sem soft-delete no client estendido, pois é verificação)
    const membro = await this.prisma.client.membro.findFirst({
      where: { id: membroId, tenantId },
    });
    if (!membro) throw new NotFoundException('Membro não encontrado.');

    await this.prisma.ministerioMembro.upsert({
      where: {
        ministerioId_membroId: { ministerioId, membroId },
      },
      create: { ministerioId, membroId },
      update: {},
    });

    return { message: 'Membro adicionado ao ministério com sucesso.' };
  }

  async removeMembro(tenantId: string, ministerioId: string, membroId: string) {
    const ministerio = await this.prisma.ministerio.findFirst({
      where: { id: ministerioId, tenantId },
    });
    if (!ministerio) throw new NotFoundException('Ministério não encontrado.');

    await this.prisma.ministerioMembro.deleteMany({
      where: { ministerioId, membroId },
    });

    return { message: 'Membro removido do ministério com sucesso.' };
  }

  async addLider(tenantId: string, ministerioId: string, userId: string) {
    const ministerio = await this.prisma.ministerio.findFirst({
      where: { id: ministerioId, tenantId },
    });
    if (!ministerio) throw new NotFoundException('Ministério não encontrado.');

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    await this.prisma.ministerioLider.upsert({
      where: {
        ministerioId_userId: { ministerioId, userId },
      },
      create: { ministerioId, userId },
      update: {},
    });

    return { message: 'Líder adicionado ao ministério com sucesso.' };
  }

  async removeLider(tenantId: string, ministerioId: string, userId: string) {
    const ministerio = await this.prisma.ministerio.findFirst({
      where: { id: ministerioId, tenantId },
    });
    if (!ministerio) throw new NotFoundException('Ministério não encontrado.');

    await this.prisma.ministerioLider.deleteMany({
      where: { ministerioId, userId },
    });

    return { message: 'Líder removido do ministério com sucesso.' };
  }
}
