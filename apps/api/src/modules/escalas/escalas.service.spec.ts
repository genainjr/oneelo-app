import { BadRequestException } from '@nestjs/common';
import {
  EventoTipo,
  Prisma,
  Role,
  StatusEscala,
  StatusEvento,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { ModoCriacaoEscala } from './dto/create-escala.dto';
import { EscalasService } from './escalas.service';

describe('EscalasService - criação baseada em eventos', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const ministerioId = '22222222-2222-4222-8222-222222222222';
  const eventIdA = '33333333-3333-4333-8333-333333333333';
  const eventIdB = '44444444-4444-4444-8444-444444444444';
  const admin: JwtPayload = {
    sub: '55555555-5555-4555-8555-555555555555',
    email: 'admin@igreja.com',
    role: Role.ADMIN,
    tenantId,
  };

  const createContext = () => {
    let rootEventFindManyArgs: Prisma.EventoFindManyArgs | undefined;
    let txEventFindManyArgs: Prisma.EventoFindManyArgs | undefined;
    let escalaCreateArgs: Prisma.EscalaCreateArgs | undefined;
    let existingSchedule: { id: string } | null = null;
    let eligibleEvents: Array<{
      id: string;
      titulo: string;
      tipo: EventoTipo;
      dataInicio: Date;
      dataFim: Date | null;
      local: string | null;
      status: StatusEvento;
    }> = [];

    const tx = {
      escala: {
        findUnique: jest.fn(() => Promise.resolve(existingSchedule)),
        create: jest.fn((args: Prisma.EscalaCreateArgs) => {
          escalaCreateArgs = args;
          return Promise.resolve({
            id: '66666666-6666-4666-8666-666666666666',
            tenantId,
            ministerioId,
            mes: 7,
            ano: 2026,
            status: StatusEscala.RASCUNHO,
            observacoes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }),
      },
      evento: {
        findMany: jest.fn((args: Prisma.EventoFindManyArgs) => {
          txEventFindManyArgs = args;
          return Promise.resolve(eligibleEvents);
        }),
      },
    };

    const prisma = {
      ministerio: {
        findFirst: jest.fn().mockResolvedValue({ id: ministerioId }),
      },
      ministerioMembro: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      evento: {
        findMany: jest.fn((args: Prisma.EventoFindManyArgs) => {
          rootEventFindManyArgs = args;
          return Promise.resolve(eligibleEvents);
        }),
      },
      $transaction: jest.fn(
        (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
      ),
    };
    const notifications = { sendToUsers: jest.fn() };
    const service = new EscalasService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );

    return {
      service,
      prisma,
      tx,
      setExistingSchedule: (value: { id: string } | null) => {
        existingSchedule = value;
      },
      setEligibleEvents: (value: typeof eligibleEvents) => {
        eligibleEvents = value;
      },
      getRootEventFindManyArgs: () => rootEventFindManyArgs,
      getTxEventFindManyArgs: () => txEventFindManyArgs,
      getEscalaCreateArgs: () => escalaCreateArgs,
    };
  };

  const eligibleEvent = (id: string, titulo: string, dataInicio: string) => ({
    id,
    titulo,
    tipo: EventoTipo.GERAL,
    dataInicio: new Date(dataInicio),
    dataFim: null,
    local: 'Templo',
    status: StatusEvento.AGENDADO,
  });

  const createMaintenanceContext = (status = StatusEscala.RASCUNHO) => {
    const escala = {
      id: '66666666-6666-4666-8666-666666666666',
      tenantId,
      ministerioId,
      mes: 7,
      ano: 2026,
      status,
      dias: [],
      ministerio: { id: ministerioId, nome: 'Louvor', funcoes: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prisma = {
      escala: { findFirst: jest.fn().mockResolvedValue(escala) },
      escalaDia: {
        findFirst: jest.fn().mockResolvedValue({ ordem: 2 } as any),
        create: jest.fn().mockResolvedValue({ id: 'dia-novo' }),
        update: jest.fn().mockResolvedValue({ id: 'dia-1' }),
      },
      evento: {
        findFirst: jest.fn().mockResolvedValue({
          id: eventIdA,
          titulo: 'Culto especial',
          dataInicio: new Date('2026-07-12T15:00:00.000Z'),
        }),
      },
      ministerioMembro: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new EscalasService(
      prisma as unknown as PrismaService,
      { sendToUsers: jest.fn() } as unknown as NotificationsService,
    );

    return { service, prisma, escala };
  };

  const createAssignmentContext = (podeSerEscalado: boolean, funcaoIds: string[] = []) => {
    const escalaDiaId = '99999999-9999-4999-8999-999999999999';
    const membroId = '77777777-7777-4777-8777-777777777777';
    const funcaoId = '88888888-8888-4888-8888-888888888888';
    const prisma = {
      escalaDia: { findUnique: jest.fn().mockResolvedValue({
        id: escalaDiaId, data: new Date('2026-07-12T12:00:00.000Z'),
        escala: { id: '66666666-6666-4666-8666-666666666666', tenantId, ministerioId, status: StatusEscala.RASCUNHO },
      }) },
      ministerioFuncao: { findFirst: jest.fn().mockResolvedValue({ id: funcaoId }) },
      ministerioMembro: { findUnique: jest.fn().mockResolvedValue({
        ministerioId, membroId, podeSerEscalado,
        membro: { tenantId, status: 'ATIVO', deletedAt: null },
        funcoesDisponiveis: funcaoIds.map((id) => ({ funcaoId: id })),
      }) },
      escalaItem: { findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({ id: 'item-1' }) },
    };
    const service = new EscalasService(prisma as unknown as PrismaService, { sendToUsers: jest.fn() } as unknown as NotificationsService);
    return { service, prisma, escalaDiaId, membroId, funcaoId };
  };

  it('lista somente candidatos com tenant, período, ministério e requerEscala', async () => {
    const { service, setEligibleEvents, getRootEventFindManyArgs } =
      createContext();
    setEligibleEvents([
      eligibleEvent(eventIdA, 'Culto', '2026-07-12T12:00:00.000Z'),
    ]);

    const result = await service.findEventosElegiveis(
      tenantId,
      { ministerioId, mes: 7, ano: 2026 },
      admin,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: eventIdA, ministerioId });
    expect(getRootEventFindManyArgs()?.where).toMatchObject({
      tenantId,
      status: StatusEvento.AGENDADO,
      ministerios: {
        some: { ministerioId, requerEscala: true },
      },
      escalasDias: {
        none: { escala: { ministerioId, mes: 7, ano: 2026 } },
      },
    });
  });

  it('impede BASIC sem liderança de consultar candidatos', async () => {
    const { service } = createContext();
    const basic: JwtPayload = {
      ...admin,
      role: Role.BASIC,
      memberId: '77777777-7777-4777-8777-777777777777',
    };

    await expect(
      service.findEventosElegiveis(
        tenantId,
        { ministerioId, mes: 7, ano: 2026 },
        basic,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('mantém compatibilidade da criação por dias da semana', async () => {
    const { service, getEscalaCreateArgs } = createContext();

    await service.create(
      tenantId,
      { ministerioId, mes: 7, ano: 2026, diasSemana: [0] },
      admin,
    );

    const data = getEscalaCreateArgs()?.data;
    expect(data).toMatchObject({
      tenantId,
      ministerioId,
      mes: 7,
      ano: 2026,
      status: StatusEscala.RASCUNHO,
    });
    const days = data?.dias && 'create' in data.dias ? data.dias.create : [];
    expect(days).toHaveLength(4);
  });

  it('cria escala vazia quando nenhum modo é informado', async () => {
    const { service, getEscalaCreateArgs } = createContext();

    await service.create(tenantId, { ministerioId, mes: 7, ano: 2026 }, admin);

    expect(getEscalaCreateArgs()?.data.dias).toBeUndefined();
  });

  it('nao cria escala para ministerio que nao utiliza escalas', async () => {
    const { service, prisma, tx } = createContext();
    prisma.ministerio.findFirst.mockResolvedValue(null);
    await expect(service.create(tenantId, { ministerioId, mes: 7, ano: 2026 }, admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.escala.create).not.toHaveBeenCalled();
  });

  it('cria dias vinculados com data, título e ordem dos eventos', async () => {
    const {
      service,
      setEligibleEvents,
      getTxEventFindManyArgs,
      getEscalaCreateArgs,
    } = createContext();
    setEligibleEvents([
      eligibleEvent(eventIdA, 'Culto da manhã', '2026-07-12T12:00:00.000Z'),
      eligibleEvent(eventIdB, 'Culto da noite', '2026-07-12T22:00:00.000Z'),
    ]);

    await service.create(
      tenantId,
      {
        ministerioId,
        mes: 7,
        ano: 2026,
        modoCriacao: ModoCriacaoEscala.EVENTOS,
        eventoIds: [eventIdA, eventIdB],
      },
      admin,
    );

    expect(getTxEventFindManyArgs()?.where).toMatchObject({
      tenantId,
      id: { in: [eventIdA, eventIdB] },
      status: StatusEvento.AGENDADO,
      ministerios: { some: { ministerioId, requerEscala: true } },
    });
    expect(getEscalaCreateArgs()?.data.dias).toMatchObject({
      create: [
        {
          evento: { connect: { id: eventIdA } },
          data: new Date('2026-07-12T12:00:00.000Z'),
          titulo: 'Culto da manhã',
          ordem: 0,
        },
        {
          evento: { connect: { id: eventIdB } },
          data: new Date('2026-07-12T22:00:00.000Z'),
          titulo: 'Culto da noite',
          ordem: 1,
        },
      ],
    });
  });

  it('não cria escala quando algum evento não é elegível', async () => {
    const { service, tx, setEligibleEvents } = createContext();
    setEligibleEvents([
      eligibleEvent(eventIdA, 'Culto', '2026-07-12T12:00:00.000Z'),
    ]);

    await expect(
      service.create(
        tenantId,
        {
          ministerioId,
          mes: 7,
          ano: 2026,
          modoCriacao: ModoCriacaoEscala.EVENTOS,
          eventoIds: [eventIdA, eventIdB],
        },
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.escala.create).not.toHaveBeenCalled();
  });

  it('não cria outra escala para o mesmo ministério, mês e ano', async () => {
    const { service, tx, setExistingSchedule } = createContext();
    setExistingSchedule({ id: '88888888-8888-4888-8888-888888888888' });

    await expect(
      service.create(tenantId, { ministerioId, mes: 7, ano: 2026 }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.escala.create).not.toHaveBeenCalled();
  });

  it('adiciona dia vinculado usando data e titulo do evento', async () => {
    const { service, prisma } = createMaintenanceContext();

    await service.addDia(
      tenantId,
      '66666666-6666-4666-8666-666666666666',
      { eventoId: eventIdA },
      admin,
    );

    expect(prisma.escalaDia.create).toHaveBeenCalledWith({
      data: {
        escalaId: '66666666-6666-4666-8666-666666666666',
        data: new Date('2026-07-12T15:00:00.000Z'),
        titulo: 'Culto especial',
        eventoId: eventIdA,
        ordem: 3,
      },
    });
  });

  it('retorna os dados operacionais do evento no detalhe da escala', async () => {
    const { service, prisma } = createMaintenanceContext();

    await service.findOne(
      tenantId,
      '66666666-6666-4666-8666-666666666666',
      admin,
    );

    expect(prisma.escala.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          dias: expect.objectContaining({
            include: expect.objectContaining({
              evento: {
                select: {
                  id: true,
                  titulo: true,
                  dataInicio: true,
                  dataFim: true,
                  local: true,
                  status: true,
                  tipo: true,
                },
              },
            }),
          }),
        }),
      }),
    );
  });

  it('remove somente o vinculo e preserva o snapshot do dia', async () => {
    const { service, prisma, escala } = createMaintenanceContext();
    prisma.escalaDia.findFirst.mockResolvedValue({
      id: 'dia-1',
      eventoId: eventIdA,
      titulo: 'Snapshot',
      data: new Date('2026-07-12T15:00:00.000Z'),
      escala,
    });

    await service.updateDiaEvento(tenantId, 'dia-1', { eventoId: null }, admin);

    expect(prisma.escalaDia.update).toHaveBeenCalledWith({
      where: { id: 'dia-1' },
      data: { eventoId: null },
    });
  });

  it('bloqueia vinculo com evento de outra data', async () => {
    const { service, prisma, escala } = createMaintenanceContext();
    prisma.escalaDia.findFirst.mockResolvedValue({
      id: 'dia-1',
      eventoId: null,
      titulo: 'Segunda-feira',
      data: new Date('2026-07-13T03:00:00.000Z'),
      escala,
    });

    await expect(
      service.updateDiaEvento(tenantId, 'dia-1', { eventoId: eventIdA }, admin),
    ).rejects.toThrow(
      'O evento selecionado deve ocorrer na mesma data do dia da escala.',
    );
    expect(prisma.escalaDia.update).not.toHaveBeenCalled();
  });

  it('permite vinculo com evento da mesma data operacional', async () => {
    const { service, prisma, escala } = createMaintenanceContext();
    prisma.escalaDia.findFirst.mockResolvedValue({
      id: 'dia-1',
      eventoId: null,
      titulo: 'Domingo',
      data: new Date('2026-07-12T03:00:00.000Z'),
      escala,
    });

    await service.updateDiaEvento(
      tenantId,
      'dia-1',
      { eventoId: eventIdA },
      admin,
    );

    expect(prisma.escalaDia.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dia-1' },
        data: expect.objectContaining({ eventoId: eventIdA }),
      }),
    );
  });

  it('bloqueia alteracao do vinculo em escala encerrada', async () => {
    const { service, prisma, escala } = createMaintenanceContext(
      StatusEscala.ENCERRADA,
    );
    prisma.escalaDia.findFirst.mockResolvedValue({
      id: 'dia-1',
      escala,
    });

    await expect(
      service.updateDiaEvento(tenantId, 'dia-1', { eventoId: null }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.escalaDia.update).not.toHaveBeenCalled();
  });

  it('bloqueia membro marcado como nao elegivel para escalas', async () => {
    const { service, prisma, escalaDiaId, membroId, funcaoId } = createAssignmentContext(false);
    await expect(service.addMembro(tenantId, escalaDiaId, { escalaDiaId, membroId, ministerioFuncaoId: funcaoId }, admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.escalaItem.upsert).not.toHaveBeenCalled();
  });

  it('nao aceita dia de escala pertencente a outro tenant', async () => {
    const { service, prisma, escalaDiaId, membroId, funcaoId } = createAssignmentContext(true);
    prisma.escalaDia.findUnique.mockResolvedValue({
      id: escalaDiaId, data: new Date('2026-07-12T12:00:00.000Z'),
      escala: { id: '66666666-6666-4666-8666-666666666666', tenantId: 'outro-tenant', ministerioId, status: StatusEscala.RASCUNHO },
    });
    await expect(service.addMembro(tenantId, escalaDiaId, { escalaDiaId, membroId, ministerioFuncaoId: funcaoId }, admin)).rejects.toMatchObject({ status: 404 });
    expect(prisma.escalaItem.upsert).not.toHaveBeenCalled();
  });

  it('mantem lista de funcoes vazia como permissao para todas as funcoes', async () => {
    const { service, prisma, escalaDiaId, membroId, funcaoId } = createAssignmentContext(true);
    await service.addMembro(tenantId, escalaDiaId, { escalaDiaId, membroId, ministerioFuncaoId: funcaoId }, admin);
    expect(prisma.escalaItem.upsert).toHaveBeenCalled();
  });

  it('bloqueia funcao fora da lista configurada para o membro', async () => {
    const { service, prisma, escalaDiaId, membroId, funcaoId } = createAssignmentContext(true, ['outra-funcao']);
    await expect(service.addMembro(tenantId, escalaDiaId, { escalaDiaId, membroId, ministerioFuncaoId: funcaoId }, admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.escalaItem.upsert).not.toHaveBeenCalled();
  });
});
