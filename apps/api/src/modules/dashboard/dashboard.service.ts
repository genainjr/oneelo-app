import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StatusMembro, StatusConfirmacao, StatusEscala } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getIndicadores(tenantId: string) {
    const hoje = new Date();

    // Início e fim da semana corrente (domingo a sábado)
    const diaSemana = hoje.getDay(); // 0=Dom, 6=Sab
    const inicioDaSemana = new Date(hoje);
    inicioDaSemana.setDate(hoje.getDate() - diaSemana);
    inicioDaSemana.setHours(0, 0, 0, 0);
    const fimDaSemana = new Date(inicioDaSemana);
    fimDaSemana.setDate(inicioDaSemana.getDate() + 6);
    fimDaSemana.setHours(23, 59, 59, 999);

    // Mês corrente para aniversariantes
    const mesAtual = hoje.getMonth() + 1; // 1-12

    const [
      totalMembrosAtivos,
      escalasDaSemana,
      ministeriosAtivos,
      pendenciasConfirmacao,
      aniversariantesMes,
    ] = await Promise.all([
      // 1. Total membros ativos (client estendido aplica deletedAt: null automaticamente)
      this.prisma.client.membro.count({
        where: { tenantId, status: StatusMembro.ATIVO },
      }),

      // 2. Escalas da semana corrente
      this.prisma.escala.count({
        where: {
          tenantId,
          data: {
            gte: inicioDaSemana,
            lte: fimDaSemana,
          },
        },
      }),

      // 3. Ministérios ativos
      this.prisma.ministerio.count({
        where: { tenantId, ativo: true },
      }),

      // 4. Pendências de confirmação em escalas futuras
      this.prisma.escalaItem.count({
        where: {
          statusConfirmacao: StatusConfirmacao.PENDENTE,
          escala: {
            tenantId,
            status: StatusEscala.PUBLICADA,
            data: { gte: hoje },
          },
        },
      }),

      // 5. Aniversariantes do mês
      // PostgreSQL: extrai o mês da data de nascimento
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "Membro"
        WHERE "tenantId" = ${tenantId}
          AND "deletedAt" IS NULL
          AND "dataNascimento" IS NOT NULL
          AND EXTRACT(MONTH FROM "dataNascimento") = ${mesAtual}
      `,
    ]);

    const totalAniversariantesMes = Number(
      (aniversariantesMes[0] as any)?.count ?? 0,
    );

    return {
      totalMembrosAtivos,
      escalasDaSemana,
      ministeriosAtivos,
      pendenciasConfirmacao,
      aniversariantesMes: totalAniversariantesMes,
    };
  }
}
