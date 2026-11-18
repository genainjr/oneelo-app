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
  it('retorna a identidade do tenant para a previa do link de ativacao', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-1',
          nome: 'Novo usuario',
          email: 'novo@example.com',
          activationExpiresAt: expiresAt,
          tenant: {
            nome: 'Igreja Exemplo',
            slug: 'igreja-exemplo',
            logoUrl: 'https://cdn.example.com/logo.png',
            pwaIconUrl: 'https://cdn.example.com/app-icon.png',
          },
        }),
      },
    };
    const service = createService(prisma);

    const result = await service.validateActivationToken('token-valido');

    expect(result.tenant).toEqual(expect.objectContaining({
      nome: 'Igreja Exemplo',
      logoUrl: 'https://cdn.example.com/logo.png',
      pwaIconUrl: 'https://cdn.example.com/app-icon.png',
    }));
    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        tenant: {
          select: {
            nome: true,
            slug: true,
            logoUrl: true,
            pwaIconUrl: true,
            themePalette: true,
            primaryColor: true,
          },
        },
      }),
    }));
  });

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

describe('AuthService regeneratePendingActivationInTx & regenerateActivationLink', () => {
  it('regenera link via regenerateActivationLink delegando para fluxo transacional', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-p1',
          nome: 'Maria Pendente',
          email: 'maria@example.com',
          telefoneLogin: '+5585999991111',
          role: Role.BASIC,
          status: UserStatus.PENDING,
          activationTokenHash: 'old-hash',
          activationExpiresAt: new Date('2026-11-10T00:00:00.000Z'),
        }),
        update: jest.fn().mockImplementation(({ data }) => ({
          id: 'user-p1',
          nome: 'Maria Pendente',
          email: 'maria@example.com',
          role: Role.BASIC,
          ativo: false,
          status: UserStatus.PENDING,
          activationExpiresAt: data.activationExpiresAt ?? null,
          activationCreatedAt: data.activationCreatedAt ?? null,
          activatedAt: null,
          onboardingCompletedAt: null,
          createdAt: new Date(),
        })),
      },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const service = createService(prisma);

    const res = await service.regenerateActivationLink(
      'user-p1',
      'tenant-1',
      'admin-1',
      '127.0.0.1',
    );

    expect(res.activationLink).toContain('/activate/');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-p1' },
        data: expect.objectContaining({
          activationTokenHash: expect.any(String),
          activationExpiresAt: expect.any(Date),
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('sincroniza contato de usuário PENDING em transação excluindo o próprio id da checagem de conflito', async () => {
    const prisma = {};
    const tx = {
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'user-p2',
            nome: 'Nome Antigo',
            email: 'antigo@example.com',
            telefoneLogin: '+5585991101771',
            role: Role.BASIC,
            status: UserStatus.PENDING,
            activationTokenHash: 'old-hash',
            activationExpiresAt: null,
          })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
        update: jest.fn().mockImplementation(({ data }) => ({
          id: 'user-p2',
          nome: data.nome ?? 'Nome Antigo',
          email: data.email ?? 'antigo@example.com',
          role: Role.BASIC,
          ativo: false,
          status: UserStatus.PENDING,
          activationExpiresAt: data.activationExpiresAt ?? null,
          activationCreatedAt: data.activationCreatedAt ?? null,
          activatedAt: null,
          onboardingCompletedAt: null,
          createdAt: new Date(),
        })),
      },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const service = createService(prisma);

    const res = await service.regeneratePendingActivationInTx(tx as never, {
      userId: 'user-p2',
      tenantId: 'tenant-1',
      actorId: 'staff-1',
      nome: 'Nome Novo',
      email: 'NOVO@EXAMPLE.COM',
      telefoneLogin: '+55 85 98888-7777',
      regenerarLink: true,
    });

    expect(tx.user.findFirst).toHaveBeenNthCalledWith(2, {
      where: { email: 'novo@example.com', NOT: { id: 'user-p2' } },
      select: { id: true },
    });
    expect(tx.user.findFirst).toHaveBeenNthCalledWith(3, {
      where: { telefoneLogin: '+5585988887777', NOT: { id: 'user-p2' } },
      select: { id: true },
    });
    expect(res.nome).toBe('Nome Novo');
    expect(res.email).toBe('novo@example.com');
    expect(res.activationLink).toContain('/activate/');
  });

  it('rejeita regeneração se usuário já estiver ACTIVE ou DISABLED', async () => {
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-active',
          status: UserStatus.ACTIVE,
        }),
        update: jest.fn(),
      },
    };
    const service = createService({});

    await expect(
      service.regeneratePendingActivationInTx(tx as never, {
        userId: 'user-active',
        tenantId: 'tenant-1',
        actorId: 'admin-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('omite telefoneLogin quando ignorarTelefoneSeEmUso for true e o número pertencer a outro usuário', async () => {
    const tx = {
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'user-pai' }),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'user-esposa',
          ...data,
          createdAt: new Date(),
        })),
      },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const service = createService({});

    const res = await service.createPendingBasicUserInTx(tx as never, {
      tenantId: 'tenant-1',
      nome: 'Esposa',
      email: 'esposa@example.com',
      telefoneLogin: '+5585991101771',
      memberId: 'm-esposa',
      actorId: 'admin-1',
      ignorarTelefoneSeEmUso: true,
    });

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'esposa@example.com',
          telefoneLogin: null,
          memberId: 'm-esposa',
        }),
      }),
    );
    expect(res.user.telefoneLogin).toBeNull();
    expect(res.activationLink).toContain('/activate/');
  });

  it('orienta sobre conta desativada sem vinculo quando createPendingBasicUserInTx colide no mesmo tenant', async () => {
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValueOnce({
          id: 'user-disabled-orphan',
          tenantId: 'tenant-1',
          status: UserStatus.DISABLED,
          memberId: null,
        }),
      },
    };
    const service = createService({});

    await expect(
      service.createPendingBasicUserInTx(tx as never, {
        tenantId: 'tenant-1',
        nome: 'Ex-Membro Teste',
        email: 'exmembro@example.com',
        actorId: 'admin-1',
      }),
    ).rejects.toThrow(
      'Já existe uma conta desativada com este e-mail sem membro vinculado. Você pode reativá-la ou ajustar seu vínculo em Configurações > Usuários.',
    );
  });
});

