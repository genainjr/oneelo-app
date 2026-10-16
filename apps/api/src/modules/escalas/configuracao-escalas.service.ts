import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateSegmentoDto } from './dto/create-segmento.dto';
import { UpdateSegmentoDto } from './dto/update-segmento.dto';
import { ReorderSegmentosDto } from './dto/reorder-segmentos.dto';
import { UpdateFuncaoConfiguracaoDto } from './dto/update-funcao-configuracao.dto';
import { UpsertCompatibilidadeDto } from './dto/upsert-compatibilidade.dto';
import { normalizarParFuncoes } from './conflitos/validador-conflitos';

@Injectable()
export class ConfiguracaoEscalasService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Segmentos do Culto ─────────────────────────────────────────

  async listSegmentos(tenantId: string) {
    return this.prisma.segmentoCulto.findMany({
      where: { tenantId },
      orderBy: { ordem: 'asc' },
    });
  }

  async createSegmento(tenantId: string, dto: CreateSegmentoDto) {
    const nomeTrimmed = dto.nome.trim();

    const existingNome = await this.prisma.segmentoCulto.findUnique({
      where: {
        tenantId_nome: {
          tenantId,
          nome: nomeTrimmed,
        },
      },
    });

    if (existingNome) {
      throw new ConflictException('Já existe um segmento com este nome.');
    }

    let ordem = dto.ordem;
    if (ordem !== undefined) {
      const existingOrdem = await this.prisma.segmentoCulto.findUnique({
        where: {
          tenantId_ordem: {
            tenantId,
            ordem,
          },
        },
      });
      if (existingOrdem) {
        throw new ConflictException('Já existe um segmento com esta ordem.');
      }
    } else {
      const last = await this.prisma.segmentoCulto.findFirst({
        where: { tenantId },
        orderBy: { ordem: 'desc' },
        select: { ordem: true },
      });
      ordem = (last?.ordem ?? 0) + 1;
    }

    return this.prisma.segmentoCulto.create({
      data: {
        tenantId,
        nome: nomeTrimmed,
        ordem,
      },
    });
  }

  async updateSegmento(tenantId: string, id: string, dto: UpdateSegmentoDto) {
    const segmento = await this.prisma.segmentoCulto.findFirst({
      where: { id, tenantId },
    });

    if (!segmento) {
      throw new NotFoundException('Segmento não encontrado.');
    }

    const data: { nome?: string; ordem?: number } = {};

    if (dto.nome !== undefined) {
      const nomeTrimmed = dto.nome.trim();
      if (nomeTrimmed !== segmento.nome) {
        const existingNome = await this.prisma.segmentoCulto.findUnique({
          where: {
            tenantId_nome: {
              tenantId,
              nome: nomeTrimmed,
            },
          },
        });
        if (existingNome) {
          throw new ConflictException('Já existe um segmento com este nome.');
        }
        data.nome = nomeTrimmed;
      }
    }

    if (dto.ordem !== undefined && dto.ordem !== segmento.ordem) {
      const existingOrdem = await this.prisma.segmentoCulto.findUnique({
        where: {
          tenantId_ordem: {
            tenantId,
            ordem: dto.ordem,
          },
        },
      });
      if (existingOrdem) {
        throw new ConflictException('Já existe um segmento com esta ordem.');
      }
      data.ordem = dto.ordem;
    }

    return this.prisma.segmentoCulto.update({
      where: { id },
      data,
    });
  }

  async reorderSegmentos(tenantId: string, dto: ReorderSegmentosDto) {
    const currentSegments = await this.prisma.segmentoCulto.findMany({
      where: { tenantId },
      select: { id: true },
    });

    const currentIds = new Set(currentSegments.map((s) => s.id));
    if (dto.segmentoIds.length !== currentIds.size || !dto.segmentoIds.every((id) => currentIds.has(id))) {
      throw new BadRequestException('A lista de segmentos para reordenação deve conter exatamente todos os segmentos cadastrados.');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Temporariamente atribui ordens negativas para evitar colisão do índice unique
      for (let i = 0; i < dto.segmentoIds.length; i++) {
        await tx.segmentoCulto.update({
          where: { id: dto.segmentoIds[i] },
          data: { ordem: -(i + 1) },
        });
      }

      // 2. Atribui ordem final sequencial 1..N
      for (let i = 0; i < dto.segmentoIds.length; i++) {
        await tx.segmentoCulto.update({
          where: { id: dto.segmentoIds[i] },
          data: { ordem: i + 1 },
        });
      }
    });

    const updated = await this.prisma.segmentoCulto.findMany({
      where: { tenantId },
      orderBy: { ordem: 'asc' },
    });

    return {
      message: 'Segmentos reordenados com sucesso.',
      segmentos: updated,
    };
  }

  async deleteSegmento(tenantId: string, id: string) {
    const segmento = await this.prisma.segmentoCulto.findFirst({
      where: { id, tenantId },
    });

    if (!segmento) {
      throw new NotFoundException('Segmento não encontrado.');
    }

    await this.prisma.segmentoCulto.delete({
      where: { id },
    });

    return { message: 'Segmento removido com sucesso.' };
  }

  async loadTemplatePadrao(tenantId: string) {
    const count = await this.prisma.segmentoCulto.count({
      where: { tenantId },
    });

    if (count > 0) {
      throw new BadRequestException('O template padrão só pode ser carregado quando não houver segmentos cadastrados.');
    }

    const template = [
      { nome: 'Abertura', ordem: 1 },
      { nome: 'Louvor', ordem: 2 },
      { nome: 'Pregação', ordem: 3 },
      { nome: 'Encerramento', ordem: 4 },
    ];

    await this.prisma.$transaction(
      template.map((item) =>
        this.prisma.segmentoCulto.create({
          data: {
            tenantId,
            nome: item.nome,
            ordem: item.ordem,
          },
        }),
      ),
    );

    return this.listSegmentos(tenantId);
  }

  // ─── Configuração de Funções (Segmentos e Locais) ───────────────

  async listFuncoes(tenantId: string, ministerioId?: string) {
    return this.prisma.ministerioFuncao.findMany({
      where: {
        ministerio: {
          tenantId,
          ...(ministerioId ? { id: ministerioId } : {}),
        },
      },
      include: {
        ministerio: {
          select: {
            id: true,
            nome: true,
          },
        },
        segmentos: {
          include: {
            segmento: {
              select: {
                id: true,
                nome: true,
                ordem: true,
              },
            },
          },
          orderBy: {
            segmento: {
              ordem: 'asc',
            },
          },
        },
      },
      orderBy: [
        { ministerio: { nome: 'asc' } },
        { ordem: 'asc' },
        { nome: 'asc' },
      ],
    });
  }

  async updateFuncaoConfiguracao(
    tenantId: string,
    funcaoId: string,
    dto: UpdateFuncaoConfiguracaoDto,
  ) {
    const funcao = await this.prisma.ministerioFuncao.findFirst({
      where: {
        id: funcaoId,
        ministerio: { tenantId },
      },
    });

    if (!funcao) {
      throw new NotFoundException('Função não encontrada.');
    }

    const nome = dto.nome !== undefined ? dto.nome.trim() : undefined;
    if (nome) {
      const existing = await this.prisma.ministerioFuncao.findFirst({
        where: {
          ministerioId: funcao.ministerioId,
          nome,
          id: { not: funcaoId },
        },
      });

      if (existing) {
        throw new BadRequestException('Já existe uma função com este nome neste ministério.');
      }
    }

    if (dto.segmentoIds && dto.segmentoIds.length > 0) {
      const segmentosValidos = await this.prisma.segmentoCulto.count({
        where: {
          id: { in: dto.segmentoIds },
          tenantId,
        },
      });

      if (segmentosValidos !== dto.segmentoIds.length) {
        throw new BadRequestException('Um ou mais segmentos informados não pertencem a esta organização.');
      }
    }

    const localAtuacao =
      dto.localAtuacao !== undefined
        ? dto.localAtuacao?.trim() || null
        : undefined;

    return this.prisma.$transaction(async (tx) => {
      await tx.ministerioFuncao.update({
        where: { id: funcaoId },
        data: {
          ...(nome ? { nome } : {}),
          ...(localAtuacao !== undefined ? { localAtuacao } : {}),
        },
      });

      await tx.ministerioFuncaoSegmento.deleteMany({
        where: { funcaoId },
      });

      if (dto.segmentoIds && dto.segmentoIds.length > 0) {
        await tx.ministerioFuncaoSegmento.createMany({
          data: dto.segmentoIds.map((segmentoId) => ({
            funcaoId,
            segmentoId,
          })),
        });
      }

      return tx.ministerioFuncao.findUnique({
        where: { id: funcaoId },
        include: {
          ministerio: {
            select: { id: true, nome: true },
          },
          segmentos: {
            include: {
              segmento: {
                select: { id: true, nome: true, ordem: true },
              },
            },
            orderBy: {
              segmento: { ordem: 'asc' },
            },
          },
        },
      });
    });
  }

  // ─── Matriz de Compatibilidade ──────────────────────────────────

  async listCompatibilidades(tenantId: string) {
    return this.prisma.compatibilidadeFuncao.findMany({
      where: { tenantId },
      include: {
        funcaoA: {
          select: {
            id: true,
            nome: true,
            localAtuacao: true,
            ministerio: { select: { id: true, nome: true } },
          },
        },
        funcaoB: {
          select: {
            id: true,
            nome: true,
            localAtuacao: true,
            ministerio: { select: { id: true, nome: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertCompatibilidade(tenantId: string, dto: UpsertCompatibilidadeDto) {
    if (dto.funcaoAId === dto.funcaoBId) {
      throw new BadRequestException('Não é permitido criar regra de compatibilidade de uma função com ela mesma.');
    }

    const funcoes = await this.prisma.ministerioFuncao.findMany({
      where: {
        id: { in: [dto.funcaoAId, dto.funcaoBId] },
        ministerio: { tenantId },
      },
      select: { id: true },
    });

    if (funcoes.length !== 2) {
      throw new BadRequestException('Uma ou ambas as funções não foram encontradas nesta organização.');
    }

    const [funcaoAId, funcaoBId] = normalizarParFuncoes(dto.funcaoAId, dto.funcaoBId);

    if (!dto.regra) {
      await this.prisma.compatibilidadeFuncao.deleteMany({
        where: {
          tenantId,
          funcaoAId,
          funcaoBId,
        },
      });
      return { message: 'Regra removida com sucesso. Aplica-se o bloqueio padrão.' };
    }

    const observacao =
      dto.observacao !== undefined ? dto.observacao?.trim() || null : undefined;

    return this.prisma.compatibilidadeFuncao.upsert({
      where: {
        tenantId_funcaoAId_funcaoBId: {
          tenantId,
          funcaoAId,
          funcaoBId,
        },
      },
      create: {
        tenantId,
        funcaoAId,
        funcaoBId,
        regra: dto.regra,
        observacao: observacao ?? null,
      },
      update: {
        regra: dto.regra,
        ...(observacao !== undefined ? { observacao } : {}),
      },
      include: {
        funcaoA: {
          select: {
            id: true,
            nome: true,
            localAtuacao: true,
            ministerio: { select: { id: true, nome: true } },
          },
        },
        funcaoB: {
          select: {
            id: true,
            nome: true,
            localAtuacao: true,
            ministerio: { select: { id: true, nome: true } },
          },
        },
      },
    });
  }

  async deleteCompatibilidade(tenantId: string, id: string) {
    const regra = await this.prisma.compatibilidadeFuncao.findFirst({
      where: { id, tenantId },
    });

    if (!regra) {
      throw new NotFoundException('Regra não encontrada.');
    }

    await this.prisma.compatibilidadeFuncao.delete({
      where: { id },
    });

    return { message: 'Regra removida com sucesso.' };
  }
}
