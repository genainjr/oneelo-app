import { ConfigService } from '@nestjs/config';
import { CarteirinhaRendererService } from './carteirinha-renderer.service';
import { ChromiumRendererService, TenantLogoService } from '../../../common/export';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('CarteirinhaRendererService', () => {
  let service: CarteirinhaRendererService;
  let chromiumRendererMock: any;
  let tenantLogoMock: any;
  let prismaMock: any;
  let configServiceMock: any;

  beforeEach(() => {
    chromiumRendererMock = {
      runSerialRender: jest.fn(),
      waitForImages: jest.fn(),
    };

    tenantLogoMock = {
      resolveTenantLogoDataUri: jest.fn().mockResolvedValue('data:image/svg+xml;base64,tenantlogo'),
      getLookupLabsLogoDataUri: jest.fn().mockReturnValue('data:image/svg+xml;base64,lookuplogo'),
    };

    prismaMock = {
      client: {
        membro: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
      },
    };

    configServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'WEB_APP_URL') return 'https://app.oneelo.com.br';
        return null;
      }),
    };

    service = new CarteirinhaRendererService(
      prismaMock as unknown as PrismaService,
      chromiumRendererMock as unknown as ChromiumRendererService,
      tenantLogoMock as unknown as TenantLogoService,
      configServiceMock as unknown as ConfigService,
    );
  });

  const memberMock = {
    id: 'member-123',
    nome: 'Carlos Eduardo Santos',
    nomeExibicao: 'Carlos Santos',
    fotoUrl: 'https://storage.supabase.com/photos/carlos.jpg',
    matricula: 'ROL-00456',
    cargo: 'Presbítero',
    dataNascimento: new Date('1985-06-15T00:00:00Z'),
    dataBatismo: new Date('2002-11-20T00:00:00Z'),
    cpf: '12345678900',
    rg: '1234567-SSP',
    sexo: 'MASCULINO',
    estadoCivil: 'CASADO',
    status: 'ATIVO',
  };

  const tenantMock = {
    id: 'tenant-123',
    nome: 'Igreja Batista Central',
    logoUrl: 'https://storage.supabase.com/logos/central.png',
    slug: 'batista-central',
  };

  it('deve gerar data URI válido de QR Code contendo a URL de validação pública', async () => {
    const qrDataUri = await service.generateQrCodeDataUri(memberMock.id);
    expect(qrDataUri).toMatch(/^data:image\/png;base64,/);
  });

  it('deve renderizar HTML da frente e verso com todos os dados essenciais', async () => {
    const qrDataUri = 'data:image/png;base64,fakeqr';
    const { frontHtml, backHtml } = service.renderCardHtml(
      memberMock,
      tenantMock,
      'data:image/svg+xml;base64,logo',
      qrDataUri,
      2027,
    );

    // Validações da Frente
    expect(frontHtml).toContain('Carlos Santos');
    expect(frontHtml).toContain('Presbítero');
    expect(frontHtml).toContain('Igreja Batista Central');
    expect(frontHtml).toContain('ROL-00456');
    expect(frontHtml).toContain('CARTEIRA DE MEMBRO');

    // Validações do Verso
    expect(backHtml).toContain('Carlos Eduardo Santos');
    expect(backHtml).toContain('15/06/1985');
    expect(backHtml).toContain('20/11/2002');
    expect(backHtml).toContain('123.456.789-00');
    expect(backHtml).toContain('1234567-SSP');
    expect(backHtml).toContain('Masculino');
    expect(backHtml).toContain('CASADO');
    expect(backHtml).toContain('31/12/2027');
    expect(backHtml).toContain(qrDataUri);
  });

  it('deve chamar chromiumRenderer.runSerialRender para gerar cartão individual', async () => {
    chromiumRendererMock.runSerialRender.mockResolvedValue({
      buffer: Buffer.from('fake-pdf'),
      fileName: 'carteirinha-carlos-eduardo-santos.pdf',
      mimeType: 'application/pdf',
    });

    const result = await service.renderSingleCard(memberMock, tenantMock, 'PDF');

    expect(result.mimeType).toBe('application/pdf');
    expect(result.fileName).toContain('carlos-eduardo-santos');
    expect(chromiumRendererMock.runSerialRender).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'carteirinha_render_single',
        format: 'pdf',
      }),
      expect.any(Function),
    );
  });

  it('deve chamar chromiumRenderer.runSerialRender para gerar lote em grade A4', async () => {
    chromiumRendererMock.runSerialRender.mockResolvedValue({
      buffer: Buffer.from('fake-batch-pdf'),
      fileName: 'carteirinhas-lote-batista-central-2026-11-10.pdf',
      mimeType: 'application/pdf',
    });

    const result = await service.renderBatchCardsA4([memberMock], tenantMock);

    expect(result.mimeType).toBe('application/pdf');
    expect(result.fileName).toContain('carteirinhas-lote');
    expect(chromiumRendererMock.runSerialRender).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'carteirinha_render_batch',
        format: 'pdf',
      }),
      expect.any(Function),
    );
  });
});
