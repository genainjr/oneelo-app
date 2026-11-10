import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  FormatoDocumento,
  StatusDocumentJob,
  TipoDocumento,
} from '@prisma/client';
import { CreateDocumentJobDto } from './dto/create-document-job.dto';
import { FilterDocumentJobsDto } from './dto/filter-document-jobs.dto';

@Injectable()
export class DocumentJobsService {
  constructor(private readonly prisma: PrismaService) {}

  async computeCarteirinhaVersionHash(
    tenantId: string,
    memberId: string,
    formato: FormatoDocumento,
  ): Promise<string | null> {
    const member = await this.prisma.client.membro?.findFirst?.({
      where: { id: memberId, tenantId, deletedAt: null },
      select: {
        id: true,
        nome: true,
        nomeExibicao: true,
        cargo: true,
        matricula: true,
        fotoUrl: true,
        cpf: true,
        rg: true,
        sexo: true,
        estadoCivil: true,
        dataNascimento: true,
        dataBatismo: true,
        updatedAt: true,
        tenant: {
          select: {
            nome: true,
            logoUrl: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!member) {
      return null;
    }

    const validadeAno = new Date().getFullYear() + 1;
    const payload = [
      member.id,
      member.nome,
      member.nomeExibicao ?? '',
      member.cargo ?? '',
      member.matricula ?? '',
      member.fotoUrl ?? '',
      member.cpf ?? '',
      member.rg ?? '',
      member.sexo ?? '',
      member.estadoCivil ?? '',
      member.dataNascimento?.toISOString() ?? '',
      member.dataBatismo?.toISOString() ?? '',
      member.updatedAt?.toISOString() ?? '',
      member.tenant?.nome ?? '',
      member.tenant?.logoUrl ?? '',
      validadeAno,
      formato,
    ].join('::');

    return createHash('sha256').update(payload).digest('hex');
  }

  async computeBatchCarteirinhasVersionHash(
    tenantId: string,
    memberIds?: string[],
  ): Promise<string | null> {
    const where: any = {
      tenantId,
      deletedAt: null,
      status: 'ATIVO',
    };

    if (memberIds && memberIds.length > 0) {
      where.id = { in: memberIds };
    }

    const [tenant, members] = await Promise.all([
      this.prisma.client.tenant?.findFirst?.({
        where: { id: tenantId },
        select: { nome: true, logoUrl: true, updatedAt: true },
      }),
      this.prisma.client.membro?.findMany?.({
        where,
        orderBy: { id: 'asc' },
        select: {
          id: true,
          nome: true,
          nomeExibicao: true,
          cargo: true,
          matricula: true,
          fotoUrl: true,
          cpf: true,
          rg: true,
          sexo: true,
          estadoCivil: true,
          dataNascimento: true,
          dataBatismo: true,
          updatedAt: true,
        },
      }),
    ]);

    if (!tenant || !members || members.length === 0) {
      return null;
    }

    const validadeAno = new Date().getFullYear() + 1;
    const membersPayload = members
      .map((m: any) =>
        [
          m.id,
          m.nome,
          m.nomeExibicao ?? '',
          m.cargo ?? '',
          m.matricula ?? '',
          m.fotoUrl ?? '',
          m.cpf ?? '',
          m.rg ?? '',
          m.sexo ?? '',
          m.estadoCivil ?? '',
          m.dataNascimento?.toISOString() ?? '',
          m.dataBatismo?.toISOString() ?? '',
          m.updatedAt?.toISOString() ?? '',
        ].join(';'),
      )
      .join('|');

    const fullPayload = [
      tenant.nome,
      tenant.logoUrl ?? '',
      tenant.updatedAt?.toISOString() ?? '',
      validadeAno,
      members.length,
      membersPayload,
    ].join('::');

    return createHash('sha256').update(fullPayload).digest('hex');
  }

  async createJob(
    tenantId: string,
    requestedByUserId: string | null,
    dto: CreateDocumentJobDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('tenantId é obrigatório para criar um job.');
    }

    let versionHash = dto.versionHash;

    if (!versionHash && dto.tipoDocumento === TipoDocumento.CARTEIRINHA_INDIVIDUAL) {
      const memberId = dto.parametros?.memberId;
      if (memberId) {
        versionHash = (await this.computeCarteirinhaVersionHash(tenantId, memberId, dto.formato)) ?? undefined;
      }
    } else if (!versionHash && dto.tipoDocumento === TipoDocumento.CARTEIRINHAS_LOTE) {
      const memberIds = dto.parametros?.memberIds;
      versionHash = (await this.computeBatchCarteirinhasVersionHash(tenantId, memberIds)) ?? undefined;
    }

    // Se houver versionHash e já existir um job CONCLUÍDO com esse hash, formato e tipo, reaproveita
    if (versionHash) {
      const existing = await this.findExistingCompletedJob(
        tenantId,
        dto.tipoDocumento,
        versionHash,
        dto.formato,
      );
      if (existing) {
        return existing;
      }
    }

    return this.prisma.client.documentJob.create({
      data: {
        tenantId,
        requestedByUserId,
        tipoDocumento: dto.tipoDocumento,
        formato: dto.formato,
        parametros: dto.parametros ?? {},
        versionHash: versionHash ?? dto.versionHash ?? null,
        status: StatusDocumentJob.PENDING,
      },
    });
  }

  async findExistingCompletedJob(
    tenantId: string,
    tipoDocumento: TipoDocumento,
    versionHash: string,
    formato?: FormatoDocumento,
  ) {
    const where: any = {
      tenantId,
      tipoDocumento,
      versionHash,
      status: StatusDocumentJob.COMPLETED,
      storageKey: { not: null },
    };
    if (formato) {
      where.formato = formato;
    }

    return this.prisma.client.documentJob.findFirst({
      where,
      orderBy: { completedAt: 'desc' },
    });
  }

  async getJobById(tenantId: string, jobId: string) {
    const job = await this.prisma.client.documentJob.findFirst({
      where: { id: jobId, tenantId },
      include: {
        requestedByUser: {
          select: { id: true, nome: true, email: true },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Documento ou job não encontrado.');
    }

    return job;
  }

  getDocumentLogicalKey(job: any): string {
    const params = (job.parametros as Record<string, any>) || {};
    if (job.tipoDocumento === TipoDocumento.CARTEIRINHA_INDIVIDUAL && params.memberId) {
      return `carteirinha:${params.memberId}:${job.formato}`;
    }
    if (
      job.tipoDocumento === TipoDocumento.ESCALA_PDF ||
      job.tipoDocumento === TipoDocumento.ESCALA_PNG
    ) {
      const periodo =
        params.mes && params.ano
          ? `${params.ano}-${params.mes}`
          : params.mesAno || params.escalaId || 'geral';
      const min = params.ministerioId || 'geral';
      const pag = params.pagina ?? 1;
      return `escala:${min}:${periodo}:${pag}:${job.formato}`;
    }
    if (
      job.tipoDocumento === TipoDocumento.AGENDA_PDF ||
      job.tipoDocumento === TipoDocumento.AGENDA_PNG
    ) {
      const periodo =
        params.dataInicio && params.dataFim
          ? `${params.dataInicio}_${params.dataFim}`
          : params.mesAno || params.agendaId || 'geral';
      const min = params.ministerioId || 'geral';
      const pag = params.pagina ?? 1;
      return `agenda:${min}:${periodo}:${pag}:${job.formato}`;
    }
    if (job.tipoDocumento === TipoDocumento.CARTEIRINHAS_LOTE) {
      return `carteirinhas_lote:${job.tenantId}`;
    }
    return `job:${job.id}`;
  }

  async listJobs(tenantId: string, query: FilterDocumentJobsDto) {
    const limit = Math.min(Math.max(parseInt(query.limit ?? '20', 10), 1), 100);
    const offset = Math.max(parseInt(query.offset ?? '0', 10), 0);

    const where: any = { tenantId };
    if (query.status) {
      where.status = query.status;
    }
    if (query.categoria) {
      if (query.categoria === 'ESCALAS') {
        where.tipoDocumento = {
          in: [TipoDocumento.ESCALA_PDF, TipoDocumento.ESCALA_PNG],
        };
      } else if (query.categoria === 'AGENDA') {
        where.tipoDocumento = {
          in: [TipoDocumento.AGENDA_PDF, TipoDocumento.AGENDA_PNG],
        };
      } else if (query.categoria === 'CARTEIRINHAS') {
        where.tipoDocumento = TipoDocumento.CARTEIRINHA_INDIVIDUAL;
      } else if (query.categoria === 'CARTEIRINHAS_LOTE') {
        where.tipoDocumento = TipoDocumento.CARTEIRINHAS_LOTE;
      } else if (query.categoria === 'RELATORIOS') {
        where.tipoDocumento = TipoDocumento.RELATORIO;
      }
    } else if (query.tipoDocumento) {
      if ((query.tipoDocumento as any) === 'ESCALAS') {
        where.tipoDocumento = {
          in: [TipoDocumento.ESCALA_PDF, TipoDocumento.ESCALA_PNG],
        };
      } else if ((query.tipoDocumento as any) === 'AGENDA') {
        where.tipoDocumento = {
          in: [TipoDocumento.AGENDA_PDF, TipoDocumento.AGENDA_PNG],
        };
      } else {
        where.tipoDocumento = query.tipoDocumento;
      }
    }

    const allJobs = await this.prisma.client.documentJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        requestedByUser: {
          select: { id: true, nome: true, email: true },
        },
      },
    });

    // Mantém apenas o registro mais recente (último válido) por entidade de documento
    const seenKeys = new Set<string>();
    const deduplicated: typeof allJobs = [];

    for (const job of allJobs) {
      const key = this.getDocumentLogicalKey(job);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        deduplicated.push(job);
      }
    }

    const rawItems = deduplicated.slice(offset, offset + limit);
    const total = deduplicated.length;

    // Enriquece os itens com metadados detalhados de membro, ministério e período
    const memberIds = Array.from(
      new Set(
        rawItems
          .filter((j) => j.tipoDocumento === TipoDocumento.CARTEIRINHA_INDIVIDUAL)
          .map((j) => (j.parametros as any)?.memberId)
          .filter(Boolean),
      ),
    );

    const ministerioIds = Array.from(
      new Set(
        rawItems
          .map((j) => (j.parametros as any)?.ministerioId)
          .filter(Boolean),
      ),
    );

    const [membros, ministerios] = await Promise.all([
      memberIds.length > 0 && this.prisma.client.membro
        ? this.prisma.client.membro.findMany({
            where: { id: { in: memberIds }, tenantId },
            select: {
              id: true,
              nome: true,
              nomeExibicao: true,
              cargo: true,
              matricula: true,
              fotoUrl: true,
            },
          })
        : [],
      ministerioIds.length > 0 && this.prisma.client.ministerio
        ? this.prisma.client.ministerio.findMany({
            where: { id: { in: ministerioIds }, tenantId },
            select: { id: true, nome: true },
          })
        : [],
    ]);

    const memberMap = new Map(((membros as any[]) || []).map((m) => [m.id, m]));
    const ministerioMap = new Map(((ministerios as any[]) || []).map((m) => [m.id, m]));

    const MESES_PT = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const items = rawItems.map((job) => {
      const params = (job.parametros as Record<string, any>) || {};
      let detalhes: any = null;

      if (job.tipoDocumento === TipoDocumento.CARTEIRINHA_INDIVIDUAL) {
        const member = memberMap.get(params.memberId);
        const nomeMembro = member?.nomeExibicao || member?.nome || 'Membro';
        const role = member?.cargo || 'Membro';
        const mat = member?.matricula || (member?.id ? `ROL-${member.id.slice(0, 6).toUpperCase()}` : '');
        detalhes = {
          titulo: nomeMembro,
          subtitulo: mat ? `${role} • ${mat}` : role,
          fotoUrl: member?.fotoUrl || null,
          cargo: role,
          matricula: mat,
          membroId: member?.id || params.memberId,
        };
      } else if (job.tipoDocumento === TipoDocumento.ESCALA_PDF || job.tipoDocumento === TipoDocumento.ESCALA_PNG) {
        const ministerio = params.ministerioId ? ministerioMap.get(params.ministerioId) : null;
        const ministerioNome = ministerio?.nome || (params.ministerioId ? 'Ministério' : 'Todos os Ministérios');
        const m = Number(params.mes);
        const a = Number(params.ano);
        const periodo = m >= 1 && m <= 12 && a ? `${MESES_PT[m]} de ${a}` : 'Escala Mensal';
        detalhes = {
          titulo: `Escala de ${periodo}`,
          subtitulo: ministerioNome,
          ministerioNome,
          periodo,
          mes: params.mes,
          ano: params.ano,
        };
      } else if (job.tipoDocumento === TipoDocumento.AGENDA_PDF || job.tipoDocumento === TipoDocumento.AGENDA_PNG) {
        const ministerio = params.ministerioId ? ministerioMap.get(params.ministerioId) : null;
        const ministerioNome = ministerio?.nome || 'Agenda Geral';
        let periodo = 'Agenda de Eventos';
        if (params.dataInicio && params.dataFim) {
          const formatBr = (dStr: string) => {
            const parts = dStr.split('-');
            return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dStr;
          };
          periodo = `${formatBr(params.dataInicio)} a ${formatBr(params.dataFim)}`;
        }
        detalhes = {
          titulo: `Agenda: ${periodo}`,
          subtitulo: ministerioNome,
          ministerioNome,
          periodo,
          dataInicio: params.dataInicio,
          dataFim: params.dataFim,
        };
      } else if (job.tipoDocumento === TipoDocumento.CARTEIRINHAS_LOTE) {
        detalhes = {
          titulo: 'Carteirinhas em Lote (Folha A4)',
          subtitulo: 'Todos os membros ativos da igreja',
        };
      }

      return {
        ...job,
        detalhes,
      };
    });

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  async claimNextPendingJob() {
    // Busca o job pendente mais antigo com menos de 3 tentativas
    const candidate = await this.prisma.client.documentJob.findFirst({
      where: {
        status: StatusDocumentJob.PENDING,
        tentativas: { lt: 3 },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!candidate) {
      return null;
    }

    // Trava atômica atualizando para PROCESSING
    return this.prisma.client.documentJob.update({
      where: { id: candidate.id },
      data: {
        status: StatusDocumentJob.PROCESSING,
        tentativas: { increment: 1 },
      },
      include: {
        tenant: true,
      },
    });
  }

  async completeJob(
    jobId: string,
    data: {
      storageKey: string;
      fileName: string;
      fileSize?: number;
    },
  ) {
    return this.prisma.client.documentJob.update({
      where: { id: jobId },
      data: {
        status: StatusDocumentJob.COMPLETED,
        storageKey: data.storageKey,
        fileName: data.fileName,
        fileSize: data.fileSize ?? null,
        completedAt: new Date(),
        erroMensagem: null,
      },
    });
  }

  async failJob(jobId: string, errorMessage: string) {
    return this.prisma.client.documentJob.update({
      where: { id: jobId },
      data: {
        status: StatusDocumentJob.FAILED,
        erroMensagem: errorMessage.slice(0, 1000),
      },
    });
  }

  async retryJob(tenantId: string, jobId: string) {
    const job = await this.getJobById(tenantId, jobId);

    return this.prisma.client.documentJob.update({
      where: { id: job.id },
      data: {
        status: StatusDocumentJob.PENDING,
        tentativas: 0,
        erroMensagem: null,
      },
    });
  }
}
