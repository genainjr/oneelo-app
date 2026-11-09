import { StatusMembro, StatusConfirmacao, StatusEscala } from '@prisma/client';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      client: {
        membro: {
          count: jest.fn().mockResolvedValue(42),
        },
      },
      ministerio: {
        count: jest.fn().mockResolvedValue(5),
      },
      escala: {
        count: jest.fn().mockResolvedValue(8),
      },
      evento: {
        count: jest.fn().mockResolvedValue(12),
      },
      escalaItem: {
        count: jest.fn().mockResolvedValue(3),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ count: BigInt(7) }]),
    };

    service = new DashboardService(prismaMock);
  });

  it('retorna os indicadores agregados do tenant corretamente', async () => {
    const result = await service.getIndicadores('tenant-1');

    expect(prismaMock.client.membro.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', status: StatusMembro.ATIVO },
    });
    expect(prismaMock.ministerio.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', ativo: true },
    });
    expect(prismaMock.escalaItem.count).toHaveBeenCalledWith({
      where: {
        statusConfirmacao: StatusConfirmacao.PENDENTE,
        escalaDia: {
          escala: {
            tenantId: 'tenant-1',
            status: StatusEscala.PUBLICADA,
          },
        },
      },
    });

    expect(result).toEqual({
      totalMembrosAtivos: 42,
      ministeriosAtivos: 5,
      eventosDoMes: 12,
      escalasDoMes: 8,
      escalasDaSemana: 8,
      escalasNaSemana: 8,
      pendenciasConfirmacao: 3,
      aniversariantesMes: 7,
      aniversariantesDoMes: 7,
    });
  });

  it('resolve mes e ano pelo fuso America/Sao_Paulo mesmo quando UTC ja virou o dia', async () => {
    // 30 de Novembro de 2026 às 22:30 BRT = 01 de Dezembro de 2026 às 01:30 UTC
    const endOfMonthBRT = new Date('2026-12-01T01:30:00.000Z');

    await service.getIndicadores('tenant-1', endOfMonthBRT);

    expect(prismaMock.escala.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        mes: 11,
        ano: 2026,
      },
    });

    expect(prismaMock.evento.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        dataInicio: {
          gte: new Date('2026-11-01T03:00:00.000Z'),
          lte: new Date('2026-12-01T02:59:59.999Z'),
        },
      },
    });
  });
});
