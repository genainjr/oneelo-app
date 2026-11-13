import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AcaoAuditoria, DnsStatus, ModalidadeCulto, Plano } from '@prisma/client';
import type { Multer } from 'multer';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import { VercelDomainsService } from './vercel-domains.service';
import { WebsiteService } from './website.service';

describe('WebsiteService', () => {
  let service: WebsiteService;

  const mockPrisma = {
    tenant: {
      findUnique: jest.fn(),
    },
    tenantWebsiteConfig: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    churchSchedule: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tenantNews: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockStorageService = {
    uploadPublicObject: jest.fn(),
    deleteObject: jest.fn(),
  };

  const mockVercelDomainsService = {
    getDnsTargets: jest.fn().mockReturnValue({
      cnameTarget: 'cname.vercel-dns.com',
      apexIp: '76.76.21.21',
      vercelConfigured: true,
    }),
    registerDomain: jest.fn(),
    verifyDomain: jest.fn(),
    removeDomain: jest.fn(),
  };

  const tenantFixture = {
    id: 'tenant-1',
    nome: 'Igreja Esperança',
    slug: 'igreja-esperanca',
    plano: Plano.PROFISSIONAL,
    logoUrl: 'https://cdn.example.com/logo.png',
    pwaIconUrl: 'https://cdn.example.com/pwa.png',
    email: 'contato@igrejaesperanca.org',
    telefone: '11999998888',
    ativo: true,
  };

  const pngFile = (originalname = 'banner.png'): Multer.File =>
    ({
      originalname,
      mimetype: 'image/png',
      size: 16,
      buffer: Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
      ]),
    }) as Multer.File;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebsiteService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SupabaseStorageService, useValue: mockStorageService },
        { provide: VercelDomainsService, useValue: mockVercelDomainsService },
      ],
    }).compile();

    service = module.get<WebsiteService>(WebsiteService);
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    mockStorageService.deleteObject.mockResolvedValue(undefined);
  });

  describe('getPublicSiteData', () => {
    it('retorna dados públicos da igreja ativa normalizando o slug', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(tenantFixture);
      mockPrisma.tenantWebsiteConfig.findUnique.mockResolvedValue({
        id: 'cfg-1',
        tenantId: 'tenant-1',
        bannerKey: 'tenants/tenant-1/website/banner.png',
        pastoresFotoKey: null,
        customDomain: 'igreja.org',
        dnsStatus: 'NAO_CONFIGURADO',
        tituloHero: 'Bem-vindo',
        subtituloHero: 'Uma igreja para toda família',
        bannerUrl: 'https://cdn.example.com/banner.png',
        versiculoTema: 'Salmos 23:1',
        versiculoReferencia: 'Salmos 23:1',
        sobreNos: 'Nossa missão é servir.',
        historia: null,
        visaoValores: null,
        pastoresNomes: 'Pr. João e Pra. Maria',
        pastoresBio: null,
        pastoresFotoUrl: null,
        endereco: 'Rua Central',
        numero: '100',
        bairro: 'Centro',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01000-000',
        googleMapsUrl: 'https://maps.google.com/?q=igreja',
        horarioSecretaria: 'Seg-Sex 9h-18h',
        instagramUrl: 'https://instagram.com/igreja',
        youtubeUrl: null,
        facebookUrl: null,
        spotifyUrl: null,
        whatsappAtendimento: '11999998888',
      });
      mockPrisma.churchSchedule.findMany.mockResolvedValue([
        {
          id: 'sch-1',
          diaSemana: 0,
          horario: '18:00',
          titulo: 'Culto da Família',
        },
      ]);
      mockPrisma.tenantNews.findMany.mockResolvedValue([
        { id: 'news-1', titulo: 'Conferência', slug: 'conferencia' },
      ]);

      const result = await service.getPublicSiteData(' Igreja-Esperanca ');

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'igreja-esperanca' } }),
      );
      expect(result.tenant).toEqual({
        nome: 'Igreja Esperança',
        slug: 'igreja-esperanca',
        logoUrl: 'https://cdn.example.com/logo.png',
        pwaIconUrl: 'https://cdn.example.com/pwa.png',
        email: 'contato@igrejaesperanca.org',
        telefone: '11999998888',
      });
      expect(result.config).toEqual(
        expect.objectContaining({
          tituloHero: 'Bem-vindo',
          bannerUrl: 'https://cdn.example.com/banner.png',
        }),
      );
      expect(result.config).not.toHaveProperty('bannerKey');
      expect(result.schedules).toHaveLength(1);
      expect(result.news).toHaveLength(1);
    });

    it('lança NotFoundException para slug reservado sem consultar banco', async () => {
      await expect(service.getPublicSiteData('login')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
    });

    it('lança NotFoundException para tenant inexistente ou inativo', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValueOnce(null);
      await expect(service.getPublicSiteData('inexistente')).rejects.toThrow(
        NotFoundException,
      );

      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        ...tenantFixture,
        ativo: false,
      });
      await expect(
        service.getPublicSiteData('igreja-esperanca'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPublicNewsBySlug', () => {
    it('retorna informativo ativo do tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(tenantFixture);
      mockPrisma.tenantNews.findFirst.mockResolvedValue({
        id: 'news-1',
        titulo: 'Vigília',
        slug: 'vigilia',
        conteudo: 'Texto completo',
      });

      const result = await service.getPublicNewsBySlug(
        'igreja-esperanca',
        'VIGILIA',
      );

      expect(mockPrisma.tenantNews.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', slug: 'vigilia', ativo: true },
      });
      expect(result.news.slug).toBe('vigilia');
    });

    it('lança NotFoundException quando informativo não existe', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(tenantFixture);
      mockPrisma.tenantNews.findFirst.mockResolvedValue(null);

      await expect(
        service.getPublicNewsBySlug('igreja-esperanca', 'nao-existe'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateConfig', () => {
    it('rejeita URLs com protocolo inseguro (javascript:)', async () => {
      await expect(
        service.updateConfig(
          'tenant-1',
          { instagramUrl: 'javascript:alert(1)' },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.tenantWebsiteConfig.upsert).not.toHaveBeenCalled();
    });

    it('rejeita tags HTML nos textos institucionais', async () => {
      await expect(
        service.updateConfig(
          'tenant-1',
          { sobreNos: '<script>alert(1)</script>' },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.tenantWebsiteConfig.upsert).not.toHaveBeenCalled();
    });

    it('faz upsert da configuração e grava auditoria quando válida', async () => {
      mockPrisma.tenantWebsiteConfig.upsert.mockResolvedValue({
        id: 'cfg-1',
        tenantId: 'tenant-1',
        tituloHero: 'Novo título',
      });

      const result = await service.updateConfig(
        'tenant-1',
        {
          tituloHero: 'Novo título',
          sobreNos: 'Texto limpo sobre a igreja.',
          instagramUrl: 'https://instagram.com/igreja',
        },
        'user-1',
        '127.0.0.1',
      );

      expect(result.tituloHero).toBe('Novo título');
      expect(mockPrisma.tenantWebsiteConfig.upsert).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          entidade: 'TenantWebsiteConfig',
          acao: AcaoAuditoria.ATUALIZAR,
        }) as unknown,
      });
    });
  });

  describe('config media upload/remove', () => {
    it('envia novo banner, atualiza config e remove objeto antigo', async () => {
      mockPrisma.tenantWebsiteConfig.findUnique.mockResolvedValue({
        id: 'cfg-1',
        bannerKey: 'tenants/tenant-1/website/old-banner.png',
        pastoresFotoKey: null,
      });
      mockStorageService.uploadPublicObject.mockResolvedValue(
        'https://cdn.example.com/new-banner.png',
      );
      mockPrisma.tenantWebsiteConfig.upsert.mockResolvedValue({
        id: 'cfg-1',
        bannerUrl: 'https://cdn.example.com/new-banner.png',
      });

      const result = await service.uploadConfigMedia(
        'tenant-1',
        'banner',
        pngFile('hero.png'),
        'user-1',
      );

      expect(result.bannerUrl).toBe('https://cdn.example.com/new-banner.png');
      expect(mockStorageService.uploadPublicObject).toHaveBeenCalledWith(
        'tenant-logos',
        expect.stringMatching(/^tenants\/tenant-1\/website\/banner-/),
        expect.any(Buffer),
        'image/png',
      );
      expect(mockStorageService.deleteObject).toHaveBeenCalledWith(
        'tenant-logos',
        'tenants/tenant-1/website/old-banner.png',
      );
    });

    it('remove foto dos pastores limpando colunas e storage', async () => {
      mockPrisma.tenantWebsiteConfig.findUnique.mockResolvedValue({
        id: 'cfg-1',
        tenantId: 'tenant-1',
        bannerKey: null,
        pastoresFotoKey: 'tenants/tenant-1/website/pastors-old.png',
      });
      mockPrisma.tenantWebsiteConfig.update.mockResolvedValue({
        id: 'cfg-1',
        pastoresFotoUrl: null,
        pastoresFotoKey: null,
      });

      const result = await service.removeConfigMedia(
        'tenant-1',
        'pastors',
        'user-1',
      );

      expect(result.pastoresFotoUrl).toBeNull();
      expect(mockStorageService.deleteObject).toHaveBeenCalledWith(
        'tenant-logos',
        'tenants/tenant-1/website/pastors-old.png',
      );
    });
  });

  describe('ChurchSchedule CRUD and reorder', () => {
    it('cria horário calculando próxima ordem quando omitida', async () => {
      mockPrisma.churchSchedule.findFirst.mockResolvedValue({ ordem: 2 });
      mockPrisma.churchSchedule.create.mockResolvedValue({
        id: 'sch-3',
        tenantId: 'tenant-1',
        diaSemana: 0,
        horario: '19:00',
        titulo: 'Culto Noturno',
        modalidade: ModalidadeCulto.HIBRIDO,
        ordem: 3,
      });

      const created = await service.createSchedule(
        'tenant-1',
        {
          diaSemana: 0,
          horario: ' 19:00 ',
          titulo: ' Culto Noturno ',
          modalidade: ModalidadeCulto.HIBRIDO,
        },
        'user-1',
      );

      expect(created.ordem).toBe(3);
      expect(mockPrisma.churchSchedule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          horario: '19:00',
          titulo: 'Culto Noturno',
          ordem: 3,
        }) as unknown,
      });
    });

    it('lança NotFoundException ao atualizar horário de outro tenant', async () => {
      mockPrisma.churchSchedule.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSchedule(
          'tenant-1',
          'sch-other',
          { titulo: 'X' },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('reordena horários pertencentes ao tenant em transação', async () => {
      mockPrisma.churchSchedule.findMany
        .mockResolvedValueOnce([{ id: 'sch-2' }, { id: 'sch-1' }])
        .mockResolvedValueOnce([
          { id: 'sch-2', ordem: 0 },
          { id: 'sch-1', ordem: 1 },
        ]);
      mockPrisma.churchSchedule.update.mockResolvedValue({});
      mockPrisma.$transaction.mockResolvedValue([]);

      const reordered = await service.reorderSchedules(
        'tenant-1',
        { orderedIds: ['sch-2', 'sch-1'] },
        'user-1',
      );

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(reordered[0].id).toBe('sch-2');
    });
  });

  describe('TenantNews CRUD and media', () => {
    it('gera slug único com sufixo numérico em caso de colisão', async () => {
      mockPrisma.tenantNews.findMany.mockResolvedValue([
        { slug: 'encontro-de-casais' },
        { slug: 'encontro-de-casais-2' },
      ]);
      mockPrisma.tenantNews.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'news-3', ...data }),
      );

      const created = await service.createNews(
        'tenant-1',
        {
          titulo: 'Encontro de Casais',
          resumo: 'Resumo do encontro',
          conteudo: 'Conteúdo completo sem HTML.',
        },
        'user-1',
      );

      expect(created.slug).toBe('encontro-de-casais-3');
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entidade: 'TenantNews',
          acao: AcaoAuditoria.CRIAR,
        }) as unknown,
      });
    });

    it('rejeita HTML bruto ao criar informativo', async () => {
      await expect(
        service.createNews(
          'tenant-1',
          {
            titulo: 'Aviso',
            conteudo: '<img src=x onerror=alert(1)>',
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.tenantNews.create).not.toHaveBeenCalled();
    });

    it('faz upload de imagem do informativo e apaga imagem anterior', async () => {
      mockPrisma.tenantNews.findFirst.mockResolvedValue({
        id: 'news-1',
        tenantId: 'tenant-1',
        imagemKey: 'tenants/tenant-1/website/news/news-1/old.png',
      });
      mockStorageService.uploadPublicObject.mockResolvedValue(
        'https://cdn.example.com/news-new.png',
      );
      mockPrisma.tenantNews.update.mockResolvedValue({
        id: 'news-1',
        imagemUrl: 'https://cdn.example.com/news-new.png',
      });

      const updated = await service.uploadNewsImage(
        'tenant-1',
        'news-1',
        pngFile('capa.png'),
        'user-1',
      );

      expect(updated.imagemUrl).toBe('https://cdn.example.com/news-new.png');
      expect(mockStorageService.deleteObject).toHaveBeenCalledWith(
        'tenant-logos',
        'tenants/tenant-1/website/news/news-1/old.png',
      );
    });

    it('deleta informativo e remove imagem do storage', async () => {
      mockPrisma.tenantNews.findFirst.mockResolvedValue({
        id: 'news-1',
        tenantId: 'tenant-1',
        titulo: 'Aviso',
        imagemKey: 'tenants/tenant-1/website/news/news-1/capa.png',
      });
      mockPrisma.tenantNews.delete.mockResolvedValue({});

      const result = await service.deleteNews('tenant-1', 'news-1', 'user-1');

      expect(result).toEqual({ deleted: true, id: 'news-1' });
      expect(mockStorageService.deleteObject).toHaveBeenCalledWith(
        'tenant-logos',
        'tenants/tenant-1/website/news/news-1/capa.png',
      );
    });
  });

  describe('Domínio próprio customizado', () => {
    it('resolvePublicDomain retorna apenas { slug } quando tenant ativo e dnsStatus === ACTIVE', async () => {
      mockPrisma.tenantWebsiteConfig.findFirst.mockResolvedValue({
        tenant: { slug: 'igreja-esperanca' },
      });

      const resolved = await service.resolvePublicDomain(
        'www.IgrejaEsperanca.org.br.',
      );

      expect(resolved).toEqual({ slug: 'igreja-esperanca' });
      expect(mockPrisma.tenantWebsiteConfig.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            customDomain: 'www.igrejaesperanca.org.br',
            dnsStatus: DnsStatus.ACTIVE,
            tenant: { ativo: true },
          },
        }),
      );
    });

    it('resolvePublicDomain lança NotFoundException quando domínio não está ativo', async () => {
      mockPrisma.tenantWebsiteConfig.findFirst.mockResolvedValue(null);

      await expect(
        service.resolvePublicDomain('desconhecido.org'),
      ).rejects.toThrow(NotFoundException);
    });

    it('setCustomDomain bloqueia planos inferiores ao PROFISSIONAL', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        plano: Plano.BASICO,
      });

      await expect(
        service.setCustomDomain(
          'tenant-1',
          'www.igrejaesperanca.org.br',
          'user-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('setCustomDomain rejeita domínio já utilizado por outra igreja', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        plano: Plano.PROFISSIONAL,
      });
      mockPrisma.tenantWebsiteConfig.findFirst.mockResolvedValue({
        id: 'other-cfg',
      });

      await expect(
        service.setCustomDomain(
          'tenant-1',
          'www.igrejaesperanca.org.br',
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('setCustomDomain registra domínio novo na Vercel e grava dnsStatus PENDING com auditoria', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        plano: Plano.PROFISSIONAL,
      });
      mockPrisma.tenantWebsiteConfig.findFirst.mockResolvedValue(null);
      mockPrisma.tenantWebsiteConfig.findUnique.mockResolvedValue(null);
      mockVercelDomainsService.registerDomain.mockResolvedValue({
        verified: false,
        verificationChallenges: [
          { type: 'TXT', domain: '_vercel.igreja.org', value: 'vc-domain-verify=123' },
        ],
      });
      mockPrisma.tenantWebsiteConfig.upsert.mockResolvedValue({
        id: 'cfg-1',
        customDomain: 'www.igrejaesperanca.org.br',
        dnsStatus: DnsStatus.PENDING,
        dnsCheckedAt: new Date('2026-11-13T16:00:00Z'),
        customDomainVerifiedAt: null,
      });

      const result = await service.setCustomDomain(
        'tenant-1',
        'www.igrejaesperanca.org.br',
        'user-1',
        '127.0.0.1',
      );

      expect(mockVercelDomainsService.registerDomain).toHaveBeenCalledWith(
        'www.igrejaesperanca.org.br',
      );
      expect(result.dnsStatus).toBe(DnsStatus.PENDING);
      expect(result.verificationChallenges).toHaveLength(1);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            acao: AcaoAuditoria.ATUALIZAR,
            entidade: 'TenantWebsiteConfig',
          }),
        }),
      );
    });

    it('verifyCustomDomain promove dnsStatus para ACTIVE quando verificação Vercel + DNS aprova', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        plano: Plano.PROFISSIONAL,
      });
      mockPrisma.tenantWebsiteConfig.findUnique.mockResolvedValue({
        id: 'cfg-1',
        customDomain: 'www.igrejaesperanca.org.br',
        dnsStatus: DnsStatus.PENDING,
        customDomainVerifiedAt: null,
      });
      mockVercelDomainsService.verifyDomain.mockResolvedValue({
        dnsStatus: DnsStatus.ACTIVE,
        verified: true,
        dnsMatched: true,
        vercelVerified: true,
        isApex: false,
        recordType: 'CNAME',
        observedRecords: ['cname.vercel-dns.com'],
        verificationChallenges: [],
        details: 'Domínio verificado e ativo com SSL provisionado.',
      });
      mockPrisma.tenantWebsiteConfig.update.mockResolvedValue({
        id: 'cfg-1',
        customDomain: 'www.igrejaesperanca.org.br',
        dnsStatus: DnsStatus.ACTIVE,
        dnsCheckedAt: new Date('2026-11-13T16:10:00Z'),
        customDomainVerifiedAt: new Date('2026-11-13T16:10:00Z'),
      });

      const result = await service.verifyCustomDomain('tenant-1', 'user-1');

      expect(result.dnsStatus).toBe(DnsStatus.ACTIVE);
      expect(result.verified).toBe(true);
    });

    it('removeCustomDomain limpa registro no banco e remove da Vercel com auditoria', async () => {
      mockPrisma.tenantWebsiteConfig.findUnique.mockResolvedValue({
        id: 'cfg-1',
        customDomain: 'www.igrejaesperanca.org.br',
      });
      mockVercelDomainsService.removeDomain.mockResolvedValue(undefined);
      mockPrisma.tenantWebsiteConfig.update.mockResolvedValue({});

      const result = await service.removeCustomDomain('tenant-1', 'user-1');

      expect(mockVercelDomainsService.removeDomain).toHaveBeenCalledWith(
        'www.igrejaesperanca.org.br',
      );
      expect(result).toEqual({
        customDomain: null,
        dnsStatus: DnsStatus.PENDING,
        removed: true,
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            acao: AcaoAuditoria.DELETAR,
          }),
        }),
      );
    });
  });
});
