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
  EstadoCivil,
  Plano,
  Role,
  SexoMembro,
  StatusMembro,
  StatusSolicitacaoCadastro,
  TipoSolicitacaoCadastro,
  UserStatus,
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
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      solicitacaoCadastroMembro: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
      regeneratePendingActivationInTx: jest.fn().mockResolvedValue({
        id: 'existing-pending-user',
        nome: 'Usuário Pendente',
        email: 'pending@test.com',
        role: Role.BASIC,
        status: UserStatus.PENDING,
        activationLink: 'https://app.oneelo.com/activate/regen-789',
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

    it('deve pré-carregar contexto em lote (evitando N+1) e retornar snapshot de membro e usuário existente em todos os estados', async () => {
      const birthDate = new Date('1992-06-04T00:00:00.000Z');
      prisma.solicitacaoCadastroMembro.findMany.mockResolvedValue([
        {
          id: 'sol-sem-user',
          tenantId,
          tipo: TipoSolicitacaoCadastro.MEMBRO,
          status: StatusSolicitacaoCadastro.PENDENTE,
          nome: 'Sem Usuário',
          telefone: '+5585999000001',
          email: 'sem@test.com',
          cpf: '11111111111',
          createdAt: new Date(),
        },
        {
          id: 'sol-pending',
          tenantId,
          tipo: TipoSolicitacaoCadastro.MEMBRO,
          status: StatusSolicitacaoCadastro.PENDENTE,
          nome: 'Pendente Ativação',
          telefone: '+5585999000002',
          email: 'pending@test.com',
          cpf: '22222222222',
          createdAt: new Date(),
        },
        {
          id: 'sol-active',
          tenantId,
          tipo: TipoSolicitacaoCadastro.MEMBRO,
          status: StatusSolicitacaoCadastro.PENDENTE,
          nome: 'Usuário Ativo',
          telefone: '+5585999000003',
          email: 'ativo@test.com',
          cpf: '33333333333',
          createdAt: new Date(),
        },
        {
          id: 'sol-disabled',
          tenantId,
          tipo: TipoSolicitacaoCadastro.MEMBRO,
          status: StatusSolicitacaoCadastro.PENDENTE,
          nome: 'Usuário Desativado',
          telefone: '+5585999000004',
          email: 'disabled@test.com',
          cpf: '44444444444',
          createdAt: new Date(),
        },
        {
          id: 'sol-staff',
          tenantId,
          tipo: TipoSolicitacaoCadastro.MEMBRO,
          status: StatusSolicitacaoCadastro.PENDENTE,
          nome: 'Membro Staff',
          telefone: '+5585999000005',
          email: 'staff@test.com',
          cpf: '55555555555',
          createdAt: new Date(),
        },
        {
          id: 'sol-ficha-dup-1',
          tenantId,
          tipo: TipoSolicitacaoCadastro.MEMBRO,
          status: StatusSolicitacaoCadastro.PENDENTE,
          nome: 'Ficha Concorrente',
          telefone: '+5585999000099',
          email: 'ficha1@test.com',
          cpf: '99999999999',
          createdAt: new Date(),
        },
        {
          id: 'sol-ficha-dup-2',
          tenantId,
          tipo: TipoSolicitacaoCadastro.MEMBRO,
          status: StatusSolicitacaoCadastro.PENDENTE,
          nome: 'Ficha Concorrente 2',
          telefone: '+5585999000088',
          email: 'ficha2@test.com',
          cpf: '99999999999',
          createdAt: new Date(),
        },
      ]);

      prisma.membro.findMany.mockResolvedValue([
        {
          id: 'm-sem-user',
          nome: 'Sem Usuário',
          whatsapp: '+5585999000001',
          email: null,
          cpf: '11111111111',
          dataNascimento: birthDate,
          sexo: SexoMembro.MASCULINO,
          estadoCivil: EstadoCivil.CASADO,
          observacoes: 'Nota prévia',
          status: StatusMembro.ATIVO,
          user: null,
        },
        {
          id: 'm-pending',
          nome: 'Pendente Ativação',
          whatsapp: '+5585999000002',
          email: 'pending@test.com',
          cpf: '22222222222',
          dataNascimento: null,
          sexo: null,
          estadoCivil: null,
          observacoes: null,
          status: StatusMembro.ATIVO,
          user: {
            id: 'u-pending',
            role: Role.BASIC,
            status: UserStatus.PENDING,
            ativo: false,
            email: 'pending@test.com',
            telefoneLogin: '+5585999000002',
          },
        },
        {
          id: 'm-active',
          nome: 'Usuário Ativo',
          whatsapp: '+5585999000003',
          email: 'ativo@test.com',
          cpf: '33333333333',
          dataNascimento: null,
          sexo: null,
          estadoCivil: null,
          observacoes: null,
          status: StatusMembro.ATIVO,
          user: {
            id: 'u-active',
            role: Role.BASIC,
            status: UserStatus.ACTIVE,
            ativo: true,
            email: 'ativo@test.com',
            telefoneLogin: '+5585999000003',
          },
        },
        {
          id: 'm-disabled',
          nome: 'Usuário Desativado',
          whatsapp: '+5585999000004',
          email: 'disabled@test.com',
          cpf: '44444444444',
          dataNascimento: null,
          sexo: null,
          estadoCivil: null,
          observacoes: null,
          status: StatusMembro.ATIVO,
          user: {
            id: 'u-disabled',
            role: Role.BASIC,
            status: UserStatus.DISABLED,
            ativo: false,
            email: 'disabled@test.com',
            telefoneLogin: '+5585999000004',
          },
        },
        {
          id: 'm-staff',
          nome: 'Membro Staff',
          whatsapp: '+5585999000005',
          email: 'staff@test.com',
          cpf: '55555555555',
          dataNascimento: null,
          sexo: null,
          estadoCivil: null,
          observacoes: null,
          status: StatusMembro.ATIVO,
          user: {
            id: 'u-staff',
            role: Role.STAFF,
            status: UserStatus.ACTIVE,
            ativo: true,
            email: 'staff@test.com',
            telefoneLogin: '+5585999000005',
          },
        },
      ]);

      const result = await service.listSolicitacoes(tenantId);

      // Pré-carregamento em lote: 1 busca de fichas + 1 busca de membros
      expect(prisma.solicitacaoCadastroMembro.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.membro.findMany).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(7);

      expect(result[0].duplicidade).toMatchObject({
        isDuplicate: true,
        motivoDuplicidade: 'CPF',
        membroExistente: {
          id: 'm-sem-user',
          nome: 'Sem Usuário',
          cpf: '11111111111',
          dataNascimento: birthDate,
          sexo: SexoMembro.MASCULINO,
          estadoCivil: EstadoCivil.CASADO,
          observacoes: 'Nota prévia',
          status: StatusMembro.ATIVO,
        },
        usuarioExistente: null,
      });

      expect(result[1].duplicidade.usuarioExistente).toEqual({
        id: 'u-pending',
        role: Role.BASIC,
        status: UserStatus.PENDING,
        ativo: false,
        email: 'pending@test.com',
        telefoneLogin: '+5585999000002',
      });
      expect(result[2].duplicidade.usuarioExistente?.status).toBe(
        UserStatus.ACTIVE,
      );
      expect(result[3].duplicidade.usuarioExistente?.status).toBe(
        UserStatus.DISABLED,
      );
      expect(result[4].duplicidade.usuarioExistente?.role).toBe(Role.STAFF);

      // Ficha concorrente não tem membroExistenteId nem usuarioExistente
      expect(result[5].duplicidade.motivoDuplicidade).toBe('FICHA_PENDENTE');
      expect(result[5].duplicidade.membroExistenteId).toBeUndefined();
      expect(result[5].duplicidade.membroExistente).toBeUndefined();
      expect(result[5].duplicidade.usuarioExistente).toBeUndefined();
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

    it('deve atualizar seletivamente membro ATIVO sem usuário, criar acesso PENDING e não consumir nova vaga de cota', async () => {
      const mockSolicitacao = {
        id: 'sol-ativo-sem-user',
        tenantId,
        tipo: TipoSolicitacaoCadastro.MEMBRO,
        status: StatusSolicitacaoCadastro.PENDENTE,
        nome: 'Messias do Nascimento Júnior',
        telefone: '+5585991101771',
        email: 'messinjr@gmail.com',
        cpf: '12345678900',
        dataNascimento: new Date('1992-06-04T00:00:00.000Z'),
        sexo: SexoMembro.MASCULINO,
        estadoCivil: EstadoCivil.CASADO,
        createdAt: new Date('2026-11-15'),
      };

      const existingActiveMember = {
        id: 'membro-ativo-1',
        tenantId,
        nome: 'Messias Júnior (Antigo)',
        whatsapp: '+5585988880000',
        email: null,
        cpf: '12345678900',
        dataNascimento: null,
        sexo: null,
        estadoCivil: null,
        status: StatusMembro.ATIVO,
        observacoes: 'Importado em 2025',
        user: null,
      };

      prisma.solicitacaoCadastroMembro.findFirst.mockResolvedValue(
        mockSolicitacao,
      );
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.membro.findFirst.mockResolvedValue(existingActiveMember);
      prisma.membro.update.mockResolvedValue({
        ...existingActiveMember,
        nome: 'Messias do Nascimento Júnior',
        email: 'messinjr@gmail.com',
        dataNascimento: mockSolicitacao.dataNascimento,
      });

      const res = await service.aprovarSolicitacao(
        tenantId,
        'sol-ativo-sem-user',
        actorId,
        {
          vincularMembroId: 'membro-ativo-1',
          camposAtualizar: ['nome', 'email', 'dataNascimento'],
          anexarObservacoes: true,
          criarOuRegenerarAcesso: true,
        },
      );

      expect(prisma.membro.count).not.toHaveBeenCalled();
      expect(prisma.membro.update).toHaveBeenCalledWith({
        where: { id: 'membro-ativo-1' },
        data: expect.objectContaining({
          status: StatusMembro.ATIVO,
          nome: 'Messias do Nascimento Júnior',
          email: 'messinjr@gmail.com',
          dataNascimento: mockSolicitacao.dataNascimento,
          observacoes: expect.stringContaining('Importado em 2025'),
        }),
      });
      // whatsapp não selecionado permanece intocado no updateData
      const updatePayload = prisma.membro.update.mock.calls[0][0].data;
      expect(updatePayload.whatsapp).toBeUndefined();

      expect(authService.createPendingBasicUserInTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          memberId: 'membro-ativo-1',
          email: 'messinjr@gmail.com',
          nome: 'Messias do Nascimento Júnior',
        }),
      );
      expect(res.userAccessOutcome).toBe('CREATED');
      expect(res.activationLink).toContain('token-123');
    });

    it('deve lançar 400 BadRequestException (nunca 500) ao tentar criar usuário para vínculo sem e-mail final', async () => {
      prisma.solicitacaoCadastroMembro.findFirst.mockResolvedValue({
        id: 'sol-sem-email',
        tenantId,
        tipo: TipoSolicitacaoCadastro.VISITANTE,
        status: StatusSolicitacaoCadastro.PENDENTE,
        nome: 'Visitante Sem Email',
        telefone: '+5585991101771',
        email: null,
        createdAt: new Date(),
      });
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.membro.findFirst.mockResolvedValue({
        id: 'membro-sem-email',
        tenantId,
        nome: 'Visitante Sem Email',
        whatsapp: '+5585991101771',
        email: null,
        status: StatusMembro.VISITANTE,
        user: null,
      });
      prisma.membro.count.mockResolvedValue(1);
      prisma.membro.update.mockResolvedValue({
        id: 'membro-sem-email',
        nome: 'Visitante Sem Email',
        email: null,
        status: StatusMembro.ATIVO,
      });

      await expect(
        service.aprovarSolicitacao(tenantId, 'sol-sem-email', actorId, {
          vincularMembroId: 'membro-sem-email',
          promoverParaAtivo: true,
          criarOuRegenerarAcesso: true,
          camposAtualizar: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve atualizar membro ATIVO com usuário PENDING, sincronizar contato e regenerar link 72h', async () => {
      prisma.solicitacaoCadastroMembro.findFirst.mockResolvedValue({
        id: 'sol-pending-link',
        tenantId,
        tipo: TipoSolicitacaoCadastro.MEMBRO,
        status: StatusSolicitacaoCadastro.PENDENTE,
        nome: 'Nome Corrigido',
        telefone: '+5585998887777',
        email: 'corrigido@test.com',
        createdAt: new Date(),
      });
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.membro.findFirst.mockResolvedValue({
        id: 'membro-p1',
        tenantId,
        nome: 'Nome Antigo',
        whatsapp: '+5585991112222',
        email: 'antigo@test.com',
        status: StatusMembro.ATIVO,
        user: {
          id: 'u-p1',
          nome: 'Nome Antigo',
          email: 'antigo@test.com',
          telefoneLogin: '+5585991112222',
          role: Role.BASIC,
          status: UserStatus.PENDING,
          ativo: false,
          activationExpiresAt: null,
        },
      });
      prisma.membro.update.mockResolvedValue({
        id: 'membro-p1',
        nome: 'Nome Corrigido',
        whatsapp: '+5585998887777',
        email: 'corrigido@test.com',
        status: StatusMembro.ATIVO,
      });

      const res = await service.aprovarSolicitacao(
        tenantId,
        'sol-pending-link',
        actorId,
        {
          vincularMembroId: 'membro-p1',
          camposAtualizar: ['nome', 'email', 'whatsapp'],
          criarOuRegenerarAcesso: true,
        },
      );

      expect(authService.regeneratePendingActivationInTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'u-p1',
          nome: 'Nome Corrigido',
          email: 'corrigido@test.com',
          telefoneLogin: '+5585998887777',
          regenerarLink: true,
        }),
      );
      expect(res.userAccessOutcome).toBe('REGENERATED');
      expect(res.activationLink).toContain('regen-789');
    });

    it('deve proteger contas ACTIVE, DISABLED e ADMIN/STAFF mantendo dados do usuário intactos e concluindo ficha sem 409', async () => {
      const cases = [
        {
          label: 'ACTIVE',
          user: {
            id: 'u-active',
            nome: 'Ativo',
            email: 'ativo@test.com',
            role: Role.BASIC,
            status: UserStatus.ACTIVE,
            ativo: true,
          },
          expectedOutcome: 'ALREADY_ACTIVE',
        },
        {
          label: 'DISABLED',
          user: {
            id: 'u-disabled',
            nome: 'Desativado',
            email: 'disabled@test.com',
            role: Role.BASIC,
            status: UserStatus.DISABLED,
            ativo: false,
          },
          expectedOutcome: 'DISABLED',
        },
        {
          label: 'STAFF',
          user: {
            id: 'u-staff',
            nome: 'Staff',
            email: 'staff@test.com',
            role: Role.STAFF,
            status: UserStatus.ACTIVE,
            ativo: true,
          },
          expectedOutcome: 'PROTECTED_ROLE',
        },
      ];

      for (const scenario of cases) {
        jest.clearAllMocks();
        prisma.solicitacaoCadastroMembro.updateMany.mockResolvedValue({ count: 1 });
        prisma.solicitacaoCadastroMembro.findFirst.mockResolvedValue({
          id: `sol-${scenario.label}`,
          tenantId,
          tipo: TipoSolicitacaoCadastro.MEMBRO,
          status: StatusSolicitacaoCadastro.PENDENTE,
          nome: 'Nome Novo',
          telefone: '+5585991101771',
          email: 'novo@test.com',
          createdAt: new Date(),
        });
        prisma.tenant.findUnique.mockResolvedValue(mockTenant);
        prisma.membro.findFirst.mockResolvedValue({
          id: `m-${scenario.label}`,
          tenantId,
          nome: 'Nome Antigo',
          whatsapp: '+5585991101771',
          email: scenario.user.email,
          status: StatusMembro.ATIVO,
          user: scenario.user,
        });
        prisma.membro.update.mockResolvedValue({
          id: `m-${scenario.label}`,
          nome: 'Nome Novo',
          status: StatusMembro.ATIVO,
        });

        const res = await service.aprovarSolicitacao(
          tenantId,
          `sol-${scenario.label}`,
          actorId,
          {
            vincularMembroId: `m-${scenario.label}`,
            camposAtualizar: ['nome'],
            criarOuRegenerarAcesso: true,
          },
        );

        expect(authService.createPendingBasicUserInTx).not.toHaveBeenCalled();
        expect(
          authService.regeneratePendingActivationInTx,
        ).not.toHaveBeenCalled();
        expect(res.activationLink).toBeNull();
        expect(res.userAccessOutcome).toBe(scenario.expectedOutcome);
      }
    });

    it('deve priorizar vincularMembroId em ficha VISITANTE sobre membro ATIVO sem fazer downgrade para VISITANTE', async () => {
      prisma.solicitacaoCadastroMembro.findFirst.mockResolvedValue({
        id: 'sol-vis-ativo',
        tenantId,
        tipo: TipoSolicitacaoCadastro.VISITANTE,
        status: StatusSolicitacaoCadastro.PENDENTE,
        nome: 'Messias Atualizado',
        telefone: '+5585991101771',
        cpf: '12345678900',
        createdAt: new Date(),
      });
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.membro.findFirst.mockResolvedValue({
        id: 'm-ativo-vis',
        tenantId,
        nome: 'Messias',
        whatsapp: '+5585991101771',
        status: StatusMembro.ATIVO,
        user: {
          id: 'u-1',
          nome: 'Messias',
          email: 'm@test.com',
          role: Role.BASIC,
          status: UserStatus.ACTIVE,
        },
      });
      prisma.membro.update.mockResolvedValue({
        id: 'm-ativo-vis',
        nome: 'Messias Atualizado',
        status: StatusMembro.ATIVO,
      });

      const res = await service.aprovarSolicitacao(
        tenantId,
        'sol-vis-ativo',
        actorId,
        {
          vincularMembroId: 'm-ativo-vis',
          camposAtualizar: ['nome'],
          promoverParaAtivo: false,
        },
      );

      expect(prisma.membro.create).not.toHaveBeenCalled();
      expect(prisma.membro.update).toHaveBeenCalledWith({
        where: { id: 'm-ativo-vis' },
        data: expect.objectContaining({
          status: StatusMembro.ATIVO,
          nome: 'Messias Atualizado',
        }),
      });
      expect(res.userAccessOutcome).toBe('ALREADY_ACTIVE');
    });

    it('deve impedir criação duplicada por CPF mesmo com permitirCriarNovoMesmoDuplicado e permitir apenas homônimo NOME_EXATO', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);

      // Caso CPF duplicado
      prisma.solicitacaoCadastroMembro.findFirst.mockResolvedValue({
        id: 'sol-cpf-dup',
        tenantId,
        tipo: TipoSolicitacaoCadastro.MEMBRO,
        status: StatusSolicitacaoCadastro.PENDENTE,
        nome: 'Messias',
        telefone: '+5585990000001',
        email: 'm2@test.com',
        cpf: '12345678900',
        createdAt: new Date(),
      });
      prisma.membro.findMany.mockResolvedValue([
        {
          id: 'm-existente-cpf',
          nome: 'Messias Júnior',
          whatsapp: '+5585991101771',
          email: 'm1@test.com',
          cpf: '12345678900',
          status: StatusMembro.ATIVO,
          user: null,
        },
      ]);

      await expect(
        service.aprovarSolicitacao(tenantId, 'sol-cpf-dup', actorId, {
          permitirCriarNovoMesmoDuplicado: true,
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.membro.create).not.toHaveBeenCalled();

      // Caso NOME_EXATO com permitirCriarNovoMesmoDuplicado: true
      prisma.solicitacaoCadastroMembro.findFirst.mockResolvedValue({
        id: 'sol-homonimo',
        tenantId,
        tipo: TipoSolicitacaoCadastro.MEMBRO,
        status: StatusSolicitacaoCadastro.PENDENTE,
        nome: 'João da Silva',
        telefone: '+5585990000002',
        email: 'joao2@test.com',
        cpf: null,
        createdAt: new Date(),
      });
      prisma.membro.findMany.mockResolvedValue([
        {
          id: 'm-joao-1',
          nome: 'João da Silva',
          whatsapp: '+5585911112222',
          email: 'joao1@test.com',
          cpf: null,
          status: StatusMembro.ATIVO,
          user: null,
        },
      ]);
      prisma.membro.count.mockResolvedValue(5);
      prisma.membro.create.mockResolvedValue({
        id: 'm-joao-2',
        nome: 'João da Silva',
        status: StatusMembro.ATIVO,
      });

      const resHomonimo = await service.aprovarSolicitacao(
        tenantId,
        'sol-homonimo',
        actorId,
        { permitirCriarNovoMesmoDuplicado: true },
      );

      expect(resHomonimo.membro.id).toBe('m-joao-2');
      expect(resHomonimo.userAccessOutcome).toBe('CREATED');
    });

    it('deve impedir dupla aprovação concorrente quando claim atômico retornar count 0', async () => {
      prisma.solicitacaoCadastroMembro.findFirst.mockResolvedValue({
        id: 'sol-race',
        tenantId,
        tipo: TipoSolicitacaoCadastro.MEMBRO,
        status: StatusSolicitacaoCadastro.PENDENTE,
        nome: 'Corrida',
        telefone: '+5585991101771',
        email: 'race@test.com',
        createdAt: new Date(),
      });
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.solicitacaoCadastroMembro.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.aprovarSolicitacao(tenantId, 'sol-race', actorId),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.membro.create).not.toHaveBeenCalled();
    });
  });
});
