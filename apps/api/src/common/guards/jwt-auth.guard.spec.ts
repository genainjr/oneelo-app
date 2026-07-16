import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { JwtAuthGuard } from './jwt-auth.guard';

function createContext(request: Record<string, unknown>) {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function createGuard(user: Record<string, unknown> | null) {
  return new JwtAuthGuard(
    { getAllAndOverride: jest.fn().mockReturnValue(false) } as never,
    {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'user-1',
        email: 'antigo@example.com',
        role: Role.BASIC,
        tenantId: 'tenant-1',
      }),
    } as never,
    { get: jest.fn().mockReturnValue('secret') } as never,
    {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
      },
    } as never,
  );
}

describe('JwtAuthGuard', () => {
  it('usa o estado atual do usuario em uma sessao valida', async () => {
    const request = { cookies: { access_token: 'token' } };
    const guard = createGuard({
      email: 'atual@example.com',
      role: Role.STAFF,
      memberId: 'member-1',
      tenantId: 'tenant-1',
      ativo: true,
      status: UserStatus.ACTIVE,
      tenant: { ativo: true },
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request).toEqual(expect.objectContaining({
      user: expect.objectContaining({
        email: 'atual@example.com',
        role: Role.STAFF,
        memberId: 'member-1',
      }),
      tenantId: 'tenant-1',
    }));
  });

  it('bloqueia imediatamente a sessao de usuario desativado', async () => {
    const guard = createGuard({
      email: 'usuario@example.com',
      role: Role.BASIC,
      memberId: null,
      tenantId: 'tenant-1',
      ativo: false,
      status: UserStatus.DISABLED,
      tenant: { ativo: true },
    });

    await expect(
      guard.canActivate(createContext({ cookies: { access_token: 'token' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('bloqueia a sessao quando o tenant esta desativado', async () => {
    const guard = createGuard({
      email: 'usuario@example.com',
      role: Role.BASIC,
      memberId: null,
      tenantId: 'tenant-1',
      ativo: true,
      status: UserStatus.ACTIVE,
      tenant: { ativo: false },
    });

    await expect(
      guard.canActivate(createContext({ cookies: { access_token: 'token' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
