import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SolicitacoesCadastroService } from './solicitacoes-cadastro.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthService } from '../auth/auth.service';
import {
  DnsStatus,
  Role,
  StatusMembro,
  TipoSolicitacaoCadastro,
} from '@prisma/client';
import { checkMemberDuplicity } from './member-deduplication.helper';

describe('SolicitacoesCadastroService (Public)', () => {
  let service: SolicitacoesCadastroService;
  let prisma: any;
  let notificationsService: any;

  const mockTenant = {
    id: 'tenant-123',
    nome: 'Igreja Vida Nova',
    slug: 'igreja-vida-nova',
    logoUrl: 'https://cdn.oneelo.com/logos/tenant-123.png',
    pwaIconUrl: 'https://cdn.oneelo.com/pwa/tenant-123.png',
    ativo: true,
    websiteConfig: null as { customDomain: string | null; dnsStatus: DnsStatus } | null,
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
        pwaIconUrl: mockTenant.pwaIconUrl,
        customDomain: null,
      });
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: 'igreja-vida-nova' },
        select: expect.any(Object),
      });
    });

    it('deve usar pwaIconUrl como fallback de logoUrl quando logoUrl for nulo', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        ...mockTenant,
        logoUrl: null,
      });

      const result = await service.getPublicTenantInfo('igreja-vida-nova');

      expect(result).toEqual({
        nome: mockTenant.nome,
        slug: mockTenant.slug,
        logoUrl: mockTenant.pwaIconUrl,
        pwaIconUrl: mockTenant.pwaIconUrl,
        customDomain: null,
      });
    });

    it('deve retornar customDomain apenas quando dnsStatus estiver ACTIVE', async () => {
      prisma.tenant.findUnique.mockResolvedValueOnce({
        ...mockTenant,
        websiteConfig: {
          customDomain: 'www.igreja.org.br',
          dnsStatus: DnsStatus.ACTIVE,
        },
      });

      const activeResult = await service.getPublicTenantInfo('igreja-vida-nova');
      expect(activeResult.customDomain).toBe('www.igreja.org.br');

      prisma.tenant.findUnique.mockResolvedValueOnce({
        ...mockTenant,
        websiteConfig: {
          customDomain: 'www.pendente.org.br',
          dnsStatus: DnsStatus.PENDING,
        },
      });

      const pendingResult = await service.getPublicTenantInfo('igreja-vida-nova');
      expect(pendingResult.customDomain).toBeNull();
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

    it('deve atualizar ficha pendente existente quando mesmo telefone e mesmo nome normalizado submeterem novamente (idempotência)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.solicitacaoCadastroMembro.findMany.mockResolvedValue([
        {
          id: 'sol-existente-1',
          nome: 'Messias Júnior',
          telefone: '+5585991101771',
          cpf: null,
          status: 'PENDENTE',
        },
      ]);
      prisma.solicitacaoCadastroMembro.update.mockResolvedValue({
        id: 'sol-existente-1',
      });
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.submitRegistration(mockTenant.slug, {
        tipo: TipoSolicitacaoCadastro.VISITANTE,
        nome: 'messias junior',
        telefone: '85 99110-1771',
        consentimentoLgpd: true,
        observacoes: 'Cheguei hoje na cidade',
      });

      expect(result.id).toBe('sol-existente-1');
      expect(prisma.solicitacaoCadastroMembro.update).toHaveBeenCalledWith({
        where: { id: 'sol-existente-1' },
        data: expect.objectContaining({
          nome: 'messias junior',
          observacoes: 'Cheguei hoje na cidade',
        }),
      });
      expect(prisma.solicitacaoCadastroMembro.create).not.toHaveBeenCalled();
    });

    it('deve criar nova ficha separada quando familiar/dependente enviar mesmo telefone com nome diferente', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.solicitacaoCadastroMembro.findMany.mockResolvedValue([
        {
          id: 'sol-pai-1',
          nome: 'Messias Júnior',
          telefone: '+5585991101771',
          cpf: null,
          status: 'PENDENTE',
        },
      ]);
      prisma.solicitacaoCadastroMembro.create.mockResolvedValue({
        id: 'sol-filha-1',
      });
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.submitRegistration(mockTenant.slug, {
        tipo: TipoSolicitacaoCadastro.VISITANTE,
        nome: 'Isabella Lis',
        telefone: '85 99110-1771',
        isDependente: true,
        responsavelNome: 'Messias Júnior',
        observacoes: 'Primeira visita',
        consentimentoLgpd: true,
      });

      expect(result.id).toBe('sol-filha-1');
      expect(prisma.solicitacaoCadastroMembro.update).not.toHaveBeenCalled();
      expect(prisma.solicitacaoCadastroMembro.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nome: 'Isabella Lis',
          telefone: '+5585991101771',
          observacoes: '[Dependente — Responsável: Messias Júnior]\nPrimeira visita',
        }),
      });
    });

    it('deve exigir nome do responsável quando isDependente for true', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);

      await expect(
        service.submitRegistration(mockTenant.slug, {
          tipo: TipoSolicitacaoCadastro.VISITANTE,
          nome: 'Isabella Lis',
          telefone: '85 99110-1771',
          isDependente: true,
          responsavelNome: '   ',
          consentimentoLgpd: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkMemberDuplicity com ex-membros e desempate familiar', () => {
    it('detecta ex-membro INATIVO ou TRANSFERIDO para revisão e reativação na triagem', async () => {
      const mockPrisma = {
        membro: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'm-inativo-1',
              nome: 'Carlos Antigo Membro',
              whatsapp: '+5585991109999',
              email: 'carlos@antigo.com',
              cpf: null,
              status: StatusMembro.INATIVO,
              user: null,
            },
          ]),
        },
        solicitacaoCadastroMembro: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };

      const res = await checkMemberDuplicity(mockPrisma as never, 'tenant-1', {
        telefone: '85991109999',
        nome: 'Carlos Antigo Membro',
      });

      expect(mockPrisma.membro.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', deletedAt: null },
        }),
      );
      expect(res.isDuplicate).toBe(true);
      expect(res.membroExistenteId).toBe('m-inativo-1');
      expect(res.membroExistenteStatus).toBe(StatusMembro.INATIVO);
    });

    it('prioriza ex-membro INATIVO pelo nome exato mesmo quando esposa ATIVO compartilha o mesmo WhatsApp', async () => {
      const preloadedContext = {
        membros: [
          {
            id: 'm-esposa-ativa',
            nome: 'Maria Souza',
            whatsapp: '+5585991101771',
            email: 'maria@familia.com',
            cpf: null,
            status: StatusMembro.ATIVO,
            user: null,
          },
          {
            id: 'm-marido-inativo',
            nome: 'João Souza',
            whatsapp: '+5585991101771',
            email: 'joao@familia.com',
            cpf: null,
            status: StatusMembro.INATIVO,
            user: null,
          },
        ],
        pendingRequests: [],
      };

      const returnHusband = await checkMemberDuplicity(
        prisma,
        'tenant-1',
        { telefone: '85991101771', nome: 'Joao Souza' },
        preloadedContext,
      );
      expect(returnHusband.membroExistenteId).toBe('m-marido-inativo');
      expect(returnHusband.membroExistenteStatus).toBe(StatusMembro.INATIVO);

      const newChild = await checkMemberDuplicity(
        prisma,
        'tenant-1',
        { telefone: '85991101771', nome: 'Lucas Souza' },
        preloadedContext,
      );
      expect(newChild.membroExistenteId).toBe('m-esposa-ativa');
      expect(newChild.membroExistenteStatus).toBe(StatusMembro.ATIVO);
    });
  });
});
