import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Plano } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import { MembrosService } from './membros.service';

describe('MembrosService - limites por plano', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const dummyMemberDto = {
    nome: 'João da Silva',
    email: 'joao@exemplo.com',
  };

  const createService = (tenantMock: any, totalAtivos: number) => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(tenantMock),
      },
      client: {
        membro: {
          count: jest.fn().mockResolvedValue(totalAtivos),
          create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-id', ...data })),
        },
      },
    };
    const storage = {} as SupabaseStorageService;
    const service = new MembrosService(prisma as unknown as PrismaService, storage);
    return { service, prisma };
  };

  it('deve lançar NotFoundException quando o tenant não existir', async () => {
    const { service } = createService(null, 0);
    await expect(service.create(tenantId, dummyMemberDto as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('Plano PROFISSIONAL', () => {
    it('deve permitir criar membros mesmo que o total ativo seja superior ao limiteMembros numérico do banco', async () => {
      // Tenant profissional com número legado de 50 no banco e 150 membros já ativos
      const { service, prisma } = createService(
        { id: tenantId, plano: Plano.PROFISSIONAL, limiteMembros: 50 },
        150,
      );

      const result = await service.create(tenantId, dummyMemberDto as any);
      expect(result).toHaveProperty('id', 'new-id');
      expect(prisma.client.membro.create).toHaveBeenCalled();
    });

    it('deve permitir criar membros com 1000+ membros ativos sem restrição', async () => {
      const { service, prisma } = createService(
        { id: tenantId, plano: Plano.PROFISSIONAL, limiteMembros: 200 },
        1500,
      );

      const result = await service.create(tenantId, dummyMemberDto as any);
      expect(result).toHaveProperty('id', 'new-id');
      expect(prisma.client.membro.create).toHaveBeenCalled();
    });
  });

  describe('Plano GRATUITO (limite 50)', () => {
    it('deve permitir criar quando totalAtivos for menor que 50', async () => {
      const { service, prisma } = createService(
        { id: tenantId, plano: Plano.GRATUITO, limiteMembros: 50 },
        49,
      );

      const result = await service.create(tenantId, dummyMemberDto as any);
      expect(result).toHaveProperty('id', 'new-id');
      expect(prisma.client.membro.create).toHaveBeenCalled();
    });

    it('deve bloquear com ForbiddenException quando totalAtivos atingir 50', async () => {
      const { service, prisma } = createService(
        { id: tenantId, plano: Plano.GRATUITO, limiteMembros: 50 },
        50,
      );

      await expect(service.create(tenantId, dummyMemberDto as any)).rejects.toThrow(
        new ForbiddenException('Limite de membros (50) atingido para o plano GRATUITO. Faça um upgrade.'),
      );
      expect(prisma.client.membro.create).not.toHaveBeenCalled();
    });
  });

  describe('Plano BASICO (limite 200)', () => {
    it('deve permitir criar até 199 membros mesmo se limiteMembros no banco ainda for 50 (legado)', async () => {
      const { service, prisma } = createService(
        { id: tenantId, plano: Plano.BASICO, limiteMembros: 50 },
        150,
      );

      const result = await service.create(tenantId, dummyMemberDto as any);
      expect(result).toHaveProperty('id', 'new-id');
      expect(prisma.client.membro.create).toHaveBeenCalled();
    });

    it('deve bloquear com ForbiddenException quando totalAtivos atingir 200', async () => {
      const { service, prisma } = createService(
        { id: tenantId, plano: Plano.BASICO, limiteMembros: 50 },
        200,
      );

      await expect(service.create(tenantId, dummyMemberDto as any)).rejects.toThrow(
        new ForbiddenException('Limite de membros (200) atingido para o plano BASICO. Faça um upgrade.'),
      );
      expect(prisma.client.membro.create).not.toHaveBeenCalled();
    });

    it('deve respeitar override contratual maior (ex: 300)', async () => {
      const { service, prisma } = createService(
        { id: tenantId, plano: Plano.BASICO, limiteMembros: 300 },
        250,
      );

      const result = await service.create(tenantId, dummyMemberDto as any);
      expect(result).toHaveProperty('id', 'new-id');
      expect(prisma.client.membro.create).toHaveBeenCalled();
    });
  });
});
