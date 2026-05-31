import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import cookieParser from 'cookie-parser';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/login', () => {
    it('deve logar com credenciais válidas e retornar cookie de acesso', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'admin@igreja.com',
          senha: 'admin123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Login realizado com sucesso.');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', 'admin@igreja.com');
      expect(response.body.user).toHaveProperty('role', 'ADMIN_GERAL');

      // Verifica se o cookie access_token foi definido
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const hasAccessToken = cookies.some((cookie: string) => cookie.startsWith('access_token='));
      expect(hasAccessToken).toBe(true);
    });

    it('deve rejeitar login com senha incorreta', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'admin@igreja.com',
          senha: 'senha-errada',
        })
        .expect(401);
    });

    it('deve rejeitar login com email não existente', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'invalido@igreja.com',
          senha: 'password',
        })
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('deve retornar 401 Unauthorized se não estiver logado', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);
    });

    it('deve retornar dados do usuário atual se estiver logado', async () => {
      // 1. Fazer login para pegar o cookie
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'pastor@igreja.com',
          senha: 'pastor123',
        });

      const cookie = loginResponse.headers['set-cookie'];

      // 2. Chamar o endpoint /me com o cookie
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(response.body).toHaveProperty('email', 'pastor@igreja.com');
      expect(response.body).toHaveProperty('role', 'PASTOR');
      expect(response.body).toHaveProperty('tenant');
      expect(response.body.tenant).toHaveProperty('nome');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('deve limpar o cookie de acesso ao fazer logout', async () => {
      // 1. Fazer login
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'secretario@igreja.com',
          senha: 'secretario123',
        });

      const cookie = loginResponse.headers['set-cookie'];

      // 2. Fazer logout
      const logoutResponse = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .expect(200);

      expect(logoutResponse.body).toHaveProperty('message', 'Logout realizado com sucesso.');

      // Verifica se o cookie access_token foi limpo
      const cookies = logoutResponse.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const isCleared = cookies.some((cookie: string) => cookie.includes('access_token=;'));
      expect(isCleared).toBe(true);
    });
  });
});
