import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcryptjs';

function createService(
  prisma: Record<string, unknown>,
  options: { signAsync?: jest.Mock } = {},
) {
  return new AuthService(
    prisma as never,
    { signAsync: options.signAsync ?? jest.fn().mockResolvedValue('jwt') } as never,
    {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'JWT_EXPIRES_IN') return '1d';
        return undefined;
      }),
    } as never,
    {} as never,
    {} as never,
  );
}

describe('AuthService user access invariants', () => {
  it('atualiza o nome curto somente no tenant recebido da sessao', async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'tenant-a', pwaShortName: null }),
        update: jest.fn().mockResolvedValue({ pwaShortName: 'CCRV' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const service = createService(prisma);

    await service.updateTenantPwaSettings(
      'tenant-a',
      { shortName: '  CCRV  ' },
      'admin-a',
      '127.0.0.1',
    );

    expect(prisma.tenant.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'tenant-a' },
      data: { pwaShortName: 'CCRV', pwaUpdatedAt: expect.any(Date) },
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 'tenant-a', userId: 'admin-a' }),
    }));
  });

  it('nao gera link para usuario criado como desativado', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'user-1',
          ...data,
          onboardingCompletedAt: null,
          createdAt: new Date(),
        })),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };
    const service = createService(prisma);

    const result = await service.createUser(
      {
        nome: 'Usuario desativado',
        email: 'desativado@example.com',
        role: Role.BASIC,
        ativo: false,
      },
      'tenant-1',
      'admin-1',
    );

    expect(result.status).toBe(UserStatus.DISABLED);
    expect(result.activationLink).toBeNull();
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: UserStatus.DISABLED,
          activationTokenHash: null,
        }),
      }),
    );
  });

  it('bloqueia ativacao administrativa sem senha ou provedor social', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-1',
          tenantId: 'tenant-1',
          nome: 'Usuario pendente',
          email: 'pendente@example.com',
          role: Role.BASIC,
          status: UserStatus.PENDING,
          ativo: false,
          senhaHash: null,
          activatedAt: null,
          authProviders: [],
        }),
        update: jest.fn(),
      },
    };
    const service = createService(prisma);

    await expect(
      service.updateUser('user-1', { ativo: true }, 'tenant-1', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
describe('AuthService phone password login', () => {
  const activeUser = async () => ({
    id: 'user-1',
    tenantId: 'tenant-1',
    memberId: null,
    nome: 'Usuario ativo',
    email: 'usuario@example.com',
    telefoneLogin: '+5511999999999',
    senhaHash: await bcrypt.hash('123456', 4),
    role: Role.BASIC,
    status: UserStatus.ACTIVE,
    ativo: true,
    onboardingCompletedAt: null,
    tenant: { nome: 'Tenant', ativo: true },
  });

  it('normaliza o telefone e cria a mesma sessao do login por e-mail', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(await activeUser()) },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const signAsync = jest.fn().mockResolvedValue('jwt-phone');
    const service = createService(prisma, { signAsync });

    const result = await service.login({
      identificador: '+55 (11) 99999-9999',
      senha: '123456',
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { telefoneLogin: '+5511999999999' },
      include: { tenant: true },
    });
    expect(result.accessToken).toBe('jwt-phone');
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('preserva o payload legado de e-mail', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(await activeUser()) },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const service = createService(prisma);

    await service.login({ email: 'usuario@example.com', senha: '123456' });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'usuario@example.com' },
      include: { tenant: true },
    });
  });

  it('aceita e-mail pelo novo campo identificador', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(await activeUser()) },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const service = createService(prisma);

    await service.login({ identificador: 'usuario@example.com', senha: '123456' });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'usuario@example.com' },
      include: { tenant: true },
    });
  });

  it('rejeita telefone invalido sem consultar usuario', async () => {
    const prisma = {
      user: { findFirst: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const service = createService(prisma);

    await expect(
      service.login({ identificador: 'telefone-invalido', senha: '123456' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('exige exatamente um identificador', async () => {
    const service = createService({});

    await expect(
      service.login({
        identificador: 'usuario@example.com',
        email: 'usuario@example.com',
        senha: '123456',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('preserva o bloqueio de conta pendente no login por telefone', async () => {
    const user = await activeUser();
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          ...user,
          ativo: false,
          status: UserStatus.PENDING,
        }),
      },
      auditLog: { create: jest.fn() },
    };
    const service = createService(prisma);

    await expect(
      service.login({ identificador: '+5511999999999', senha: '123456' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite autogestao com senha atual e audita telefone mascarado', async () => {
    const senhaHash = await bcrypt.hash('123456', 4);
    const prisma = {
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'user-1',
            senhaHash,
            telefoneLogin: null,
          })
          .mockResolvedValueOnce(null),
        update: jest.fn().mockResolvedValue(undefined),
      },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const service = createService(prisma);

    const result = await service.updateMyLoginPhone(
      'user-1',
      'tenant-1',
      { senhaAtual: '123456', telefoneLogin: '+55 (11) 99999-9999' },
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { telefoneLogin: '+5511999999999' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payloadBefore: { telefoneLogin: null },
        payloadAfter: { telefoneLogin: '***9999' },
      }),
    });
    expect(result.telefoneLogin).toBe('+5511999999999');
  });

  it('bloqueia autogestao quando o telefone pertence a outro usuario', async () => {
    const senhaHash = await bcrypt.hash('123456', 4);
    const prisma = {
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'user-1',
            senhaHash,
            telefoneLogin: null,
          })
          .mockResolvedValueOnce({ id: 'user-2' }),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const service = createService(prisma);

    await expect(
      service.updateMyLoginPhone(
        'user-1',
        'tenant-1',
        { senhaAtual: '123456', telefoneLogin: '+5511999999999' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('AuthService available members', () => {
  it('inclui whatsapp para preencher a credencial telefonica no cadastro', async () => {
    const prisma = {
      membro: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = createService(prisma);

    await service.findAvailableMembers('tenant-1');

    expect(prisma.membro.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        deletedAt: null,
        user: null,
      },
      select: { id: true, nome: true, email: true, whatsapp: true },
      orderBy: { nome: 'asc' },
    });
  });
});
