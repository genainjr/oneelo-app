import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
  ForbiddenException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateMembroDto } from './dto/create-membro.dto';
import { UpdateMembroDto } from './dto/update-membro.dto';
import { FilterMembrosDto } from './dto/filter-membros.dto';
import { FilterMembrosVisualizacaoDto } from './dto/filter-membros-visualizacao.dto';
import { BulkTagMembrosDto } from './dto/bulk-tag-membros.dto';
import { PromoteVisitanteDto } from './dto/promote-visitante.dto';
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { AcaoAuditoria, MinistryRole, Role, StatusMembro } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import type { Multer } from 'multer';
import {
  getMemberPhotoPath,
  validateImageUpload,
} from '../../common/storage/image-upload';
import { includesNormalizedText } from '../../common/utils/search-text';
import { canAddMember, getEffectiveMemberLimit } from '../../common/utils/tenant-plan';

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
      ministerio: { nome: 'asc' as const },
    },
  },
};

@Injectable()
export class MembrosService {
  private readonly memberPhotoBucket = 'member-photos';

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: SupabaseStorageService,
    @Optional()
    @Inject(forwardRef(() => AuthService))
    private readonly authService?: AuthService,
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

      const ministerioIds = liderancas.map(
        (lideranca) => lideranca.ministerioId,
      );
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

