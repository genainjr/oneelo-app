import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Plano, Role, StatusMembro, UserStatus } from '@prisma/client';
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

  describe('promoteVisitante', () => {
    it('deve promover visitante para ATIVO e criar usuário PENDING com link de ativação', async () => {
      const txMock = {
        tenant: {
          findUnique: jest.fn().mockResolvedValue({
            id: tenantId,
            plano: Plano.GRATUITO,
            limiteMembros: 50,
          }),
        },
        membro: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'vis-1',
            tenantId,
            nome: 'Messias Visitante',
            email: null,
            whatsapp: '+5585991101771',
            status: StatusMembro.VISITANTE,
            user: null,
          }),
          count: jest.fn().mockResolvedValue(5),
          update: jest.fn().mockResolvedValue({
            id: 'vis-1',
            tenantId,
            nome: 'Messias Visitante',
            email: 'messias@igreja.com',
            whatsapp: '+5585991101771',
            status: StatusMembro.ATIVO,
          }),
        },
        auditLog: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      const prisma = {
        $transaction: jest.fn(async (cb) => cb(txMock)),
      };

      const authService = {
        createPendingBasicUserInTx: jest.fn().mockResolvedValue({
          user: { id: 'user-1', nome: 'Messias Visitante', email: 'messias@igreja.com' },
          activationLink: 'https://app.oneelo.com/activate/tok-1',
        }),
      } as any;

      const service = new MembrosService(prisma as any, {} as any, authService);
      const res = await service.promoteVisitante(
        tenantId,
        'vis-1',
        { email: 'Messias@Igreja.com', criarAcesso: true },
        'admin-1',
        '127.0.0.1',
      );

      expect(txMock.membro.count).toHaveBeenCalledWith({
        where: { tenantId, deletedAt: null, status: StatusMembro.ATIVO },
      });
      expect(txMock.membro.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'vis-1' },
          data: expect.objectContaining({
            status: StatusMembro.ATIVO,
            email: 'messias@igreja.com',
          }),
        }),
      );
      expect(authService.createPendingBasicUserInTx).toHaveBeenCalledWith(
        txMock,
        expect.objectContaining({
          tenantId,
          email: 'messias@igreja.com',
          memberId: 'vis-1',
          actorId: 'admin-1',
        }),
      );
      expect(res.activationLink).toBe('https://app.oneelo.com/activate/tok-1');
    });

    it('deve promover visitante sem criar acesso quando criarAcesso for false e sem e-mail', async () => {
      const txMock = {
        tenant: {
          findUnique: jest.fn().mockResolvedValue({
            id: tenantId,
            plano: Plano.GRATUITO,
            limiteMembros: 50,
          }),
        },
        membro: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'vis-2',
            tenantId,
            nome: 'Maria Visitante',
            email: null,
            whatsapp: '+5585999990000',
            status: StatusMembro.VISITANTE,
            user: null,
          }),
          count: jest.fn().mockResolvedValue(2),
          update: jest.fn().mockResolvedValue({
            id: 'vis-2',
            tenantId,
            nome: 'Maria Visitante',
            status: StatusMembro.ATIVO,
          }),
        },
        auditLog: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      const prisma = {
        $transaction: jest.fn(async (cb) => cb(txMock)),
      };
      const authService = { createPendingBasicUserInTx: jest.fn() } as any;

      const service = new MembrosService(prisma as any, {} as any, authService);
      const res = await service.promoteVisitante(
        tenantId,
        'vis-2',
        { criarAcesso: false },
        'admin-1',
      );

      expect(authService.createPendingBasicUserInTx).not.toHaveBeenCalled();
      expect(res.activationLink).toBeNull();
      expect(res.user).toBeNull();
    });

    it('deve rejeitar promoção quando criarAcesso for true e não houver e-mail', async () => {
      const txMock = {
        tenant: {
          findUnique: jest.fn().mockResolvedValue({
            id: tenantId,
            plano: Plano.GRATUITO,
            limiteMembros: 50,
          }),
        },
        membro: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'vis-3',
            tenantId,
            nome: 'Sem Email',
            email: null,
            status: StatusMembro.VISITANTE,
            user: null,
          }),
          count: jest.fn().mockResolvedValue(2),
        },
      };

      const prisma = {
        $transaction: jest.fn(async (cb) => cb(txMock)),
      };

      const service = new MembrosService(prisma as any, {} as any, {} as any);
      await expect(
        service.promoteVisitante(tenantId, 'vis-3', { criarAcesso: true }, 'admin-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('deve rejeitar se o cadastro não estiver com status VISITANTE', async () => {
      const txMock = {
        tenant: {
          findUnique: jest.fn().mockResolvedValue({
            id: tenantId,
            plano: Plano.GRATUITO,
            limiteMembros: 50,
          }),
        },
        membro: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'mem-ativo',
            tenantId,
            status: StatusMembro.ATIVO,
            user: null,
          }),
        },
      };

      const prisma = {
        $transaction: jest.fn(async (cb) => cb(txMock)),
      };

      const service = new MembrosService(prisma as any, {} as any, {} as any);
      await expect(
        service.promoteVisitante(tenantId, 'mem-ativo', {}, 'admin-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('generateActivationLink', () => {
    it('deve regenerar link para membro com usuário BASIC PENDING', async () => {
      const prisma = {
        client: {
          membro: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'm1',
              tenantId,
              nome: 'Fabiana',
              whatsapp: '+5585991104343',
              user: {
                id: 'u1',
                nome: 'Fabiana',
                email: 'fab@igreja.com',
                role: Role.BASIC,
                status: UserStatus.PENDING,
                activationExpiresAt: null,
              },
            }),
          },
        },
      };

      const authService = {
        regenerateActivationLink: jest.fn().mockResolvedValue({
          id: 'u1',
          nome: 'Fabiana',
          email: 'fab@igreja.com',
          role: Role.BASIC,
          status: UserStatus.PENDING,
          activationExpiresAt: new Date('2026-11-16T12:00:00Z'),
          activationLink: 'https://app.oneelo.com/activate/new-tok',
        }),
      } as any;

      const service = new MembrosService(prisma as any, {} as any, authService);
      const res = await service.generateActivationLink(tenantId, 'm1', 'staff-1', '127.0.0.1');

      expect(authService.regenerateActivationLink).toHaveBeenCalledWith(
        'u1',
        tenantId,
        'staff-1',
        '127.0.0.1',
      );
      expect(res.activationLink).toBe('https://app.oneelo.com/activate/new-tok');
    });

    it('deve bloquear com ForbiddenException quando usuário vinculado não for BASIC', async () => {
      const prisma = {
        client: {
          membro: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'm-admin',
              tenantId,
              user: {
                id: 'u-admin',
                role: Role.ADMIN,
                status: UserStatus.PENDING,
              },
            }),
          },
        },
      };

      const service = new MembrosService(prisma as any, {} as any, {} as any);
      await expect(
        service.generateActivationLink(tenantId, 'm-admin', 'staff-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('deve bloquear com BadRequestException quando usuário já estiver ACTIVE', async () => {
      const prisma = {
        client: {
          membro: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'm-active',
              tenantId,
              user: {
                id: 'u-active',
                role: Role.BASIC,
                status: UserStatus.ACTIVE,
              },
            }),
          },
        },
      };

      const service = new MembrosService(prisma as any, {} as any, {} as any);
      await expect(
        service.generateActivationLink(tenantId, 'm-active', 'staff-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

});
