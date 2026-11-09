import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StatusMembro, StatusConfirmacao, StatusEscala } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private getOperationalMonthRange(date: Date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(date);

    const ano = Number(parts.find((part) => part.type === 'year')?.value);
    const mes = Number(parts.find((part) => part.type === 'month')?.value);

    const mesStr = String(mes).padStart(2, '0');
    const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const ultimoDiaStr = String(ultimoDia).padStart(2, '0');

    const inicioDoMes = new Date(`${ano}-${mesStr}-01T00:00:00.000-03:00`);
    const fimDoMes = new Date(`${ano}-${mesStr}-${ultimoDiaStr}T23:59:59.999-03:00`);

    return {
      anoAtual: ano,
      mesAtual: mes,
      inicioDoMes,
      fimDoMes,
    };
  }

  async getIndicadores(tenantId: string, referenceDate: Date = new Date()) {
    const { anoAtual, mesAtual, inicioDoMes, fimDoMes } =
      this.getOperationalMonthRange(referenceDate);

    const [
      totalMembrosAtivos,
      ministeriosAtivos,
      escalasDoMes,
      eventosDoMes,
      pendenciasConfirmacao,
      aniversariantesMes,
    ] = await Promise.all([
      // 1. Total membros ativos (client estendido aplica deletedAt: null automaticamente)
      this.prisma.client.membro.count({
        where: { tenantId, status: StatusMembro.ATIVO },
      }),

      // 2. Ministérios ativos
      this.prisma.ministerio.count({
        where: { tenantId, ativo: true },
      }),

      // 3. Escalas do mês operacional corrente
      this.prisma.escala.count({
        where: {
          tenantId,
          mes: mesAtual,
          ano: anoAtual,
        },
      }),

      // 4. Eventos do mês operacional corrente
      this.prisma.evento.count({
        where: {
          tenantId,
          dataInicio: {
            gte: inicioDoMes,
            lte: fimDoMes,
          },
        },
      }),

      // 5. Pendências de confirmação em escalas publicadas (paridade exata com EscalasService.countPendencias)
      this.prisma.escalaItem.count({
        where: {
          statusConfirmacao: StatusConfirmacao.PENDENTE,
          escalaDia: {
            escala: {
              tenantId,
              status: StatusEscala.PUBLICADA,
            },
          },
        },
      }),

      // 6. Aniversariantes do mês (PostgreSQL: extrai o mês da data de nascimento de membros ativos)
      this.prisma.$queryRaw<{ count: number | bigint }[]>`
        SELECT COUNT(*)::int as count
        FROM tb_member
        WHERE tenant_id = ${tenantId}
          AND deleted_at IS NULL
          AND member_status = 'ACTIVE'::member_status
          AND birth_date IS NOT NULL
          AND EXTRACT(MONTH FROM birth_date) = ${mesAtual}
      `,
    ]);

    const totalAniversariantesMes = Number(
      (aniversariantesMes[0] as any)?.count ?? 0,
    );

    return {
      totalMembrosAtivos,
      ministeriosAtivos,
      eventosDoMes,
      escalasDoMes,
      escalasDaSemana: escalasDoMes,
      escalasNaSemana: escalasDoMes,
      pendenciasConfirmacao,
      aniversariantesMes: totalAniversariantesMes,
      aniversariantesDoMes: totalAniversariantesMes,
    };
  }
}
