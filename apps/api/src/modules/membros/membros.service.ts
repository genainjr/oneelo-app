import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateMembroDto } from './dto/create-membro.dto';
import { UpdateMembroDto } from './dto/update-membro.dto';
import { FilterMembrosDto } from './dto/filter-membros.dto';
import { FilterMembrosVisualizacaoDto } from './dto/filter-membros-visualizacao.dto';
import { BulkTagMembrosDto } from './dto/bulk-tag-membros.dto';
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { MinistryRole, Role } from '@prisma/client';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import type { Multer } from 'multer';
import { getMemberPhotoPath, validateImageUpload } from '../../common/storage/image-upload';

const memberListInclude = {
  tags: {
    include: {
      tag: true,
    },
  },
  ministerios: {
    where: {
      ministerio: { ativo: true },
    },
    include: {
      ministerio: { select: { id: true, nome: true } },
    },
    orderBy: {
      ministerio: { nome: 'asc' },
    },
  },
};

@Injectable()
export class MembrosService {
  private readonly memberPhotoBucket = 'member-photos';

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  private sortByVisualizacao(
    membros: Array<{ nome: string; dataNascimento?: Date | null }>,
    ordenacao?: 'nome' | 'dataNascimento',
  ) {
    const arr = [...membros];

    if (ordenacao === 'dataNascimento') {
      arr.sort((a, b) => {
        const dateA = a.dataNascimento ? new Date(a.dataNascimento) : null;
        const dateB = b.dataNascimento ? new Date(b.dataNascimento) : null;

        if (!dateA && !dateB) return a.nome.localeCompare(b.nome, 'pt-BR');
        if (!dateA) return 1;
        if (!dateB) return -1;

        const monthDayA = (dateA.getUTCMonth() + 1) * 100 + dateA.getUTCDate();
        const monthDayB = (dateB.getUTCMonth() + 1) * 100 + dateB.getUTCDate();

        if (monthDayA !== monthDayB) return monthDayA - monthDayB;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      });
      return arr;
    }

    arr.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return arr;
  }

  private applyTagFilter(where: any, tags?: string, operacao?: 'AND' | 'OR') {
    if (!tags) return;

    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (tagList.length === 0) return;

    if (operacao === 'AND') {
      where.AND = [
        ...(where.AND ?? []),
        ...tagList.map((tagNome) => ({
          tags: {
            some: {
              tag: {
                nome: { equals: tagNome, mode: 'insensitive' },
              },
            },
          },
        })),
      ];
      return;
    }

    where.tags = {
      some: {
        tag: {
          nome: { in: tagList, mode: 'insensitive' },
        },
      },
    };
  }

  private async applyVisualizacaoScope(
    where: any,
    user: JwtPayload,
    query: FilterMembrosVisualizacaoDto,
  ): Promise<boolean> {
    const ministryFilter: any = {};

    if (query.ministerioId) {
      ministryFilter.ministerioId = query.ministerioId;
    }

    if (query.ministerioRole) {
      ministryFilter.role = query.ministerioRole;
    }

    if (user.role === Role.BASIC) {
      if (!user.memberId) return false;

      const liderancas = await this.prisma.ministerioMembro.findMany({
        where: {
          membroId: user.memberId,
          role: { in: [MinistryRole.LEADER, MinistryRole.ASSISTANT_LEADER] },
          ministerio: { ativo: true },
        },
        select: { ministerioId: true },
      });

      const ministerioIds = liderancas.map((lideranca) => lideranca.ministerioId);
      if (ministerioIds.length === 0) return false;

      if (query.ministerioId && !ministerioIds.includes(query.ministerioId)) {
        return false;
      }

      ministryFilter.ministerioId = query.ministerioId
        ? query.ministerioId
        : { in: ministerioIds };
    }

    if (Object.keys(ministryFilter).length > 0) {
      where.ministerios = { some: ministryFilter };
    }

    return true;
  }

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
      include: memberListInclude,
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
      include: memberListInclude,
      orderBy: {
        nome: 'asc',
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const membro = await this.prisma.client.membro.findFirst({
      where: { id, tenantId },
      include: memberListInclude,
    });

    if (!membro) {
      throw new NotFoundException('Membro não encontrado.');
    }

    return membro;
  }

