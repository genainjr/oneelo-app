import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SolicitacoesCadastroService } from './solicitacoes-cadastro.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthService } from '../auth/auth.service';
import { Role, TipoSolicitacaoCadastro } from '@prisma/client';

describe('SolicitacoesCadastroService (Public)', () => {
  let service: SolicitacoesCadastroService;
  let prisma: any;
  let notificationsService: any;

  const mockTenant = {
    id: 'tenant-123',
    nome: 'Igreja Vida Nova',
    slug: 'igreja-vida-nova',
    logoUrl: 'https://cdn.oneelo.com/logos/tenant-123.png',
    ativo: true,
  };

  beforeEach(async () => {
    prisma = {
      tenant: {
        findUnique: jest.fn(),
      },
      solicitacaoCadastroMembro: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    };

    notificationsService = {
      sendToUsers: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitacoesCadastroService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: AuthService, useValue: {} },
      ],
    }).compile();

    service = module.get<SolicitacoesCadastroService>(
      SolicitacoesCadastroService,
    );
  });

  describe('getPublicTenantInfo', () => {
    it('deve retornar dados públicos do tenant se ativo', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);

      const result = await service.getPublicTenantInfo('igreja-vida-nova');

      expect(result).toEqual({
        nome: mockTenant.nome,
        slug: mockTenant.slug,
        logoUrl: mockTenant.logoUrl,
      });
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: 'igreja-vida-nova' },
        select: expect.any(Object),
      });
    });

    it('deve lançar NotFoundException se tenant não existir ou for inativo', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.getPublicTenantInfo('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('submitRegistration', () => {
    it('deve ignorar submissão silenciosamente quando honeypot (website) for preenchido', async () => {
      const result = await service.submitRegistration('qualquer-slug', {
        tipo: TipoSolicitacaoCadastro.VISITANTE,
        nome: 'Spam Bot',
        telefone: '11999999999',
        consentimentoLgpd: true,
        website: 'http://spam-link.com',
      });

      expect(result.success).toBe(true);
      expect(prisma.solicitacaoCadastroMembro.create).not.toHaveBeenCalled();
      expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    });

    it('deve submeter visitante com sucesso sem e-mail', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.solicitacaoCadastroMembro.findMany.mockResolvedValue([]);
      prisma.solicitacaoCadastroMembro.create.mockResolvedValue({
        id: 'sol-visitante-1',
      });
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      const result = await service.submitRegistration(mockTenant.slug, {
        tipo: TipoSolicitacaoCadastro.VISITANTE,
        nome: 'João Silva Visitante',
        telefone: '85 99110-1771',
        consentimentoLgpd: true,
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('sol-visitante-1');
      expect(prisma.solicitacaoCadastroMembro.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: TipoSolicitacaoCadastro.VISITANTE,
          nome: 'João Silva Visitante',
          telefone: '+5585991101771',
          email: undefined,
          status: 'PENDENTE',
        }),
      });
      expect(notificationsService.sendToUsers).toHaveBeenCalledWith(
        mockTenant.id,
        ['admin-1'],
        expect.objectContaining({
          title: 'Nova ficha recebida',
          body: expect.stringContaining('visitante'),
          url: '/membros?tab=fichas',
        }),
      );
    });

    it('deve submeter membro com sucesso com e-mail obrigatório e CPF opcional', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.solicitacaoCadastroMembro.findMany.mockResolvedValue([]);
      prisma.solicitacaoCadastroMembro.create.mockResolvedValue({
        id: 'sol-membro-1',
      });
      prisma.user.findMany.mockResolvedValue([
        { id: 'admin-1' },
        { id: 'staff-1' },
      ]);

      const result = await service.submitRegistration(mockTenant.slug, {
        tipo: TipoSolicitacaoCadastro.MEMBRO,
        nome: 'Maria Silva',
        telefone: '(11) 98765-4321',
        email: 'maria@silva.com',
        cpf: '123.456.789-00',
        consentimentoLgpd: true,
        batizadoAguas: true,
        igrejaAnterior: 'Igreja Central',
      });

      expect(result.success).toBe(true);
      expect(prisma.solicitacaoCadastroMembro.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: TipoSolicitacaoCadastro.MEMBRO,
          nome: 'Maria Silva',
          telefone: '+5511987654321',
          email: 'maria@silva.com',
          cpf: '12345678900',
          batizadoAguas: true,
          igrejaAnterior: 'Igreja Central',
        }),
      });
      expect(notificationsService.sendToUsers).toHaveBeenCalledWith(
        mockTenant.id,
        ['admin-1', 'staff-1'],
        expect.objectContaining({
          body: expect.stringContaining('membro'),
        }),
      );
    });

    it('deve rejeitar membro sem e-mail com BadRequestException', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);

      await expect(
        service.submitRegistration(mockTenant.slug, {
          tipo: TipoSolicitacaoCadastro.MEMBRO,
          nome: 'Pedro Alvares',
          telefone: '11987654321',
          consentimentoLgpd: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar submissão se consentimento LGPD for falso', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);

      await expect(
        service.submitRegistration(mockTenant.slug, {
          tipo: TipoSolicitacaoCadastro.VISITANTE,
          nome: 'Pedro Alvares',
          telefone: '11987654321',
          consentimentoLgpd: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve atualizar ficha pendente existente se o mesmo telefone submeter novamente (idempotência)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.solicitacaoCadastroMembro.findMany.mockResolvedValue([
        {
          id: 'sol-existente-1',
          telefone: '+5585991101771',
          status: 'PENDENTE',
        },
      ]);
      prisma.solicitacaoCadastroMembro.update.mockResolvedValue({
        id: 'sol-existente-1',
      });
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.submitRegistration(mockTenant.slug, {
        tipo: TipoSolicitacaoCadastro.VISITANTE,
        nome: 'Messias Jr Atualizado',
        telefone: '85 99110-1771',
        consentimentoLgpd: true,
        observacoes: 'Cheguei hoje na cidade',
      });

      expect(result.id).toBe('sol-existente-1');
      expect(prisma.solicitacaoCadastroMembro.update).toHaveBeenCalledWith({
        where: { id: 'sol-existente-1' },
        data: expect.objectContaining({
          nome: 'Messias Jr Atualizado',
          observacoes: 'Cheguei hoje na cidade',
        }),
      });
      expect(prisma.solicitacaoCadastroMembro.create).not.toHaveBeenCalled();
    });
  });
});
