import { BadRequestException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';

function createService(prisma: Record<string, unknown>) {
  return new AuthService(
    prisma as never,
    {} as never,
    { get: jest.fn() } as never,
    {} as never,
    {} as never,
  );
}

describe('AuthService user access invariants', () => {
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
