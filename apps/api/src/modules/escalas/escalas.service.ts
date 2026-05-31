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
    // 1. Validar se o ministério existe e pertence ao tenant
    const ministerio = await this.prisma.ministerio.findFirst({
      where: { id: dto.ministerioId, tenantId },
    });

    if (!ministerio) {
      throw new NotFoundException('Ministério não encontrado.');
    }

    // 2. Se for Líder de Ministério, validar liderança
    if (user.role === Role.LIDER_MINISTERIO) {
      await this.checkMinistryLeadership(dto.ministerioId, user.sub);
    }

    // 3. Criar escala
    return this.prisma.escala.create({
      data: {
        titulo: dto.titulo,
        data: new Date(dto.data),
        observacoes: dto.observacoes,
        ministerioId: dto.ministerioId,
        tenantId,
        status: StatusEscala.RASCUNHO,
      },
    });
  }

  async findAll(tenantId: string, query: FilterEscalaDto, user: JwtPayload) {
    const where: any = { tenantId };

    // Filtro por Ministério
    if (query.ministerioId) {
      where.ministerioId = query.ministerioId;
    }

    // Filtro por Status da Escala
    if (query.status) {
      where.status = query.status;
    }

    // Filtros de Período
    if (query.dataInicio || query.dataFim) {
      where.data = {};
      if (query.dataInicio) {
        where.data.gte = new Date(query.dataInicio);
      }
      if (query.dataFim) {
        where.data.lte = new Date(query.dataFim);
      }
    }

    // Restrições de RBAC na listagem
    if (user.role === Role.LIDER_MINISTERIO) {
      // Líder vê apenas as do ministério que lidera
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
      // Membro vê apenas escalas nas quais está escalado
      const membro = await this.prisma.client.membro.findFirst({
        where: { email: user.email, tenantId },
      });

      if (!membro) {
        return [];
      }

      where.itens = {
        some: { membroId: membro.id },
      };
    }

    // Filtrar por histórico de escala de um membro específico
    if (query.membroId) {
      where.itens = {
        ...where.itens,
        some: { membroId: query.membroId },
      };
    }

    // Filtrar apenas escalas com pendências futuras
    if (query.pendentesApenas === 'true') {
      where.data = {
        ...where.data,
        gte: new Date(),
      };
      where.itens = {
        ...where.itens,
        some: { statusConfirmacao: StatusConfirmacao.PENDENTE },
      };
    }

    return this.prisma.escala.findMany({
      where,
      include: {
        ministerio: {
          select: { id: true, nome: true },
        },
        itens: {
          include: {
            membro: {
              select: { id: true, nome: true, email: true, whatsapp: true },
            },
          },
        },
      },
      orderBy: { data: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string, user: JwtPayload) {
    const escala = await this.prisma.escala.findFirst({
      where: { id, tenantId },
      include: {
        ministerio: {
          select: { id: true, nome: true },
        },
        itens: {
          include: {
            membro: {
              select: { id: true, nome: true, email: true, whatsapp: true },
            },
            user: {
              select: { id: true, nome: true },
            },
          },
        },
      },
    });

    if (!escala) {
      throw new NotFoundException('Escala não encontrada.');
    }

    // Restrições de RBAC nos detalhes
    if (user.role === Role.LIDER_MINISTERIO) {
      await this.checkMinistryLeadership(escala.ministerioId, user.sub);
    } else if (user.role === Role.MEMBRO) {
      const membro = await this.prisma.client.membro.findFirst({
        where: { email: user.email, tenantId },
      });

      if (!membro) {
        throw new ForbiddenException(
          'Acesso negado: você não possui um membro vinculado.',
        );
      }

      const isEscalado = escala.itens.some((item) => item.membroId === membro.id);
      if (!isEscalado) {
        throw new ForbiddenException(
          'Acesso negado: você não está associado a esta escala.',
        );
      }
    }

    return escala;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateEscalaDto,
    user: JwtPayload,
  ) {
    const escala = await this.findOne(tenantId, id, user);

    // Se for Líder de Ministério, validar liderança
    if (user.role === Role.LIDER_MINISTERIO) {
      await this.checkMinistryLeadership(escala.ministerioId, user.sub);
    }

    const data: any = {};
    if (dto.titulo) data.titulo = dto.titulo;
    if (dto.data) data.data = new Date(dto.data);
    if (dto.status) data.status = dto.status;
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    return this.prisma.escala.update({
      where: { id },
      data,
    });
  }

  async remove(tenantId: string, id: string, user: JwtPayload) {
    const escala = await this.findOne(tenantId, id, user);

    // Se for Líder de Ministério, validar liderança
    if (user.role === Role.LIDER_MINISTERIO) {
      await this.checkMinistryLeadership(escala.ministerioId, user.sub);
    }

    // Deletar itens primeiro por causa das restrições de FK
    await this.prisma.escalaItem.deleteMany({
      where: { escalaId: id },
    });

    await this.prisma.escala.delete({
      where: { id },
    });

    return { message: 'Escala removida com sucesso.' };
  }

  // ─── Gestão de Itens da Escala ─────────────────────────────

  async addMembro(
    tenantId: string,
    id: string,
    dto: ManageEscalaItemDto,
    user: JwtPayload,
  ) {
    const escala = await this.findOne(tenantId, id, user);

    // Se for Líder de Ministério, validar liderança
    if (user.role === Role.LIDER_MINISTERIO) {
      await this.checkMinistryLeadership(escala.ministerioId, user.sub);
    }

    // Validar membro no tenant
    const membro = await this.prisma.client.membro.findFirst({
      where: { id: dto.membroId, tenantId },
    });

    if (!membro) {
      throw new NotFoundException('Membro não encontrado neste tenant.');
    }

    // Adicionar/Atualizar item na escala
    return this.prisma.escalaItem.upsert({
      where: {
        escalaId_membroId: {
          escalaId: id,
          membroId: dto.membroId,
        },
      },
      create: {
        escalaId: id,
        membroId: dto.membroId,
        funcao: dto.funcao,
        observacoes: dto.observacoes,
        userId: user.sub,
        statusConfirmacao: StatusConfirmacao.PENDENTE,
      },
      update: {
        funcao: dto.funcao,
        observacoes: dto.observacoes,
        userId: user.sub,
      },
    });
  }

  async removeMembro(
    tenantId: string,
    id: string,
    membroId: string,
    user: JwtPayload,
  ) {
    const escala = await this.findOne(tenantId, id, user);

    // Se for Líder de Ministério, validar liderança
    if (user.role === Role.LIDER_MINISTERIO) {
      await this.checkMinistryLeadership(escala.ministerioId, user.sub);
    }

    const item = await this.prisma.escalaItem.findUnique({
      where: {
        escalaId_membroId: {
          escalaId: id,
          membroId,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Membro não está escalado nesta escala.');
    }

    await this.prisma.escalaItem.delete({
      where: {
        escalaId_membroId: {
          escalaId: id,
          membroId,
        },
      },
    });

    return { message: 'Membro removido da escala com sucesso.' };
  }

  // ─── Confirmação de Presença pelo Membro ─────────────────────

  async confirmar(
    tenantId: string,
    id: string,
    dto: ConfirmarEscalaItemDto,
    user: JwtPayload,
  ) {
    // 1. Localizar o Membro correspondente pelo e-mail do User autenticado
    const membro = await this.prisma.client.membro.findFirst({
      where: { email: user.email, tenantId },
    });

    if (!membro) {
      throw new NotFoundException(
        'Nenhum membro associado ao seu e-mail foi encontrado.',
      );
    }

    // 2. Verificar se está agendado nesta escala
    const item = await this.prisma.escalaItem.findUnique({
      where: {
        escalaId_membroId: {
          escalaId: id,
          membroId: membro.id,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Você não está escalado para esta escala.');
    }

    // 3. Atualizar status de confirmação
    return this.prisma.escalaItem.update({
      where: {
        escalaId_membroId: {
          escalaId: id,
          membroId: membro.id,
        },
      },
      data: {
        statusConfirmacao: dto.statusConfirmacao,
        observacoes: dto.observacoes,
      },
    });
  }

  // ─── Alteração Direta do Status pelo Administrador/Líder/Secretário ───

  async updateItemStatus(
    tenantId: string,
    id: string,
    membroId: string,
    dto: ConfirmarEscalaItemDto,
    user: JwtPayload,
  ) {
    const escala = await this.findOne(tenantId, id, user);

    // Se for Líder de Ministério, validar liderança
    if (user.role === Role.LIDER_MINISTERIO) {
      await this.checkMinistryLeadership(escala.ministerioId, user.sub);
    }

    const item = await this.prisma.escalaItem.findUnique({
      where: {
        escalaId_membroId: {
          escalaId: id,
          membroId,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Membro não está escalado nesta escala.');
    }

    return this.prisma.escalaItem.update({
      where: {
        escalaId_membroId: {
          escalaId: id,
          membroId,
        },
      },
      data: {
        statusConfirmacao: dto.statusConfirmacao,
        observacoes: dto.observacoes,
      },
    });
  }
}
