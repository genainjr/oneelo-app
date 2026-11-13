import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SolicitacoesCadastroService } from './solicitacoes-cadastro.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthService } from '../auth/auth.service';
import {
  Plano,
  Role,
  StatusMembro,
  StatusSolicitacaoCadastro,
  TipoSolicitacaoCadastro,
} from '@prisma/client';

describe('SolicitacoesCadastroService (Triagem e Aprovação)', () => {
  let service: SolicitacoesCadastroService;
  let prisma: any;
  let notificationsService: any;
  let authService: any;

  const tenantId = 'tenant-xyz';
  const actorId = 'staff-user-id';

  const mockTenant = {
    id: tenantId,
    nome: 'Igreja Central',
    plano: Plano.GRATUITO,
    limiteMembros: 50,
  };

  beforeEach(async () => {
    prisma = {
      tenant: {
        findUnique: jest.fn(),
      },
      membro: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      solicitacaoCadastroMembro: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    notificationsService = {
      sendToUsers: jest.fn().mockResolvedValue(true),
    };

    authService = {
      createPendingBasicUserInTx: jest.fn().mockResolvedValue({
        user: {
          id: 'new-user-id',
          email: 'membro@test.com',
          status: 'PENDING',
        },
        activationLink: 'https://app.oneelo.com/activate/token-123',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitacoesCadastroService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = module.get<SolicitacoesCadastroService>(
      SolicitacoesCadastroService,
    );
  });

  describe('listSolicitacoes com motor de duplicidade', () => {
    it('deve listar fichas e detectar duplicidade com membro existente (visitante por telefone)', async () => {
      const mockSolicitacao = {
        id: 'sol-1',
        tenantId,
        tipo: TipoSolicitacaoCadastro.MEMBRO,
        status: StatusSolicitacaoCadastro.PENDENTE,
        nome: 'Carlos Visitante Que Virou Membro',
        telefone: '+5585991101771',
        email: 'carlos@test.com',
        cpf: null,
        createdAt: new Date(),
      };

      prisma.solicitacaoCadastroMembro.findMany.mockResolvedValue([
        mockSolicitacao,
      ]);
      prisma.membro.findMany.mockResolvedValue([
        {
          id: 'membro-visitante-1',
          nome: 'Carlos Silva',
          whatsapp: '85 99110-1771',
          email: null,
          cpf: null,
          status: StatusMembro.VISITANTE,
        },
      ]);

      const result = await service.listSolicitacoes(tenantId);

      expect(result).toHaveLength(1);
      expect(result[0].duplicidade.isDuplicate).toBe(true);
      expect(result[0].duplicidade.motivoDuplicidade).toBe('TELEFONE');
      expect(result[0].duplicidade.membroExistenteId).toBe(
        'membro-visitante-1',
      );
      expect(result[0].duplicidade.membroExistenteStatus).toBe(
        StatusMembro.VISITANTE,
      );
      expect(prisma.membro.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: [StatusMembro.ATIVO, StatusMembro.VISITANTE] },
        },
      }));
    });

    it('deve detectar duplicidade por nome completo exato', async () => {
      const mockSolicitacao = {
        id: 'sol-2',
        tenantId,
        tipo: TipoSolicitacaoCadastro.MEMBRO,
        status: StatusSolicitacaoCadastro.PENDENTE,
        nome: 'João da Silva',
        telefone: '+5511988887777',
        email: 'joao.novo@test.com',
        cpf: null,
        createdAt: new Date(),
      };

      prisma.solicitacaoCadastroMembro.findMany.mockResolvedValue([
        mockSolicitacao,
      ]);
      prisma.membro.findMany.mockResolvedValue([
        {
          id: 'membro-2',
          nome: 'joao da SILVA',
          whatsapp: '+5511911112222',
          email: null,
          cpf: null,
          status: StatusMembro.ATIVO,
        },
      ]);

      const result = await service.listSolicitacoes(tenantId);

      expect(result).toHaveLength(1);
      expect(result[0].duplicidade.isDuplicate).toBe(true);
      expect(result[0].duplicidade.motivoDuplicidade).toBe('NOME_EXATO');
      expect(result[0].duplicidade.membroExistenteId).toBe('membro-2');
    });
  });

  describe('aprovarSolicitacao', () => {
    it('deve aprovar ficha de visitante criando Membro VISITANTE sem criar usuário e sem quota', async () => {
      const mockSolicitacao = {
        id: 'sol-vis',
        tenantId,
        tipo: TipoSolicitacaoCadastro.VISITANTE,
        status: StatusSolicitacaoCadastro.PENDENTE,
        nome: 'Ana Visitante',
        telefone: '+5585999990000',
        email: null,
        createdAt: new Date('2026-11-12'),
      };

      prisma.solicitacaoCadastroMembro.findFirst.mockResolvedValue(
        mockSolicitacao,
      );
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.membro.create.mockResolvedValue({
        id: 'membro-vis-id',
        status: StatusMembro.VISITANTE,
        nome: 'Ana Visitante',
      });

      const res = await service.aprovarSolicitacao(
        tenantId,
        'sol-vis',
        actorId,
      );

      expect(res.membro.id).toBe('membro-vis-id');
      expect(res.user).toBeNull();
      expect(res.activationLink).toBeNull();
      expect(authService.createPendingBasicUserInTx).not.toHaveBeenCalled();
      expect(prisma.membro.count).not.toHaveBeenCalled(); // quota não verificada para visitante
    });

    it('deve aprovar vinculando a visitante existente, promovendo a ATIVO e criando usuário', async () => {
      const mockSolicitacao = {
        id: 'sol-membro-vincular',
        tenantId,
        tipo: TipoSolicitacaoCadastro.MEMBRO,
        status: StatusSolicitacaoCadastro.PENDENTE,
        nome: 'Carlos Silva',
        telefone: '+5585991101771',
        email: 'carlos@test.com',
        cpf: '12345678900',
        igrejaAnterior: 'Batista Central',
        quemConvidou: 'Pastor Marcos',
        batizadoAguas: true,
        createdAt: new Date('2026-11-12'),
      };

      const existingVisitor = {
        id: 'membro-visitante-1',
        tenantId,
        nome: 'Carlos Silva',
        whatsapp: '+5585991101771',
        status: StatusMembro.VISITANTE,
        observacoes: 'Veio no culto da virada',
        user: null,
      };

      prisma.solicitacaoCadastroMembro.findFirst.mockResolvedValue(
        mockSolicitacao,
      );
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.membro.findFirst.mockResolvedValue(existingVisitor);
      prisma.membro.count.mockResolvedValue(20); // 20 membros ativos < limite 50
      prisma.membro.update.mockResolvedValue({
        ...existingVisitor,
        status: StatusMembro.ATIVO,
      });

      const res = await service.aprovarSolicitacao(
        tenantId,
        'sol-membro-vincular',
        actorId,
        {
          vincularMembroId: 'membro-visitante-1',
        },
      );

      expect(res.membro.status).toBe(StatusMembro.ATIVO);
      expect(authService.createPendingBasicUserInTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tenantId,
          nome: 'Carlos Silva',
          email: 'carlos@test.com',
          memberId: 'membro-visitante-1',
        }),
      );
      expect(prisma.membro.update).toHaveBeenCalledWith({
        where: { id: 'membro-visitante-1' },
        data: expect.objectContaining({
          status: StatusMembro.ATIVO,
          observacoes: expect.stringContaining('Veio no culto da virada'),
        }),
      });
      expect(prisma.membro.update).toHaveBeenCalledWith({
        where: { id: 'membro-visitante-1' },
        data: expect.objectContaining({
          observacoes: expect.stringContaining(
            'Igreja anterior: Batista Central',
          ),
        }),
      });
    });

    it('deve bloquear aprovação de vínculo se limite de membros ativos for atingido', async () => {
      const mockSolicitacao = {
        id: 'sol-membro-limite',
        tenantId,
        tipo: TipoSolicitacaoCadastro.MEMBRO,
        status: StatusSolicitacaoCadastro.PENDENTE,
        nome: 'Membro Novo',
        telefone: '+5585991101771',
        email: 'novo@test.com',
        createdAt: new Date(),
      };

      const existingVisitor = {
        id: 'membro-visitante-1',
        tenantId,
        status: StatusMembro.VISITANTE,
        user: null,
      };

      prisma.solicitacaoCadastroMembro.findFirst.mockResolvedValue(
        mockSolicitacao,
      );
      prisma.tenant.findUnique.mockResolvedValue(mockTenant); // limite 50
      prisma.membro.findFirst.mockResolvedValue(existingVisitor);
      prisma.membro.count.mockResolvedValue(50); // já está com 50 ativos

      await expect(
        service.aprovarSolicitacao(tenantId, 'sol-membro-limite', actorId, {
          vincularMembroId: 'membro-visitante-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve aprovar novo membro (sem vínculo) criando Membro ATIVO e User PENDING', async () => {
      const mockSolicitacao = {
        id: 'sol-novo-membro',
        tenantId,
        tipo: TipoSolicitacaoCadastro.MEMBRO,
        status: StatusSolicitacaoCadastro.PENDENTE,
        nome: 'Novo Irmão',
        telefone: '+5585991101771',
        email: 'irmao@test.com',
        createdAt: new Date(),
      };

      prisma.solicitacaoCadastroMembro.findFirst.mockResolvedValue(
        mockSolicitacao,
      );
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.membro.count.mockResolvedValue(10);
      prisma.membro.create.mockResolvedValue({
        id: 'membro-novo-id',
        status: StatusMembro.ATIVO,
        nome: 'Novo Irmão',
      });

      const res = await service.aprovarSolicitacao(
        tenantId,
        'sol-novo-membro',
        actorId,
      );

      expect(res.membro.id).toBe('membro-novo-id');
      expect(res.user.id).toBe('new-user-id');
      expect(res.activationLink).toContain('token-123');
      expect(authService.createPendingBasicUserInTx).toHaveBeenCalled();
      expect(prisma.membro.count).toHaveBeenCalledWith({
        where: { tenantId, deletedAt: null, status: StatusMembro.ATIVO },
      });
    });
  });
});
