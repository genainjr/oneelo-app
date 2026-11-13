import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { MembrosModule } from './membros.module';
import { MembrosService } from './membros.service';
import { MemberImportService } from './import/member-import.service';
import { SolicitacoesCadastroService } from './solicitacoes-cadastro.service';

describe('MembrosModule routing priority', () => {
  let app: INestApplication;
  const mockSolicitacoesService = {
    listSolicitacoes: jest.fn().mockResolvedValue([{ id: 'req-1', nome: 'Maria' }]),
    countPendentes: jest.fn().mockResolvedValue({ total: 2 }),
    aprovarSolicitacao: jest.fn(),
    rejeitarSolicitacao: jest.fn(),
    getPublicTenantInfo: jest.fn(),
    submitRegistration: jest.fn(),
  };
  const mockMembrosService = {
    findOne: jest.fn().mockResolvedValue({ id: 'member-1' }),
  };

  beforeAll(async () => {
    const controllers: any[] = Reflect.getMetadata('controllers', MembrosModule) ?? [];
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }])],
      controllers,
      providers: [
        { provide: SolicitacoesCadastroService, useValue: mockSolicitacoesService },
        { provide: MembrosService, useValue: mockMembrosService },
        { provide: MemberImportService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.use((req: any, _res: any, next: () => void) => {
      req.tenantId = 'tenant-1';
      req.user = { sub: 'user-1', role: 'ADMIN', tenantId: 'tenant-1' };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve rotear GET /membros/solicitacoes para SolicitacoesCadastroController e nao para MembrosController :id', async () => {
    const res = await request(app.getHttpServer())
      .get('/membros/solicitacoes?status=PENDENTE')
      .expect(200);

    expect(res.body).toEqual([{ id: 'req-1', nome: 'Maria' }]);
    expect(mockSolicitacoesService.listSolicitacoes).toHaveBeenCalledWith(
      'tenant-1',
      'PENDENTE',
    );
    expect(mockMembrosService.findOne).not.toHaveBeenCalled();
  });

  it('deve continuar roteando GET /membros/:id para MembrosController', async () => {
    await request(app.getHttpServer()).get('/membros/uuid-qualquer').expect(200);
    expect(mockMembrosService.findOne).toHaveBeenCalledWith('tenant-1', 'uuid-qualquer');
  });

  it('deve aceitar POST /membros/solicitacoes/:id/aprovar com body vazio e com vincularMembroId no ValidationPipe', async () => {
    mockSolicitacoesService.aprovarSolicitacao.mockResolvedValue({ ok: true });

    await request(app.getHttpServer())
      .post('/membros/solicitacoes/sol-1/aprovar')
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post('/membros/solicitacoes/sol-1/aprovar')
      .send({ vincularMembroId: 'membro-1' })
      .expect(201);

    expect(mockSolicitacoesService.aprovarSolicitacao).toHaveBeenCalledTimes(2);
    expect(mockSolicitacoesService.aprovarSolicitacao).toHaveBeenLastCalledWith(
      'tenant-1',
      'sol-1',
      'user-1',
      expect.objectContaining({ vincularMembroId: 'membro-1' }),
      expect.any(String),
    );
  });

  it('deve aceitar POST /membros/solicitacoes/:id/rejeitar com body vazio e com motivo no ValidationPipe', async () => {
    mockSolicitacoesService.rejeitarSolicitacao.mockResolvedValue({ ok: true });

    await request(app.getHttpServer())
      .post('/membros/solicitacoes/sol-2/rejeitar')
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post('/membros/solicitacoes/sol-2/rejeitar')
      .send({ motivo: 'Cadastro duplicado' })
      .expect(201);

    expect(mockSolicitacoesService.rejeitarSolicitacao).toHaveBeenCalledTimes(2);
    expect(mockSolicitacoesService.rejeitarSolicitacao).toHaveBeenLastCalledWith(
      'tenant-1',
      'sol-2',
      'user-1',
      'Cadastro duplicado',
      expect.any(String),
    );
  });
});