describe('AuthService reactivateDisabledUserInTx', () => {
  it('reativa usuário BASIC DISABLED para PENDING com novo link, limpa senhaHash e revoga OAuth antigo se e-mail mudar', async () => {
    const tx = {
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'user-dis-1',
            nome: 'João Ex-Membro',
            email: 'antigo@example.com',
            telefoneLogin: '+5585991101771',
            role: Role.BASIC,
            status: UserStatus.DISABLED,
            ativo: false,
            activationTokenHash: null,
            activationExpiresAt: null,
          })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
        update: jest.fn().mockImplementation(({ data }) => ({
          id: 'user-dis-1',
          nome: data.nome ?? 'João Ex-Membro',
          email: data.email ?? 'antigo@example.com',
          role: Role.BASIC,
          ativo: false,
          status: UserStatus.PENDING,
          activationExpiresAt: data.activationExpiresAt,
          activationCreatedAt: data.activationCreatedAt,
          activatedAt: null,
          onboardingCompletedAt: null,
          createdAt: new Date(),
        })),
      },
      userAuthProvider: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };
    const service = createService({});

    const res = await service.reactivateDisabledUserInTx(tx as never, {
      userId: 'user-dis-1',
      tenantId: 'tenant-1',
      actorId: 'admin-1',
      nome: 'João Retorno',
      email: 'novo@example.com',
      telefoneLogin: '+55 85 98888-0000',
      origemAuditoria: 'auto_cadastro_retorno',
    });

    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-dis-1' },
        data: expect.objectContaining({
          status: UserStatus.PENDING,
          ativo: false,
          senhaHash: null,
          nome: 'João Retorno',
          email: 'novo@example.com',
          telefoneLogin: '+5585988880000',
          activationTokenHash: expect.any(String),
        }),
      }),
    );
    expect(tx.userAuthProvider.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-dis-1', ativo: true },
      data: { ativo: false, revokedAt: expect.any(Date) },
    });
    expect(tx.auditLog.create).toHaveBeenCalled();
    expect(res.status).toBe(UserStatus.PENDING);
    expect(res.activationLink).toContain('/activate/');
  });

  it('bloqueia reativação de conta administrativa ADMIN/STAFF via reactivateDisabledUserInTx', async () => {
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-staff',
          role: Role.STAFF,
          status: UserStatus.DISABLED,
          ativo: false,
        }),
        update: jest.fn(),
      },
    };
    const service = createService({});

    await expect(
      service.reactivateDisabledUserInTx(tx as never, {
        userId: 'user-staff',
        tenantId: 'tenant-1',
        actorId: 'admin-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('propaga ConflictException quando novo e-mail da reativação pertence a outro usuário', async () => {
    const tx = {
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'user-dis-2',
            nome: 'Pedro',
            email: 'pedro@example.com',
            telefoneLogin: null,
            role: Role.BASIC,
            status: UserStatus.DISABLED,
            ativo: false,
          })
          .mockResolvedValueOnce({ id: 'outro-user' }),
        update: jest.fn(),
      },
    };
    const service = createService({});

    await expect(
      service.reactivateDisabledUserInTx(tx as never, {
        userId: 'user-dis-2',
        tenantId: 'tenant-1',
        actorId: 'admin-1',
        email: 'ocupado@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('salva paleta curada forcando a cor oficial e registrando AuditLog como Tenant', async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-a',
          themePalette: null,
          primaryColor: null,
        }),
        update: jest.fn().mockResolvedValue({
          nome: 'Igreja A',
          slug: 'igreja-a',
          themePalette: 'royal-blue',
          primaryColor: '#1d4ed8',
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const service = createService(prisma);

    const result = await service.updateTenantTheme(
      'tenant-a',
      { themePalette: 'royal-blue', primaryColor: '#ff00ff' },
      'admin-a',
      '10.0.0.1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        themePalette: 'royal-blue',
        primaryColor: '#1d4ed8',
      }),
    );
    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tenant-a' },
        data: { themePalette: 'royal-blue', primaryColor: '#1d4ed8' },
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-a',
          userId: 'admin-a',
          entidade: 'Tenant',
          entidadeId: 'tenant-a',
          payloadBefore: { themePalette: null, primaryColor: null },
          payloadAfter: { themePalette: 'royal-blue', primaryColor: '#1d4ed8' },
        }),
      }),
    );
  });

  it('normaliza HEX customizado para lowercase e restaura amber-gold para null no banco', async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-a',
          themePalette: 'royal-blue',
          primaryColor: '#1d4ed8',
        }),
        update: jest.fn().mockResolvedValue({
          nome: 'Igreja A',
          slug: 'igreja-a',
          themePalette: 'custom',
          primaryColor: '#0f766e',
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const service = createService(prisma);

    await service.updateTenantTheme(
      'tenant-a',
      { themePalette: 'custom', primaryColor: '#0F766E' },
      'admin-a',
    );
    expect(prisma.tenant.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { themePalette: 'custom', primaryColor: '#0f766e' },
      }),
    );

    await service.updateTenantTheme(
      'tenant-a',
      { themePalette: 'amber-gold', primaryColor: '#fbbf24' },
      'admin-a',
    );
    expect(prisma.tenant.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { themePalette: null, primaryColor: null },
      }),
    );
  });

  it('rejeita HEX invalido no modo custom', async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-a',
          themePalette: null,
          primaryColor: null,
        }),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const service = createService(prisma);

    await expect(
      service.updateTenantTheme(
        'tenant-a',
        { themePalette: 'custom', primaryColor: 'azul' },
        'admin-a',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });
});
