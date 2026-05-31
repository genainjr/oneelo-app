import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefixo global da API
  app.setGlobalPrefix('api');

  // Parser de cookies HTTP-only para extração do JWT
  app.use(cookieParser());

  // Pipe global de validação dos DTOs (class-validator)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // Remove campos não declarados no DTO
      forbidNonWhitelisted: false,
      transform: true,        // Transforma tipos automaticamente (string → number etc.)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS — permite o frontend Next.js acessar a API com cookies
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3001',
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`🚀 Church Management API rodando em: http://localhost:${port}/api`);
}

bootstrap();