  async findVisualizacao(
    tenantId: string,
    query: FilterMembrosVisualizacaoDto,
    user: JwtPayload,
  ) {
    const {
      nome,
      status,
      whatsapp,
      tags,
      operacao,
      aniversarioMes,
      semTelefone,
    } = query;
    const where: any = { tenantId };
    const ordenacao = query.ordenacao ?? 'nome';

    if (nome) {
      where.nome = { contains: nome, mode: 'insensitive' };
    }
    if (status) {
      where.status = status;
    }
    if (whatsapp) {
      where.whatsapp = { contains: whatsapp };
    }
    if (semTelefone === 'true') {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { whatsapp: null },
            { whatsapp: '' },
          ],
        },
      ];
    }

    this.applyTagFilter(where, tags, operacao);

    const hasAccess = await this.applyVisualizacaoScope(where, user, query);
    if (!hasAccess) return [];

    const membros = await this.prisma.client.membro.findMany({
      where,
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        ministerios: {
          where: {
            ministerio: { ativo: true },
          },
          include: {
            ministerio: { select: { id: true, nome: true } },
            funcoesDisponiveis: {
              include: { funcao: { select: { id: true, nome: true } } },
            },
          },
          orderBy: {
            ministerio: { nome: 'asc' },
          },
        },
        _count: {
          select: { escalas: true },
        },
      },
      orderBy: { nome: 'asc' },
    });

    const mes = Number.parseInt(aniversarioMes ?? '', 10);
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      return this.sortByVisualizacao(membros, ordenacao);
    }

    const filtrados = membros.filter((membro) => {
      if (!membro.dataNascimento) return false;
      return membro.dataNascimento.getUTCMonth() + 1 === mes;
    });

    return this.sortByVisualizacao(filtrados, ordenacao);
  }

  async findAniversariantes(
    tenantId: string,
    query: FilterMembrosVisualizacaoDto,
    user: JwtPayload,
  ) {
    const mesAtual = new Date().getMonth() + 1;
    const aniversarioMes = query.aniversarioMes ?? String(mesAtual);
    const membros = await this.findVisualizacao(
      tenantId,
      { ...query, aniversarioMes },
      user,
    );

    return this.sortByVisualizacao(
      membros.filter((membro) => membro.dataNascimento),
      'dataNascimento',
    );
  }

  async update(tenantId: string, id: string, dto: UpdateMembroDto) {
    // Garante existência e pertencimento ao tenant (não deletado)
    await this.findOne(tenantId, id);

    return this.prisma.client.membro.update({
      where: { id },
      data: dto,
      include: memberListInclude,
    });
  }

  async uploadMemberPhoto(tenantId: string, memberId: string, file: Multer.File) {
    validateImageUpload(file, 'foto');

    const member = await this.prisma.client.membro.findFirst({
      where: { id: memberId, tenantId },
      select: { id: true, fotoKey: true },
    });

    if (!member) {
      throw new NotFoundException('Membro nao encontrado.');
    }

    const path = getMemberPhotoPath(tenantId, memberId, file);
    const photoUrl = await this.storageService.uploadPublicObject(
      this.memberPhotoBucket,
      path,
      file.buffer,
      file.mimetype,
    );

    const updated = await this.prisma.client.membro.update({
      where: { id: memberId },
      data: {
        fotoUrl: photoUrl,
        fotoKey: path,
      },
      include: memberListInclude,
    });

    if (member.fotoKey && member.fotoKey !== path) {
      await this.storageService.deleteObject(this.memberPhotoBucket, member.fotoKey).catch(() => undefined);
    }

    return updated;
  }

  async removeMemberPhoto(tenantId: string, memberId: string) {
    const member = await this.prisma.client.membro.findFirst({
      where: { id: memberId, tenantId },
      select: { id: true, fotoKey: true },
    });

    if (!member) {
      throw new NotFoundException('Membro nao encontrado.');
    }

    const updated = await this.prisma.client.membro.update({
      where: { id: memberId },
      data: {
        fotoUrl: null,
        fotoKey: null,
      },
      include: memberListInclude,
    });

    await this.storageService.deleteObject(this.memberPhotoBucket, member.fotoKey);

    return updated;
  }

  async remove(tenantId: string, id: string) {
    const member = await this.prisma.client.membro.findFirst({
      where: { id, tenantId },
      select: { id: true, fotoKey: true },
    });

    if (!member) {
      throw new NotFoundException('Membro nao encontrado.');
    }

    await this.storageService.deleteObject(this.memberPhotoBucket, member.fotoKey);

    const deletedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.ministerioMembroFuncao.deleteMany({
        where: { membroId: id },
      }),
      this.prisma.ministerioMembro.deleteMany({
        where: { membroId: id },
      }),
      this.prisma.membro.update({
        where: { id },
        data: {
          deletedAt,
          fotoUrl: null,
          fotoKey: null,
        },
      }),
    ]);

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
