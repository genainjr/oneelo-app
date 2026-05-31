import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';
import { Role, StatusConfirmacao, StatusEscala } from '@prisma/client';

describe('EscalasController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Cookies para autenticação
  let adminCookie: string[];
  let pastorCookie: string[];
  let liderCookie: string[];
  let secretarioCookie: string[];
  let membroCookie: string[];
  let tenantBCookie: string[];

  // IDs persistentes
  let mainTenantId: string;
  let tenantBId: string;
  
  let ministerioLouvorId: string;
  let ministerioMidiaId: string;
  
  let membroTesteId: string;
  let membroLiderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);

    // 1. Fazer logins nos perfis do Seed Principal
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@igreja.com', senha: 'admin123' });
    adminCookie = adminLogin.headers['set-cookie'];
    mainTenantId = adminLogin.body.user.tenantId;

    const pastorLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'pastor@igreja.com', senha: 'pastor123' });
    pastorCookie = pastorLogin.headers['set-cookie'];

    const liderLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'lider@igreja.com', senha: 'lider123' });
    liderCookie = liderLogin.headers['set-cookie'];

    const secretarioLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'secretario@igreja.com', senha: 'secretario123' });
    secretarioCookie = secretarioLogin.headers['set-cookie'];

    const membroLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'membro@igreja.com', senha: 'membro123' });
    membroCookie = membroLogin.headers['set-cookie'];

    // Obter IDs dos ministérios do seed principal
    const Louvor = await prisma.ministerio.findFirst({
      where: { nome: 'Louvor', tenantId: mainTenantId },
    });
    ministerioLouvorId = Louvor!.id;

    const Midia = await prisma.ministerio.findFirst({
      where: { nome: 'Mídia', tenantId: mainTenantId },
    });
    ministerioMidiaId = Midia!.id;

    // Obter IDs dos membros associados aos usuários de teste
    // Membro de exemplo associado ao email do membroUser (membro@igreja.com)
    // No seed, não há um membro com email membro@igreja.com. Vamos criar um temporário para testes de confirmação.
    let membroTeste = await prisma.membro.findFirst({
      where: { email: 'membro@igreja.com', tenantId: mainTenantId },
    });
    if (!membroTeste) {
      membroTeste = await prisma.membro.create({
        data: {
          nome: 'Membro Teste Vinculado',
          email: 'membro@igreja.com',
          tenantId: mainTenantId,
        },
      });
    }
    membroTesteId = membroTeste.id;

    // 2. Criar segundo tenant para testes de isolamento
    const existingTenantB = await prisma.tenant.findUnique({
      where: { slug: 'escala-tenant-b' },
    });
    if (existingTenantB) {
      const id = existingTenantB.id;
      await prisma.escalaItem.deleteMany({ where: { escala: { tenantId: id } } });
      await prisma.escala.deleteMany({ where: { tenantId: id } });
      await prisma.ministerio.deleteMany({ where: { tenantId: id } });
      await prisma.auditLog.deleteMany({ where: { tenantId: id } });
      await prisma.user.deleteMany({ where: { tenantId: id } });
      await prisma.tenant.delete({ where: { id } });
    }

    const tenantB = await prisma.tenant.create({
      data: {
        nome: 'Tenant B Escalas',
        slug: 'escala-tenant-b',
      },
    });
    tenantBId = tenantB.id;

    const senhaHash = await bcrypt.hash('password123', 10);
    await prisma.user.create({
      data: {
        tenantId: tenantBId,
        nome: 'Usuario B',
        email: 'userb-escala@igreja.com',
        senhaHash,
        role: Role.ADMIN_GERAL,
      },
    });

    const tenantBLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'userb-escala@igreja.com', senha: 'password123' });
    tenantBCookie = tenantBLogin.headers['set-cookie'];
  });

  afterAll(async () => {
    // Limpeza de registros de escala criados nos testes
    await prisma.escalaItem.deleteMany({
      where: {
        escala: {
          titulo: { startsWith: 'TEST_' },
        },
      },
    });
    await prisma.escala.deleteMany({
      where: {
        titulo: { startsWith: 'TEST_' },
      },
    });
    await prisma.membro.deleteMany({
      where: {
        email: 'membro@igreja.com',
      },
    });

    // Limpar Tenant B
    if (tenantBId) {
      await prisma.escalaItem.deleteMany({ where: { escala: { tenantId: tenantBId } } });
      await prisma.escala.deleteMany({ where: { tenantId: tenantBId } });
      await prisma.ministerio.deleteMany({ where: { tenantId: tenantBId } });
      await prisma.auditLog.deleteMany({ where: { tenantId: tenantBId } });
      await prisma.user.deleteMany({ where: { tenantId: tenantBId } });
      await prisma.tenant.delete({ where: { id: tenantBId } });
    }

    await app.close();
  });

  describe('CRUD de Escalas', () => {
    let escalaId: string;

    it('deve permitir que o admin crie uma escala no ministério Louvor', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/escalas')
        .set('Cookie', adminCookie)
        .send({
          titulo: 'TEST_Escala de Domingo',
          data: new Date(Date.now() + 86400000 * 2).toISOString(), // Depois de amanhã
          ministerioId: ministerioLouvorId,
          observacoes: 'Passagem de som às 8h',
        })
        .expect(201);

      escalaId = response.body.id;
      expect(escalaId).toBeDefined();
      expect(response.body.titulo).toBe('TEST_Escala de Domingo');
      expect(response.body.status).toBe(StatusEscala.RASCUNHO);
    });

    it('deve permitir listar escalas', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/escalas')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('deve permitir atualizar os detalhes e status da escala', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/escalas/${escalaId}`)
        .set('Cookie', adminCookie)
        .send({
          titulo: 'TEST_Escala de Domingo Atualizada',
          status: StatusEscala.PUBLICADA,
        })
        .expect(200);

      expect(response.body.titulo).toBe('TEST_Escala de Domingo Atualizada');
      expect(response.body.status).toBe(StatusEscala.PUBLICADA);
    });

    it('deve permitir adicionar um membro à escala com função', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/escalas/${escalaId}/itens`)
        .set('Cookie', adminCookie)
        .send({
          membroId: membroTesteId,
          funcao: 'Baterista',
          observacoes: 'Trazer baquetas reservas',
        })
        .expect(201);

      expect(response.body.membroId).toBe(membroTesteId);
      expect(response.body.funcao).toBe('Baterista');
      expect(response.body.statusConfirmacao).toBe(StatusConfirmacao.PENDENTE);
    });

    it('deve permitir remover um membro da escala', async () => {
      await request(app.getHttpServer())
        .delete(`/api/escalas/${escalaId}/itens/${membroTesteId}`)
        .set('Cookie', adminCookie)
        .expect(200);

      // Verificar que foi deletado
      const escala = await request(app.getHttpServer())
        .get(`/api/escalas/${escalaId}`)
        .set('Cookie', adminCookie)
        .expect(200);

      const hasMembro = escala.body.itens.some((item: any) => item.membroId === membroTesteId);
      expect(hasMembro).toBe(false);
    });

    it('deve permitir deletar uma escala', async () => {
      await request(app.getHttpServer())
        .delete(`/api/escalas/${escalaId}`)
        .set('Cookie', adminCookie)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/escalas/${escalaId}`)
        .set('Cookie', adminCookie)
        .expect(404);
    });
  });

  describe('Segurança (RBAC) e Permissões', () => {
    let escalaId: string;

    beforeAll(async () => {
      // Criar escala de Louvor para teste
      const res = await request(app.getHttpServer())
        .post('/api/escalas')
        .set('Cookie', adminCookie)
        .send({
          titulo: 'TEST_Escala RBAC',
          data: new Date(Date.now() + 86400000).toISOString(),
          ministerioId: ministerioLouvorId,
        });
      escalaId = res.body.id;
    });

    it('deve permitir que o Líder do Louvor gerencie escalas de Louvor', async () => {
      // Adicionar item
      await request(app.getHttpServer())
        .post(`/api/escalas/${escalaId}/itens`)
        .set('Cookie', liderCookie)
        .send({
          membroId: membroTesteId,
          funcao: 'Vocal',
        })
        .expect(201);

      // Atualizar escala
      await request(app.getHttpServer())
        .patch(`/api/escalas/${escalaId}`)
        .set('Cookie', liderCookie)
        .send({ observacoes: 'Alteração pelo líder' })
        .expect(200);
    });

    it('deve proibir que o Líder do Louvor crie/edite escalas do ministério Mídia', async () => {
      // Criar escala de Mídia deve falhar
      await request(app.getHttpServer())
        .post('/api/escalas')
        .set('Cookie', liderCookie)
        .send({
          titulo: 'TEST_Escala Midia Invalida',
          data: new Date().toISOString(),
          ministerioId: ministerioMidiaId,
        })
        .expect(403);
    });

    it('deve proibir que o Secretário crie ou altere escalas', async () => {
      await request(app.getHttpServer())
        .post('/api/escalas')
        .set('Cookie', secretarioCookie)
        .send({
          titulo: 'TEST_Escala Secretario',
          data: new Date().toISOString(),
          ministerioId: ministerioLouvorId,
        })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/escalas/${escalaId}`)
        .set('Cookie', secretarioCookie)
        .send({ titulo: 'Alterado por secretário' })
        .expect(403);
    });

    it('deve permitir que o Secretário liste e visualize escalas', async () => {
      await request(app.getHttpServer())
        .get('/api/escalas')
        .set('Cookie', secretarioCookie)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/escalas/${escalaId}`)
        .set('Cookie', secretarioCookie)
        .expect(200);
    });

    it('deve proibir que o Membro visualize escalas em que não está escalado', async () => {
      // Criar escala rascunho sem o membro
      const res = await request(app.getHttpServer())
        .post('/api/escalas')
        .set('Cookie', adminCookie)
        .send({
          titulo: 'TEST_Escala Secreta',
          data: new Date().toISOString(),
          ministerioId: ministerioLouvorId,
        });

      const escalaSecretaId = res.body.id;

      // Membro tenta visualizar -> 403 Forbidden
      await request(app.getHttpServer())
        .get(`/api/escalas/${escalaSecretaId}`)
        .set('Cookie', membroCookie)
        .expect(403);

      // Limpar
      await prisma.escala.delete({ where: { id: escalaSecretaId } });
    });
  });

  describe('Isolamento de Tenant', () => {
    let escalaTenantAId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/escalas')
        .set('Cookie', adminCookie)
        .send({
          titulo: 'TEST_Escala Tenant A',
          data: new Date().toISOString(),
          ministerioId: ministerioLouvorId,
        });
      escalaTenantAId = res.body.id;
    });

    it('não deve permitir que usuário do Tenant B visualize ou edite escala do Tenant A', async () => {
      // Visualizar
      await request(app.getHttpServer())
        .get(`/api/escalas/${escalaTenantAId}`)
        .set('Cookie', tenantBCookie)
        .expect(404); // Retorna 404 porque a query valida "tenantId = B" e não encontra o ID do A

      // Editar
      await request(app.getHttpServer())
        .patch(`/api/escalas/${escalaTenantAId}`)
        .set('Cookie', tenantBCookie)
        .send({ titulo: 'Ataque de Tenant' })
        .expect(404);
    });
  });

  describe('Confirmação de Presença', () => {
    let escalaId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/escalas')
        .set('Cookie', adminCookie)
        .send({
          titulo: 'TEST_Escala Confirmacoes',
          data: new Date().toISOString(),
          ministerioId: ministerioLouvorId,
        });
      escalaId = res.body.id;

      // Adicionar o membroTeste
      await request(app.getHttpServer())
        .post(`/api/escalas/${escalaId}/itens`)
        .set('Cookie', adminCookie)
        .send({
          membroId: membroTesteId,
          funcao: 'Baixista',
        });
    });

    it('deve permitir que o próprio Membro confirme sua presença', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/escalas/${escalaId}/confirmar`)
        .set('Cookie', membroCookie)
        .send({
          statusConfirmacao: StatusConfirmacao.CONFIRMADO,
          observacoes: 'Estarei presente com certeza!',
        })
        .expect(200);

      expect(response.body.statusConfirmacao).toBe(StatusConfirmacao.CONFIRMADO);
      expect(response.body.observacoes).toBe('Estarei presente com certeza!');
    });

    it('deve permitir que o próprio Membro recuse a presença com justificativa', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/escalas/${escalaId}/confirmar`)
        .set('Cookie', membroCookie)
        .send({
          statusConfirmacao: StatusConfirmacao.RECUSADO,
          observacoes: 'Vou viajar este final de semana.',
        })
        .expect(200);

      expect(response.body.statusConfirmacao).toBe(StatusConfirmacao.RECUSADO);
      expect(response.body.observacoes).toBe('Vou viajar este final de semana.');
    });

    it('deve permitir que o Líder ou Admin mude o status de confirmação diretamente', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/escalas/${escalaId}/itens/${membroTesteId}/status`)
        .set('Cookie', liderCookie)
        .send({
          statusConfirmacao: StatusConfirmacao.CONFIRMADO,
          observacoes: 'Líder confirmou manualmente pelo telefone',
        })
        .expect(200);

      expect(response.body.statusConfirmacao).toBe(StatusConfirmacao.CONFIRMADO);
      expect(response.body.observacoes).toBe('Líder confirmou manualmente pelo telefone');
    });
  });

  describe('Filtros e Consultas Especiais', () => {
    let escala1Id: string;
    let escala2Id: string;

    beforeAll(async () => {
      // Criar Escala 1 (Hoje - Pendente)
      const res1 = await request(app.getHttpServer())
        .post('/api/escalas')
        .set('Cookie', adminCookie)
        .send({
          titulo: 'TEST_Escala Hoje',
          data: new Date(Date.now() + 3600000).toISOString(), // +1 hora
          ministerioId: ministerioLouvorId,
        });
      escala1Id = res1.body.id;

      await request(app.getHttpServer())
        .post(`/api/escalas/${escala1Id}/itens`)
        .set('Cookie', adminCookie)
        .send({ membroId: membroTesteId, funcao: 'Guitarra' });

      // Criar Escala 2 (Daqui a 10 dias - Confirmada)
      const res2 = await request(app.getHttpServer())
        .post('/api/escalas')
        .set('Cookie', adminCookie)
        .send({
          titulo: 'TEST_Escala Futura Confirmada',
          data: new Date(Date.now() + 86400000 * 10).toISOString(),
          ministerioId: ministerioLouvorId,
        });
      escala2Id = res2.body.id;

      await request(app.getHttpServer())
        .post(`/api/escalas/${escala2Id}/itens`)
        .set('Cookie', adminCookie)
        .send({ membroId: membroTesteId, funcao: 'Guitarra' });

      // Confirmar a escala 2
      await request(app.getHttpServer())
        .patch(`/api/escalas/${escala2Id}/itens/${membroTesteId}/status`)
        .set('Cookie', adminCookie)
        .send({ statusConfirmacao: StatusConfirmacao.CONFIRMADO });
    });

    it('deve filtrar escalas com pendências futuras de confirmação', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/escalas')
        .query({ pendentesApenas: 'true' })
        .set('Cookie', adminCookie)
        .expect(200);

      const ids = response.body.map((e: any) => e.id);
      expect(ids).toContain(escala1Id);
      expect(ids).not.toContain(escala2Id); // Escala 2 já está CONFIRMADO, não deve aparecer em pendentes
    });

    it('deve listar histórico de escalas de um membro específico', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/escalas')
        .query({ membroId: membroTesteId })
        .set('Cookie', adminCookie)
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(2);
      const ids = response.body.map((e: any) => e.id);
      expect(ids).toContain(escala1Id);
      expect(ids).toContain(escala2Id);
    });
  });
});