    if (!canAddMember(tenant, totalAtivos)) {
      const effectiveLimit = getEffectiveMemberLimit(tenant);
      throw new ForbiddenException(
        `Limite de membros (${effectiveLimit}) atingido para o plano ${tenant.plano}. Faça um upgrade.`,
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

    const membros = await this.prisma.client.membro.findMany({
      where,
      include: memberListInclude,
      orderBy: {
        nome: 'asc',
      },
    });

    return membros.filter((membro) =>
      includesNormalizedText(membro.nome, nome),
    );
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
          OR: [{ whatsapp: null }, { whatsapp: '' }],
        },
      ];
    }

    this.applyTagFilter(where, tags, operacao);

    const hasAccess = await this.applyVisualizacaoScope(where, user, query);
    if (!hasAccess) return [];

    const membros = (
      await this.prisma.client.membro.findMany({
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
              ministerio: { nome: 'asc' as const },
            },
          },
          _count: {
            select: { escalas: true },
          },
        },
        orderBy: { nome: 'asc' },
      })
    ).filter((membro) => includesNormalizedText(membro.nome, nome));

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

  /**
   * Promove um visitante cadastrado para Membro ATIVO, validando cota do plano
   * e criando opcionalmente o usuário PENDING com link de ativação.
   */
  async promoteVisitante(
    tenantId: string,
    id: string,
    dto: PromoteVisitanteDto,
    actorId?: string,
    ip?: string,
  ) {
    const criarAcesso = dto.criarAcesso !== false;

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        throw new NotFoundException('Tenant não encontrado.');
      }

      const membro = await tx.membro.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          user: {
            select: {
              id: true,
              nome: true,
              email: true,
              telefoneLogin: true,
              role: true,
              ativo: true,
              status: true,
              activationExpiresAt: true,
              memberId: true,
              createdAt: true,
            },
          },
        },
      });

      if (!membro) {
        throw new NotFoundException('Membro não encontrado.');
      }

      if (membro.status !== StatusMembro.VISITANTE) {
        throw new ConflictException(
          'Apenas cadastros com status Visitante podem ser promovidos a Membro.',
        );
      }

      const totalAtivos = await tx.membro.count({
        where: { tenantId, deletedAt: null, status: StatusMembro.ATIVO },
      });

      if (!canAddMember(tenant, totalAtivos)) {
        const effectiveLimit = getEffectiveMemberLimit(tenant);
        throw new ForbiddenException(
          `Limite de membros (${effectiveLimit}) atingido para o plano ${tenant.plano}. Faça um upgrade.`,
        );
      }

      const normalizedEmail =
        dto.email !== undefined
          ? dto.email.trim().toLowerCase() || null
          : membro.email?.trim().toLowerCase() || null;
      const finalWhatsapp =
        dto.whatsapp !== undefined
          ? dto.whatsapp.trim() || null
          : membro.whatsapp;

      if (criarAcesso && !membro.user && !normalizedEmail) {
        throw new BadRequestException(
          'Informe um e-mail válido para criar o acesso de usuário do membro.',
        );
      }

      if (criarAcesso && !membro.user && !this.authService) {
        throw new InternalServerErrorException(
          'Serviço de autenticação indisponível para criar acesso do membro.',
        );
      }

      const updatedMembro = await tx.membro.update({
        where: { id: membro.id },
        data: {
          status: StatusMembro.ATIVO,
          ...(dto.email !== undefined ? { email: normalizedEmail } : {}),
          ...(dto.whatsapp !== undefined ? { whatsapp: finalWhatsapp } : {}),
        },
        include: memberListInclude,
      });

      let userResult: { user: any; activationLink: string | null } = {
        user: membro.user ?? null,
        activationLink: null,
      };

      if (criarAcesso && !membro.user && this.authService) {
        userResult = await this.authService.createPendingBasicUserInTx(tx, {
          tenantId,
          nome: updatedMembro.nome,
          email: normalizedEmail!,
          telefoneLogin: updatedMembro.whatsapp,
          memberId: updatedMembro.id,
          actorId,
          ip,
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: actorId ?? null,
          entidade: 'membros',
          entidadeId: updatedMembro.id,
          acao: AcaoAuditoria.ATUALIZAR,
          payloadBefore: { status: membro.status },
          payloadAfter: {
            origem: 'promocao_visitante_para_membro',
            statusAnterior: membro.status,
            novoStatus: StatusMembro.ATIVO,
            criarAcesso,
            userCriadoId: userResult.user?.id ?? null,
          },
          ipAddress: ip ?? null,
        },
      });

      return {
        membro: updatedMembro,
        user: userResult.user,
        activationLink: userResult.activationLink,
      };
    });
  }

  async uploadMemberPhoto(
    tenantId: string,
    memberId: string,
    file: Multer.File,
  ) {
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
      await this.storageService
        .deleteObject(this.memberPhotoBucket, member.fotoKey)
        .catch(() => undefined);
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

    await this.storageService.deleteObject(
      this.memberPhotoBucket,
      member.fotoKey,
    );

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

    await this.storageService.deleteObject(
      this.memberPhotoBucket,
      member.fotoKey,
    );

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

  async bulkRemove(tenantId: string, ids: string[], actorUserId?: string) {
    if (!ids || ids.length === 0) {
      return { count: 0, message: 'Nenhum membro selecionado.' };
    }

    const uniqueIds = Array.from(new Set(ids));

    // 1. Buscar membros pertencentes ao tenant
    const members = await this.prisma.client.membro.findMany({
      where: {
        id: { in: uniqueIds },
        tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        nome: true,
        fotoKey: true,
      },
    });

    if (members.length === 0) {
      throw new NotFoundException('Nenhum membro válido encontrado para exclusão.');
    }

    const targetIds = members.map((m) => m.id);

    // 2. Remover fotos do storage se existirem
    for (const m of members) {
      if (m.fotoKey) {
        await this.storageService
          .deleteObject(this.memberPhotoBucket, m.fotoKey)
          .catch(() => undefined);
      }
    }

    const deletedAt = new Date();

    // 3. Transação atômica de desvinculação, soft delete e auditoria
    await this.prisma.$transaction(async (tx) => {
      // Remover vínculos com funções ministeriais
      await tx.ministerioMembroFuncao.deleteMany({
        where: { membroId: { in: targetIds } },
      });

      // Remover vínculos com ministérios
      await tx.ministerioMembro.deleteMany({
        where: { membroId: { in: targetIds } },
      });

      // Remover vínculos com tags
      await tx.membroTag.deleteMany({
        where: { membroId: { in: targetIds } },
      });

      // Soft delete dos membros
      await tx.membro.updateMany({
        where: { id: { in: targetIds } },
        data: {
          deletedAt,
          fotoUrl: null,
          fotoKey: null,
        },
      });

      // Auditoria consolidada
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: actorUserId,
          entidade: 'Membro',
          entidadeId: 'BULK_DELETE',
          acao: AcaoAuditoria.DELETAR,
          payloadBefore: {
            total: targetIds.length,
            ids: targetIds,
            nomes: members.map((m) => m.nome),
          },
          payloadAfter: {
            deletados: targetIds.length,
          },
        },
      });
    });

    return {
      count: targetIds.length,
      message: `${targetIds.length} membro(s) removido(s) com sucesso.`,
    };
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
