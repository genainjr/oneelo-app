import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventoTipo, Prisma, Role } from '@prisma/client';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { EventosService } from './eventos.service';

describe('EventosService', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const ministerioId = '22222222-2222-4222-8222-222222222222';
  const user: JwtPayload = {
    sub: '33333333-3333-4333-8333-333333333333',
    email: 'admin@igreja.com',
    role: Role.ADMIN,
    tenantId,
  };

  const createService = () => {
    let createArgs: Prisma.EventoCreateArgs | undefined;
    let createManyArgs: Prisma.EventoMinisterioCreateManyArgs | undefined;
    const createEvento = jest.fn((args: Prisma.EventoCreateArgs) => {
      createArgs = args;
      return Promise.resolve({ id: 'evento-1' });
    });
    const transactionClient = {
      evento: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({
          id: `evento-lote-${String(data.dataInicio)}`,
          ...data,
        })),
        update: jest.fn().mockResolvedValue({ id: 'evento-1' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'evento-1' }),
      },
      eventoMinisterio: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn((args: Prisma.EventoMinisterioCreateManyArgs) => {
          createManyArgs = args;
          return Promise.resolve({
            count: Array.isArray(args.data) ? args.data.length : 1,
          });
        }),
      },
      escalaDia: {
        findMany: jest.fn().mockResolvedValue([] as any[]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      ministerio: {
        findMany: jest.fn().mockResolvedValue([{ id: ministerioId, usaEscalas: true }]),
      },
      ministerioMembro: {
        findMany: jest.fn().mockResolvedValue([{ ministerioId }]),
      },
      evento: {
        create: createEvento,
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(
        (operation: (tx: typeof transactionClient) => Promise<unknown>) =>
          operation(transactionClient),
      ),
    };
    const authorization = {
      canManageTenant: jest
        .fn()
        .mockImplementation(
          (candidate: JwtPayload) =>
            candidate.role === Role.ADMIN || candidate.role === Role.STAFF,
        ),
    };

    return {
      service: new EventosService(
        prisma as unknown as PrismaService,
        authorization as unknown as AuthorizationService,
      ),
      prisma,
      transactionClient,
      getCreateArgs: () => createArgs,
      getCreateManyArgs: () => createManyArgs,
    };
  };

  it('normaliza o contrato legado com requerEscala false', async () => {
    const { service, getCreateArgs } = createService();

    await service.create(
      tenantId,
      {
        titulo: 'Culto de domingo',
        dataInicio: '2026-07-26T12:00:00.000Z',
        tipo: EventoTipo.MINISTERIO,
        ministerioIds: [ministerioId],
      },
      user,
    );

    expect(getCreateArgs()?.data).toMatchObject({
      ministerios: {
        create: [{ ministerioId, requerEscala: false }],
      },
    });
  });

  it('cria lote atomico em ordem cronologica e copia ministerios', async () => {
    const { service, prisma, transactionClient } = createService();

    const result = await service.createBatch(tenantId, {
      titulo: 'Culto semanal',
      tipo: EventoTipo.MINISTERIO,
      ministerios: [{ ministerioId, requerEscala: true }],
      ocorrencias: [
        { dataInicio: '2026-08-09T22:00:00.000Z', dataFim: '2026-08-10T00:00:00.000Z' },
        { dataInicio: '2026-08-02T22:00:00.000Z', dataFim: '2026-08-03T00:00:00.000Z' },
      ],
    }, user);

    expect(result.total).toBe(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionClient.evento.create).toHaveBeenCalledTimes(2);
    expect(transactionClient.evento.create.mock.calls[0][0].data).toMatchObject({
      titulo: 'Culto semanal',
      dataInicio: new Date('2026-08-02T22:00:00.000Z'),
      ministerios: {
        create: [{ ministerio: { connect: { id: ministerioId } }, requerEscala: true }],
      },
    });
  });

  it('rejeita data inicial repetida dentro do lote', async () => {
    const { service } = createService();
    await expect(service.createBatch(tenantId, {
      titulo: 'Culto semanal',
      ocorrencias: [
        { dataInicio: '2026-08-02T22:00:00.000Z' },
        { dataInicio: '2026-08-02T22:00:00.000Z' },
      ],
    }, user)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lista conflito existente com titulo normalizado', async () => {
    const { service, prisma } = createService();
    prisma.evento.findMany.mockResolvedValue([{
      titulo: 'Culto Ágape',
      dataInicio: new Date('2026-08-02T22:00:00.000Z'),
    }]);

    await expect(service.createBatch(tenantId, {
      titulo: '  culto agape ',
      ocorrencias: [{ dataInicio: '2026-08-02T22:00:00.000Z' }],
    }, user)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'EVENT_BATCH_CONFLICT',
        conflictingDates: ['2026-08-02T22:00:00.000Z'],
      }),
    });
  });

  it('preserva bloqueio de evento geral para BASIC', async () => {
    const { service } = createService();
    await expect(service.createBatch(tenantId, {
      titulo: 'Evento geral',
      tipo: EventoTipo.GERAL,
      ocorrencias: [{ dataInicio: '2026-08-02T22:00:00.000Z' }],
    }, { ...user, role: Role.BASIC, memberId: '44444444-4444-4444-8444-444444444444' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite lote ministerial ao BASIC lider somente no proprio ministerio', async () => {
    const { service } = createService();
    const result = await service.createBatch(tenantId, {
      titulo: 'Encontro do ministerio',
      tipo: EventoTipo.MINISTERIO,
      ministerios: [{ ministerioId, requerEscala: false }],
      ocorrencias: [{ dataInicio: '2026-08-02T22:00:00.000Z' }],
    }, { ...user, role: Role.BASIC, memberId: '44444444-4444-4444-8444-444444444444' });
    expect(result.total).toBe(1);
  });

  it('rejeita ocorrencia que atravessa a meia-noite operacional', async () => {
    const { service } = createService();
    await expect(service.createBatch(tenantId, {
      titulo: 'Vigilia',
      ocorrencias: [{
        dataInicio: '2026-08-02T02:30:00.000Z',
        dataFim: '2026-08-02T04:00:00.000Z',
      }],
    }, user)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita lote com mais de 200 ocorrencias mesmo fora do ValidationPipe', async () => {
    const { service } = createService();
    const ocorrencias = Array.from({ length: 201 }, (_, index) => ({
      dataInicio: new Date(Date.UTC(2026, 0, 1, 12, index)).toISOString(),
    }));
    await expect(service.createBatch(tenantId, {
      titulo: 'Lote excessivo',
      ocorrencias,
    }, user)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita janela superior a 366 dias', async () => {
    const { service } = createService();
    await expect(service.createBatch(tenantId, {
      titulo: 'Lote longo',
      ocorrencias: [
        { dataInicio: '2026-01-01T12:00:00.000Z' },
        { dataInicio: '2027-01-03T12:00:00.000Z' },
      ],
    }, user)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('executa todas as escritas pelo cliente transacional e propaga falha', async () => {
    const { service, prisma, transactionClient } = createService();
    transactionClient.evento.create
      .mockResolvedValueOnce({ id: 'evento-1' })
      .mockRejectedValueOnce(new Error('falha simulada'));

    await expect(service.createBatch(tenantId, {
      titulo: 'Lote atomico',
      ocorrencias: [
        { dataInicio: '2026-08-02T22:00:00.000Z' },
        { dataInicio: '2026-08-09T22:00:00.000Z' },
      ],
    }, user)).rejects.toThrow('falha simulada');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionClient.evento.create).toHaveBeenCalledTimes(2);
  });

  it('permite evento geral em lote para STAFF', async () => {
    const { service } = createService();
    const result = await service.createBatch(tenantId, {
      titulo: 'Evento geral da equipe',
      tipo: EventoTipo.GERAL,
      ocorrencias: [{ dataInicio: '2026-08-02T22:00:00.000Z' }],
    }, { ...user, role: Role.STAFF });
    expect(result.total).toBe(1);
  });

  it('bloqueia BASIC comum sem membro vinculado', async () => {
    const { service } = createService();
    await expect(service.createBatch(tenantId, {
      titulo: 'Evento ministerial',
      tipo: EventoTipo.MINISTERIO,
      ministerios: [{ ministerioId, requerEscala: false }],
      ocorrencias: [{ dataInicio: '2026-08-02T22:00:00.000Z' }],
    }, { ...user, role: Role.BASIC, memberId: undefined }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('usa o contrato novo como fonte de verdade e persiste requerEscala', async () => {
    const { service, getCreateArgs } = createService();

    await service.create(
      tenantId,
      {
        titulo: 'Culto de domingo',
        dataInicio: '2026-07-26T12:00:00.000Z',
        tipo: EventoTipo.MINISTERIO,
        ministerioIds: [],
        ministerios: [{ ministerioId, requerEscala: true }],
      },
      user,
    );

    expect(getCreateArgs()?.data).toMatchObject({
      ministerios: {
        create: [{ ministerioId, requerEscala: true }],
      },
    });
  });

  it('rejeita ministério duplicado no contrato novo', async () => {
    const { service } = createService();

    await expect(
      service.create(
        tenantId,
        {
          titulo: 'Culto de domingo',
          dataInicio: '2026-07-26T12:00:00.000Z',
          tipo: EventoTipo.MINISTERIO,
          ministerios: [
            { ministerioId, requerEscala: true },
            { ministerioId, requerEscala: false },
          ],
        },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita pedido de escala para ministerio que nao utiliza escalas', async () => {
    const { service, prisma } = createService();
    prisma.ministerio.findMany.mockResolvedValue([{ id: ministerioId, usaEscalas: false }]);

    await expect(service.create(tenantId, {
      titulo: 'Encontro infantil', dataInicio: '2026-07-26T12:00:00.000Z', tipo: EventoTipo.MINISTERIO,
      ministerios: [{ ministerioId, requerEscala: true }],
    }, user)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('permite relacionar sem escala um ministerio que nao utiliza escalas', async () => {
    const { service, prisma, getCreateArgs } = createService();
    prisma.ministerio.findMany.mockResolvedValue([{ id: ministerioId, usaEscalas: false }]);

    await service.create(tenantId, {
      titulo: 'Encontro infantil', dataInicio: '2026-07-26T12:00:00.000Z', tipo: EventoTipo.MINISTERIO,
      ministerios: [{ ministerioId, requerEscala: false }],
    }, user);
    expect(getCreateArgs()?.data).toMatchObject({ ministerios: { create: [{ ministerioId, requerEscala: false }] } });
  });

  it('permite configurar ministérios em evento geral sem criar escala', async () => {
    const { service, getCreateArgs, prisma } = createService();

    await service.create(
      tenantId,
      {
        titulo: 'Conferência geral',
        dataInicio: '2026-07-26T12:00:00.000Z',
        tipo: EventoTipo.GERAL,
        ministerios: [{ ministerioId, requerEscala: true }],
      },
      user,
    );

    expect(getCreateArgs()?.data).toMatchObject({
      tipo: EventoTipo.GERAL,
      ministerios: {
        create: [{ ministerioId, requerEscala: true }],
      },
    });
    expect(prisma).not.toHaveProperty('escala');
  });

  it('mantém BASIC sem permissão para gerenciar evento geral', async () => {
    const { service } = createService();
    const basicUser: JwtPayload = {
      ...user,
      role: Role.BASIC,
      memberId: '44444444-4444-4444-8444-444444444444',
    };

    await expect(
      service.update(
        tenantId,
        '55555555-5555-4555-8555-555555555555',
        { ministerios: [{ ministerioId, requerEscala: true }] },
        basicUser,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('persiste a configuração ministerial ao atualizar evento geral', async () => {
    const { service, prisma, getCreateManyArgs } = createService();
    prisma.evento.findFirst.mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
      tenantId,
      tipo: EventoTipo.GERAL,
      ministerios: [],
    });

    await service.update(
      tenantId,
      '55555555-5555-4555-8555-555555555555',
      { ministerios: [{ ministerioId, requerEscala: true }] },
      user,
    );

    expect(getCreateManyArgs()?.data).toEqual([
      {
        eventoId: '55555555-5555-4555-8555-555555555555',
        ministerioId,
        requerEscala: true,
      },
    ]);
  });

  it('sincroniza titulo e data dos dias vinculados no mesmo mes', async () => {
    const { service, prisma, transactionClient } = createService();
    prisma.evento.findFirst.mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
      tenantId,
      tipo: EventoTipo.GERAL,
      titulo: 'Culto antigo',
      dataInicio: new Date('2026-07-12T12:00:00.000Z'),
      ministerios: [],
    });
    transactionClient.escalaDia.findMany.mockResolvedValue([
      { id: 'dia-1', escala: { mes: 7, ano: 2026 } },
    ]);

    await service.update(
      tenantId,
      '55555555-5555-4555-8555-555555555555',
      {
        titulo: 'Culto atualizado',
        dataInicio: '2026-07-19T15:00:00.000Z',
      },
      user,
    );

    expect(transactionClient.escalaDia.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['dia-1'] } },
      data: {
        titulo: 'Culto atualizado',
        data: new Date('2026-07-19T15:00:00.000Z'),
      },
    });
  });

  it('bloqueia mudanca de mes quando o evento esta vinculado', async () => {
    const { service, prisma, transactionClient } = createService();
    prisma.evento.findFirst.mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
      tenantId,
      tipo: EventoTipo.GERAL,
      titulo: 'Culto',
      dataInicio: new Date('2026-07-12T12:00:00.000Z'),
      ministerios: [],
    });
    transactionClient.escalaDia.findMany.mockResolvedValue([
      { id: 'dia-1', escala: { mes: 7, ano: 2026 } },
    ]);

    await expect(
      service.update(
        tenantId,
        '55555555-5555-4555-8555-555555555555',
        { dataInicio: '2026-08-02T12:00:00.000Z' },
        user,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(transactionClient.evento.update).not.toHaveBeenCalled();
  });
});
