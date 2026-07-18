import { Role } from '@prisma/client';
import type { Request } from 'express';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { AuthController } from './auth.controller';

describe('AuthController tenant PWA routes', () => {
  const authService = {
    updateTenantPwaSettings: jest.fn(),
    updateTenantPwaIcon: jest.fn(),
    removeTenantPwaIcon: jest.fn(),
  };
  const controller = new AuthController(authService as never, {} as never);
  const user: JwtPayload = {
    sub: 'admin-a',
    email: 'admin@example.com',
    role: Role.ADMIN,
    tenantId: 'tenant-a',
  };
  const request = { headers: {}, ip: '127.0.0.1' } as Request;

  beforeEach(() => jest.clearAllMocks());

  it.each([
    'updateTenantPwaSettings',
    'updateTenantPwaIcon',
    'removeTenantPwaIcon',
  ] as const)('exige role ADMIN em %s', (method) => {
    expect(Reflect.getMetadata(ROLES_KEY, controller[method])).toEqual([Role.ADMIN]);
  });

  it('usa o tenant da sessao ao salvar o nome curto', async () => {
    authService.updateTenantPwaSettings.mockResolvedValue({});

    await controller.updateTenantPwaSettings(user, { shortName: 'CCRV' }, request);

    expect(authService.updateTenantPwaSettings).toHaveBeenCalledWith(
      'tenant-a',
      { shortName: 'CCRV' },
      'admin-a',
      '127.0.0.1',
    );
  });

  it('usa o tenant da sessao no upload e na remocao', async () => {
    const file = { originalname: 'icon.png' } as Express.Multer.File;
    authService.updateTenantPwaIcon.mockResolvedValue({});
    authService.removeTenantPwaIcon.mockResolvedValue({});

    await controller.updateTenantPwaIcon(user, file, request);
    await controller.removeTenantPwaIcon(user, request);

    expect(authService.updateTenantPwaIcon).toHaveBeenCalledWith(
      'tenant-a',
      file,
      'admin-a',
      '127.0.0.1',
    );
    expect(authService.removeTenantPwaIcon).toHaveBeenCalledWith(
      'tenant-a',
      'admin-a',
      '127.0.0.1',
    );
  });
});
