import { BadRequestException } from '@nestjs/common';
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
      evento: {
        create: createEvento,
        findFirst: jest.fn().mockResolvedValue(null),
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
