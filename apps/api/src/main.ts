import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Necessario para detectar HTTPS corretamente atras de proxy/load balancer.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Prefixo global da API
  app.setGlobalPrefix('api');

  // Parser de cookies HTTP-only para extração do JWT
  app.use(cookieParser());

  // Pipe global de validação dos DTOs (class-validator)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // Remove campos não declarados no DTO
      forbidNonWhitelisted: true, // Rejeita request com campos fora do DTO (400)
      transform: true,        // Transforma tipos automaticamente (string → number etc.)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const configuredOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const localNetworkOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

  // CORS - permite o frontend acessar a API com cookies em cross-domain.
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (configuredOrigins.includes(origin) || (isDevelopment && localNetworkOriginPattern.test(origin))) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Configuração do Swagger
  const config = new DocumentBuilder()
    .setTitle('Church Management API')
    .setDescription('API para gerenciamento de membros, ministérios, escalas e eventos.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`🚀 Church Management API rodando em: http://localhost:${port}/api`);
  console.log(`📖 Documentação Swagger disponível em: http://localhost:${port}/api/docs`);
}

bootstrap();
