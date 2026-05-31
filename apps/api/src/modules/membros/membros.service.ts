import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateMembroDto } from './dto/create-membro.dto';
import { UpdateMembroDto } from './dto/update-membro.dto';
import { FilterMembrosDto } from './dto/filter-membros.dto';
import { BulkTagMembrosDto } from './dto/bulk-tag-membros.dto';

@Injectable()
export class MembrosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateMembroDto) {
    // 1. Buscar o tenant para validar o limite de membros
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado.');
    }

    // 2. Contar membros ativos atuais (PrismaService estendido filtra deletedAt: null)
    const totalAtivos = await this.prisma.client.membro.count({
      where: { tenantId },
    });

    if (totalAtivos >= tenant.limiteMembros) {
      throw new ForbiddenException(
        `Limite de membros (${tenant.limiteMembros}) atingido para o plano ${tenant.plano}. Faça um upgrade.`,
      );
    }

    // 3. Criar membro
    return this.prisma.client.membro.create({
      data: {
        ...dto,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string, query: FilterMembrosDto) {
    const { nome, status, whatsapp, tags, operacao } = query;
    const where: any = { tenantId };

    // Filtros de busca textual
    if (nome) {
      where.nome = { contains: nome, mode: 'insensitive' };
    }
    if (status) {
      where.status = status;
    }
    if (whatsapp) {
      where.whatsapp = { contains: whatsapp };
    }

    // Filtro composto de tags (AND / OR)
    if (tags) {
      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (tagList.length > 0) {
        if (operacao === 'AND') {
          where.AND = tagList.map((tagNome) => ({
            tags: {
              some: {
                tag: {
                  nome: { equals: tagNome, mode: 'insensitive' },
                },
              },
            },
          }));
        } else {
          // OR por padrão
          where.tags = {
            some: {
              tag: {
                nome: { in: tagList, mode: 'insensitive' },
              },
            },
          };
        }
      }
    }

    return this.prisma.client.membro.findMany({
      where,
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        nome: 'asc',
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const membro = await this.prisma.client.membro.findFirst({
      where: { id, tenantId },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!membro) {
      throw new NotFoundException('Membro não encontrado.');
    }

    return membro;
  }

  async update(tenantId: string, id: string, dto: UpdateMembroDto) {
    // Garante existência e pertencimento ao tenant (não deletado)
    await this.findOne(tenantId, id);

    return this.prisma.client.membro.update({
      where: { id },
      data: dto,
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    // Soft delete
    await this.prisma.client.membro.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Membro removido com sucesso (soft delete).' };
  }

  async bulkTag(tenantId: string, dto: BulkTagMembrosDto) {
    const { membrosIds, tagsIds, acao } = dto;

    // 1. Validar membros no tenant
    const membros = await this.prisma.client.membro.findMany({
      where: {
        id: { in: membrosIds },
        tenantId,
      },
    });

    if (membros.length !== membrosIds.length) {
      throw new NotFoundException('Um ou mais membros não foram encontrados.');
    }

    // 2. Validar tags no tenant
    const tags = await this.prisma.client.tag.findMany({
      where: {
        id: { in: tagsIds },
        tenantId,
      },
    });

    if (tags.length !== tagsIds.length) {
      throw new NotFoundException('Uma ou mais tags não foram encontradas.');
    }

    // 3. Operação em lote
    const operations: any[] = [];
    for (const membroId of membrosIds) {
      for (const tagId of tagsIds) {
        if (acao === 'ADD') {
          operations.push(
            this.prisma.membroTag.upsert({
              where: {
                membroId_tagId: { membroId, tagId },
              },
              create: { membroId, tagId },
              update: {},
            }),
          );
        } else if (acao === 'REMOVE') {
          operations.push(
            this.prisma.membroTag.deleteMany({
              where: { membroId, tagId },
            }),
          );
        }
      }
    }

    await this.prisma.$transaction(operations);

    return { message: 'Ação em lote executada com sucesso.' };
  }
}
