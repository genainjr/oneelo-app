import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateTagDto) {
    // Verifica duplicidade de nome dentro do tenant
    const existing = await this.prisma.tag.findUnique({
      where: { tenantId_nome: { tenantId, nome: dto.nome } },
    });

    if (existing) {
      throw new ConflictException(
        `Tag com o nome "${dto.nome}" já existe neste tenant.`,
      );
    }

    return this.prisma.tag.create({
      data: {
        ...dto,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string) {
    const tags = await this.prisma.tag.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { membros: true },
        },
      },
      orderBy: { nome: 'asc' },
    });

    return tags.map((tag) => ({
      ...tag,
      totalMembros: tag._count.membros,
      _count: undefined,
    }));
  }

  async findOne(tenantId: string, id: string) {
    const tag = await this.prisma.tag.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { membros: true },
        },
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag não encontrada.');
    }

    return {
      ...tag,
      totalMembros: tag._count.membros,
      _count: undefined,
    };
  }

  async update(tenantId: string, id: string, dto: UpdateTagDto) {
    await this.findOne(tenantId, id);

    // Verificar conflito de nome caso esteja sendo alterado
    if (dto.nome) {
      const conflict = await this.prisma.tag.findFirst({
        where: {
          tenantId,
          nome: dto.nome,
          NOT: { id },
        },
      });

      if (conflict) {
        throw new ConflictException(
          `Já existe uma tag com o nome "${dto.nome}".`,
        );
      }
    }

    return this.prisma.tag.update({
      where: { id },
      data: dto,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    // Remove todas as associações de membros antes de deletar a tag
    await this.prisma.membroTag.deleteMany({ where: { tagId: id } });
    await this.prisma.tag.delete({ where: { id } });

    return { message: 'Tag removida com sucesso.' };
  }
}
