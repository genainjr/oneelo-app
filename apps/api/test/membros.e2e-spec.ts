import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

describe('MembrosController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Variáveis para guardar dados do tenant principal (seed)
  let adminCookie: string[];
  let membroCookie: string[];
  let mainTenantId: string;

  // Variáveis para o segundo tenant (teste de isolamento)
  let tenantBId: string;
  let userBId: string;
  let userBCookie: string[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);

    // 1. Obter cookies do admin e do membro (usando seed existente)
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@igreja.com', senha: 'admin123' });
    adminCookie = adminLogin.headers['set-cookie'];
    mainTenantId = adminLogin.body.user.tenantId;

    const membroLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'membro@igreja.com', senha: 'membro123' });
    membroCookie = membroLogin.headers['set-cookie'];

    // LIMPEZA PREVENTIVA: deletar qualquer resquício do tenant B de execuções anteriores
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: 'segunda-igreja-teste' },
    });
    if (existingTenant) {
      const id = existingTenant.id;
      await prisma.membroTag.deleteMany({ where: { membro: { tenantId: id } } });
      await prisma.ministerioMembro.deleteMany({ where: { membro: { tenantId: id } } });
      await prisma.escalaItem.deleteMany({ where: { membro: { tenantId: id } } });
      await prisma.membro.deleteMany({ where: { tenantId: id } });
      await prisma.auditLog.deleteMany({ where: { tenantId: id } });
      await prisma.user.deleteMany({ where: { tenantId: id } });
      await prisma.tenant.delete({ where: { id } });
    }

    // 2. Criar segundo tenant para testes de isolamento
    const tenantB = await prisma.tenant.create({
      data: {
        nome: 'Segunda Igreja Teste',
        slug: 'segunda-igreja-teste',
        limiteMembros: 10,
      },
    });
    tenantBId = tenantB.id;

    // Criar um usuário para o segundo tenant
    const senhaHash = await bcrypt.hash('password123', 10);
    const userB = await prisma.user.create({
      data: {
        tenantId: tenantBId,
        nome: 'Usuario Tenant B',
        email: 'userb@igreja.com',
        senhaHash,
        role: Role.ADMIN_GERAL,
      },
    });
    userBId = userB.id;

    const userBLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'userb@igreja.com', senha: 'password123' });
    userBCookie = userBLogin.headers['set-cookie'];
  });

  afterAll(async () => {
    // 1. Deletar as relações MembroTag criadas no teste
    await prisma.membroTag.deleteMany({
      where: {
        tag: { nome: { in: ['JovensTest', 'MusicosTest', 'BulkTagTest'] } }
      }
    });

    // 2. Deletar as tags de teste
    await prisma.tag.deleteMany({
      where: {
        nome: { in: ['JovensTest', 'MusicosTest', 'BulkTagTest'] }
      }
    });

    // 3. Deletar os membros criados no tenant principal durante os testes
    await prisma.membro.deleteMany({
      where: {
        tenantId: mainTenantId,
        nome: {
          in: [
            'Membro Exclusivo Tenant Principal',
            'Membro Para Deletar',
            'Membro A (Ambos)',
            'Membro B (Jovens)',
            'Membro Bulk 1',
            'Membro Bulk 2'
          ]
        }
      }
    });

    // 4. Limpar todo o Tenant B (deletando na ordem correta)
    if (tenantBId) {
      await prisma.membroTag.deleteMany({
        where: { membro: { tenantId: tenantBId } }
      });
      await prisma.tag.deleteMany({
        where: { tenantId: tenantBId }
      });
      await prisma.membro.deleteMany({
        where: { tenantId: tenantBId }
      });
      await prisma.auditLog.deleteMany({
        where: { tenantId: tenantBId }
      });
      await prisma.user.deleteMany({
        where: { tenantId: tenantBId }
      });
      await prisma.tenant.delete({
        where: { id: tenantBId }
      });
    }

    await app.close();
  });

  describe('RBAC - Permissões de Acesso', () => {
    it('deve bloquear acesso de CRUD para usuários com papel MEMBRO', async () => {
      // Tenta listar membros
      await request(app.getHttpServer())
        .get('/api/membros')
        .set('Cookie', membroCookie)
        .expect(403);

      // Tenta criar membro
      await request(app.getHttpServer())
        .post('/api/membros')
        .set('Cookie', membroCookie)
        .send({ nome: 'Membro Teste' })
        .expect(403);
    });

    it('deve permitir acesso para usuários ADMIN_GERAL', async () => {
      await request(app.getHttpServer())
        .get('/api/membros')
        .set('Cookie', adminCookie)
        .expect(200);
    });
  });

  describe('Isolamento de Tenant', () => {
    it('não deve permitir que o Tenant B veja ou gerencie dados do Tenant Principal', async () => {
      // 1. Criar membro no Tenant Principal (via admin)
      const resMembro = await request(app.getHttpServer())
        .post('/api/membros')
        .set('Cookie', adminCookie)
        .send({
          nome: 'Membro Exclusivo Tenant Principal',
          email: 'exclusivo@tenant1.com',
        })
        .expect(201);

      const membroId = resMembro.body.id;

      // 2. Tenant B tenta buscar esse membro pelo ID -> deve retornar 404
      await request(app.getHttpServer())
        .get(`/api/membros/${membroId}`)
        .set('Cookie', userBCookie)
        .expect(404);

      // 3. Tenant B lista seus membros -> não deve conter o membro do Tenant Principal
      const listRes = await request(app.getHttpServer())
        .get('/api/membros')
        .set('Cookie', userBCookie)
        .expect(200);

      const containsMembro = listRes.body.some((m: any) => m.id === membroId);
      expect(containsMembro).toBe(false);
    });
  });

  describe('Limite de Membros', () => {
    it('deve bloquear a criação ao atingir o limite do plano', async () => {
      // 1. Configurar limite do Tenant B para exatamente 1 membro ativo
      await prisma.tenant.update({
        where: { id: tenantBId },
        data: { limiteMembros: 1 },
      });

      // 2. Criar o primeiro membro com sucesso
      await request(app.getHttpServer())
        .post('/api/membros')
        .set('Cookie', userBCookie)
        .send({ nome: 'Primeiro Membro B' })
        .expect(201);

      // 3. Tentar criar o segundo membro -> deve retornar 403 Forbidden
      const res = await request(app.getHttpServer())
        .post('/api/membros')
        .set('Cookie', userBCookie)
        .send({ nome: 'Segundo Membro B' })
        .expect(403);

      expect(res.body.message).toContain('Limite de membros (1) atingido');
    });
  });

  describe('Soft Delete', () => {
    it('deve marcar membro como deletado sem excluí-lo fisicamente do banco', async () => {
      // 1. Criar membro no Tenant Principal
      const createRes = await request(app.getHttpServer())
        .post('/api/membros')
        .set('Cookie', adminCookie)
        .send({ nome: 'Membro Para Deletar' })
        .expect(201);

      const membroId = createRes.body.id;

      // 2. Remover membro (soft delete)
      await request(app.getHttpServer())
        .delete(`/api/membros/${membroId}`)
        .set('Cookie', adminCookie)
        .expect(200);

      // 3. Tentar buscar membro -> deve retornar 404 (graças à extensão Prisma)
      await request(app.getHttpServer())
        .get(`/api/membros/${membroId}`)
        .set('Cookie', adminCookie)
        .expect(404);

      // 4. Verificar no banco físico que o registro ainda existe e tem deletedAt preenchido
      const dbMembro = await prisma.membro.findUnique({
        where: { id: membroId },
      });
      expect(dbMembro).toBeDefined();
      expect(dbMembro?.deletedAt).not.toBeNull();
    });
  });

  describe('Auditoria', () => {
    it('deve gerar entradas de auditoria automáticas para criação, alteração e deleção', async () => {
      // Limpar logs antigos do Tenant B
      await prisma.auditLog.deleteMany({ where: { tenantId: tenantBId } });

      // Configurar limite alto temporariamente para o teste
      await prisma.tenant.update({
        where: { id: tenantBId },
        data: { limiteMembros: 10 },
      });

      // 1. Criar
      const createRes = await request(app.getHttpServer())
        .post('/api/membros')
        .set('Cookie', userBCookie)
        .send({ nome: 'Membro Auditoria' })
        .expect(201);

      const membroId = createRes.body.id;

      // 2. Atualizar
      await request(app.getHttpServer())
        .patch(`/api/membros/${membroId}`)
        .set('Cookie', userBCookie)
        .send({ nome: 'Membro Auditoria Alterado' })
        .expect(200);

      // 3. Deletar
      await request(app.getHttpServer())
        .delete(`/api/membros/${membroId}`)
        .set('Cookie', userBCookie)
        .expect(200);

      // 4. Validar logs
      const logs = await prisma.auditLog.findMany({
        where: { tenantId: tenantBId, entidade: 'membros' },
        orderBy: { createdAt: 'asc' },
      });

      expect(logs.length).toBe(3);
      expect(logs[0].acao).toBe('CRIAR');
      expect(logs[1].acao).toBe('ATUALIZAR');
      expect(logs[2].acao).toBe('DELETAR');
    });
  });

  describe('Busca Composta por Tags (AND / OR)', () => {
    let tagJovensId: string;
    let tagMusicosId: string;
    let membroAId: string;
    let membroBId: string;

    beforeAll(async () => {
      // 1. Criar tags de teste associadas ao Tenant Principal
      const tagJovens = await prisma.tag.create({
        data: { nome: 'JovensTest', corHex: '#123456', tenantId: mainTenantId },
      });
      tagJovensId = tagJovens.id;

      const tagMusicos = await prisma.tag.create({
        data: { nome: 'MusicosTest', corHex: '#654321', tenantId: mainTenantId },
      });
      tagMusicosId = tagMusicos.id;

      // 2. Criar Membro A (JovensTest + MusicosTest)
      const createARes = await request(app.getHttpServer())
        .post('/api/membros')
        .set('Cookie', adminCookie)
        .send({ nome: 'Membro A (Ambos)' });
      membroAId = createARes.body.id;

      // 3. Criar Membro B (Apenas JovensTest)
      const createBRes = await request(app.getHttpServer())
        .post('/api/membros')
        .set('Cookie', adminCookie)
        .send({ nome: 'Membro B (Jovens)' });
      membroBId = createBRes.body.id;

      // Associar tags
      await prisma.membroTag.createMany({
        data: [
          { membroId: membroAId, tagId: tagJovensId },
          { membroId: membroAId, tagId: tagMusicosId },
          { membroId: membroBId, tagId: tagJovensId },
        ],
      });
    });

    it('deve filtrar com operador OR (retorna membros que possuem pelo menos uma das tags)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/membros')
        .query({ tags: 'JovensTest,MusicosTest', operacao: 'OR' })
        .set('Cookie', adminCookie)
        .expect(200);

      const ids = res.body.map((m: any) => m.id);
      expect(ids).toContain(membroAId);
      expect(ids).toContain(membroBId);
    });

    it('deve filtrar com operador AND (retorna apenas membros que possuem todas as tags)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/membros')
        .query({ tags: 'JovensTest,MusicosTest', operacao: 'AND' })
        .set('Cookie', adminCookie)
        .expect(200);

      const ids = res.body.map((m: any) => m.id);
      expect(ids).toContain(membroAId);
      expect(ids).not.toContain(membroBId);
    });
  });

  describe('Ação em Lote (Bulk Tag)', () => {
    it('deve associar e remover tags de múltiplos membros em lote', async () => {
      // 1. Criar tag e membros
      const tagBulk = await prisma.tag.create({
        data: { nome: 'BulkTagTest', corHex: '#ff0000', tenantId: mainTenantId },
      });

      const m1 = await request(app.getHttpServer())
        .post('/api/membros')
        .set('Cookie', adminCookie)
        .send({ nome: 'Membro Bulk 1' });

      const m2 = await request(app.getHttpServer())
        .post('/api/membros')
        .set('Cookie', adminCookie)
        .send({ nome: 'Membro Bulk 2' });

      // 2. Associar tag em lote (ADD)
      await request(app.getHttpServer())
        .post('/api/membros/bulk-tag')
        .set('Cookie', adminCookie)
        .send({
          membrosIds: [m1.body.id, m2.body.id],
          tagsIds: [tagBulk.id],
          acao: 'ADD',
        })
        .expect(201);

      // Verificar no banco
      const tagsM1 = await prisma.membroTag.findMany({ where: { membroId: m1.body.id } });
      expect(tagsM1.length).toBe(1);
      expect(tagsM1[0].tagId).toBe(tagBulk.id);

      // 3. Remover tag em lote (REMOVE)
      await request(app.getHttpServer())
        .post('/api/membros/bulk-tag')
        .set('Cookie', adminCookie)
        .send({
          membrosIds: [m1.body.id, m2.body.id],
          tagsIds: [tagBulk.id],
          acao: 'REMOVE',
        })
        .expect(201);

      // Verificar no banco
      const tagsM1Pos = await prisma.membroTag.findMany({ where: { membroId: m1.body.id } });
      expect(tagsM1Pos.length).toBe(0);
    });
  });
});
