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

  describe('Novos campos cadastrais e eclesiásticos', () => {
    it('deve repassar matricula, cargo, dataBatismo, cpf, rg, sexo e estadoCivil ao prisma create', async () => {
      const { service, prisma } = createService(
        { id: tenantId, plano: Plano.BASICO, limiteMembros: 200 },
        10,
      );

      const completeMemberDto = {
        nome: 'Maria de Nazaré',
        email: 'maria@exemplo.com',
        matricula: 'ROL-00123',
        cargo: 'Diaconisa',
        dataBatismo: '2015-08-20T00:00:00Z',
        cpf: '123.456.789-00',
        rg: '200500900',
        sexo: 'FEMININO',
        estadoCivil: 'CASADO',
      };

      const result = await service.create(tenantId, completeMemberDto as any);
      expect(result).toMatchObject({
        nome: 'Maria de Nazaré',
        matricula: 'ROL-00123',
        cargo: 'Diaconisa',
        cpf: '123.456.789-00',
        rg: '200500900',
        sexo: 'FEMININO',
        estadoCivil: 'CASADO',
      });
      expect(prisma.client.membro.create).toHaveBeenCalledWith({
        data: {
          ...completeMemberDto,
          tenantId,
        },
        include: expect.any(Object),
      });
    });
  });

  describe('bulkRemove', () => {
    it('deve retornar count 0 quando array de ids for vazio', async () => {
      const { service } = createService({ id: tenantId, plano: Plano.PROFISSIONAL }, 10);
      const res = await service.bulkRemove(tenantId, []);
      expect(res.count).toBe(0);
    });

    it('deve lançar NotFoundException quando nenhum membro ativo pertencer ao tenant', async () => {
      const prisma = {
        client: {
          membro: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        },
      };
      const storage = {} as any;
      const service = new MembrosService(prisma as any, storage);

      await expect(service.bulkRemove(tenantId, ['uuid-1', 'uuid-2'])).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deve desvincular dados, aplicar soft delete e registrar auditoria em transação', async () => {
      const membersMock = [
        { id: 'm1', nome: 'Membro 1', fotoKey: 'photo-1.jpg' },
        { id: 'm2', nome: 'Membro 2', fotoKey: null },
      ];

      const deleteObjectMock = jest.fn().mockResolvedValue(true);
      const txMock = {
        ministerioMembroFuncao: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        ministerioMembro: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        membroTag: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
        membro: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
        auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      };

      const prisma = {
        client: {
          membro: {
            findMany: jest.fn().mockResolvedValue(membersMock),
          },
        },
        $transaction: jest.fn(async (cb) => cb(txMock)),
      };

      const storage = {
        deleteObject: deleteObjectMock,
      } as any;

      const service = new MembrosService(prisma as any, storage);
      const res = await service.bulkRemove(tenantId, ['m1', 'm2'], 'user-admin');

      expect(res.count).toBe(2);
      expect(deleteObjectMock).toHaveBeenCalledWith(expect.any(String), 'photo-1.jpg');
      expect(txMock.ministerioMembroFuncao.deleteMany).toHaveBeenCalledWith({
        where: { membroId: { in: ['m1', 'm2'] } },
      });
      expect(txMock.membro.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['m1', 'm2'] } },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          fotoUrl: null,
          fotoKey: null,
        }),
      });
      expect(txMock.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          userId: 'user-admin',
          entidade: 'Membro',
          entidadeId: 'BULK_DELETE',
          acao: 'DELETAR',
        }),
      });
    });
  });

});
