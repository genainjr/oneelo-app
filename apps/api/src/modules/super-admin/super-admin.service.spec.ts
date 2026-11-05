import { Test, TestingModule } from '@nestjs/testing';
import { SuperAdminService } from './super-admin.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TenantMediaService } from '../../common/storage/tenant-media.service';
import { Plano, Role } from '@prisma/client';
import { DEFAULT_UNLIMITED_STORED_LIMIT } from '../../common/utils/tenant-plan';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed_password'),
}));

describe('SuperAdminService', () => {
  let service: SuperAdminService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      tenant: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      financePermission: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuperAdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: TenantMediaService, useValue: { uploadTenantLogo: jest.fn(), removeTenantLogo: jest.fn() } },
      ],
    }).compile();

    service = module.get<SuperAdminService>(SuperAdminService);
  });

  describe('listTenants', () => {
    it('deve incluir limiteMembros na selecao de tenants', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);

      await service.listTenants();

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            limiteMembros: true,
            plano: true,
          }),
        }),
      );
    });
  });

  describe('createTenant', () => {
    const adminId = 'super-admin-id';

    it('deve criar tenant GRATUITO com limite de 50 membros por padrao', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.tenant.create.mockImplementation(({ data }: any) => ({ id: 'tenant-1', ...data }));
      prisma.user.create.mockResolvedValue({ id: 'user-1', nome: 'Admin', email: 'admin@igreja.com', role: Role.ADMIN });

      await service.createTenant(
        {
          nome: 'Igreja Gratuita',
          slug: 'igreja-gratuita',
          adminNome: 'Admin',
          adminEmail: 'admin@igreja.com',
          adminSenha: 'password123',
        },
        adminId,
      );

      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          plano: Plano.GRATUITO,
          limiteMembros: 50,
        }),
      });
    });

    it('deve criar tenant BASICO com limite de 200 membros', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.tenant.create.mockImplementation(({ data }: any) => ({ id: 'tenant-2', ...data }));
      prisma.user.create.mockResolvedValue({ id: 'user-2', nome: 'Admin', email: 'admin@igreja.com', role: Role.ADMIN });

      await service.createTenant(
        {
          nome: 'Igreja Basica',
          slug: 'igreja-basica',
          plano: Plano.BASICO,
          adminNome: 'Admin',
          adminEmail: 'admin@igreja.com',
          adminSenha: 'password123',
        },
        adminId,
      );

      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          plano: Plano.BASICO,
          limiteMembros: 200,
        }),
      });
    });

    it('deve criar tenant PROFISSIONAL com limite armazenado de 999999', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.tenant.create.mockImplementation(({ data }: any) => ({ id: 'tenant-3', ...data }));
      prisma.user.create.mockResolvedValue({ id: 'user-3', nome: 'Admin', email: 'admin@igreja.com', role: Role.ADMIN });

      await service.createTenant(
        {
          nome: 'Igreja Pro',
          slug: 'igreja-pro',
          plano: Plano.PROFISSIONAL,
          adminNome: 'Admin',
          adminEmail: 'admin@igreja.com',
          adminSenha: 'password123',
        },
        adminId,
      );

      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          plano: Plano.PROFISSIONAL,
          limiteMembros: DEFAULT_UNLIMITED_STORED_LIMIT,
        }),
      });
    });

    it('deve respeitar override de limiteMembros informado explicitamente no DTO', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.tenant.create.mockImplementation(({ data }: any) => ({ id: 'tenant-4', ...data }));
      prisma.user.create.mockResolvedValue({ id: 'user-4', nome: 'Admin', email: 'admin@igreja.com', role: Role.ADMIN });

      await service.createTenant(
        {
          nome: 'Igreja Custom',
          slug: 'igreja-custom',
          plano: Plano.GRATUITO,
          limiteMembros: 120,
          adminNome: 'Admin',
          adminEmail: 'admin@igreja.com',
          adminSenha: 'password123',
        },
        adminId,
      );

      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          plano: Plano.GRATUITO,
          limiteMembros: 120,
        }),
      });
    });
  });

  describe('updateTenant', () => {
    const adminId = 'super-admin-id';

    it('deve sincronizar limiteMembros para 200 ao alterar plano de GRATUITO para BASICO', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: 't-1',
        nome: 'Igreja',
        plano: Plano.GRATUITO,
        limiteMembros: 50,
        ativo: true,
      });
      prisma.tenant.update.mockResolvedValue({ id: 't-1' });

      await service.updateTenant('t-1', { plano: Plano.BASICO }, adminId);

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: expect.objectContaining({
          plano: Plano.BASICO,
          limiteMembros: 200,
        }),
        select: expect.any(Object),
      });
    });

    it('deve sincronizar limiteMembros para 50 ao alterar plano de PROFISSIONAL para GRATUITO', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: 't-pro',
        nome: 'Igreja',
        plano: Plano.PROFISSIONAL,
        limiteMembros: DEFAULT_UNLIMITED_STORED_LIMIT,
        ativo: true,
      });
      prisma.tenant.update.mockResolvedValue({ id: 't-pro' });

      await service.updateTenant('t-pro', { plano: Plano.GRATUITO }, adminId);

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't-pro' },
        data: expect.objectContaining({
          plano: Plano.GRATUITO,
          limiteMembros: 50,
        }),
        select: expect.any(Object),
      });
    });

    it('deve sincronizar limiteMembros para 999999 ao alterar plano para PROFISSIONAL', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: 't-2',
        nome: 'Igreja',
        plano: Plano.BASICO,
        limiteMembros: 200,
        ativo: true,
      });
      prisma.tenant.update.mockResolvedValue({ id: 't-2' });

      await service.updateTenant('t-2', { plano: Plano.PROFISSIONAL }, adminId);

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't-2' },
        data: expect.objectContaining({
          plano: Plano.PROFISSIONAL,
          limiteMembros: DEFAULT_UNLIMITED_STORED_LIMIT,
        }),
        select: expect.any(Object),
      });
    });

    it('deve respeitar override manual passado explicitamente no updateTenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: 't-3',
        nome: 'Igreja',
        plano: Plano.BASICO,
        limiteMembros: 200,
        ativo: true,
      });
      prisma.tenant.update.mockResolvedValue({ id: 't-3' });

      await service.updateTenant('t-3', { limiteMembros: 500 }, adminId);

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't-3' },
        data: expect.objectContaining({
          limiteMembros: 500,
        }),
        select: expect.any(Object),
      });
    });
  });
});
