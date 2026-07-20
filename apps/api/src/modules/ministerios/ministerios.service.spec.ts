import { ConflictException } from '@nestjs/common';
import { MinistryRole, Role } from '@prisma/client';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { MinisteriosService } from './ministerios.service';

describe('MinisteriosService - elegibilidade para escalas', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const ministerioId = '22222222-2222-4222-8222-222222222222';
  const membroId = '33333333-3333-4333-8333-333333333333';
  const admin: JwtPayload = { sub: '44444444-4444-4444-8444-444444444444', email: 'admin@igreja.com', role: Role.ADMIN, tenantId };

  const createContext = () => {
    const membro = { findFirst: jest.fn().mockResolvedValue({ id: membroId }) };
    const prisma = {
      ministerio: {
        findFirst: jest.fn().mockResolvedValue({
          id: ministerioId, tenantId, nome: 'Infantil', ativo: true, usaEscalas: true,
          membros: [], funcoes: [], _count: { escalas: 0 },
        }),
        update: jest.fn().mockResolvedValue({ id: ministerioId }),
      },
      evento: { count: jest.fn().mockResolvedValue(0) },
      client: { membro },
      ministerioMembro: {
        findUnique: jest.fn().mockResolvedValue({ ministerioId, membroId, role: MinistryRole.MEMBER }),
        upsert: jest.fn().mockResolvedValue({ ministerioId, membroId }),
        update: jest.fn().mockResolvedValue({ ministerioId, membroId }),
      },
    };
    const authorization = { assertCanManageMinistry: jest.fn().mockResolvedValue(undefined), canManageTenant: jest.fn().mockReturnValue(true) };
    const service = new MinisteriosService(prisma as unknown as PrismaService, authorization as unknown as AuthorizationService);
    return { service, prisma };
  };

  it('bloqueia desativacao quando existem eventos futuros que precisam de escala', async () => {
    const { service, prisma } = createContext();
    prisma.evento.count.mockResolvedValue(2);
    await expect(service.update(tenantId, ministerioId, { usaEscalas: false }, admin)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.evento.count).toHaveBeenCalledWith({ where: expect.objectContaining({ tenantId, status: 'AGENDADO', ministerios: { some: { ministerioId, requerEscala: true } } }) });
    const conflictWhere = prisma.evento.count.mock.calls[0][0].where;
    expect(conflictWhere.dataInicio.gte).toBeInstanceOf(Date);
    expect(conflictWhere.dataInicio.gte.getTime()).toBeLessThanOrEqual(Date.now());
    expect(prisma.ministerio.update).not.toHaveBeenCalled();
  });

  it('mantem novos vinculos elegiveis por padrao', async () => {
    const { service, prisma } = createContext();
    await service.addMembro(tenantId, ministerioId, membroId, MinistryRole.MEMBER, undefined, undefined, admin);
    expect(prisma.ministerioMembro.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ podeSerEscalado: true }) }));
  });

  it('permite retirar a elegibilidade sem remover o membro do ministerio', async () => {
    const { service, prisma } = createContext();
    await service.updateMembroRole(tenantId, ministerioId, membroId, undefined, undefined, false, admin);
    expect(prisma.ministerioMembro.update).toHaveBeenCalledWith({
      where: { ministerioId_membroId: { ministerioId, membroId } }, data: { podeSerEscalado: false },
    });
  });
});
