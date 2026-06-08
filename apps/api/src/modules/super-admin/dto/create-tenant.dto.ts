import { IsEmail, IsEnum, IsOptional, IsString, MinLength, Matches } from 'class-validator';
import { Plano } from '@prisma/client';

export class CreateTenantDto {
  @IsString()
  nome: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug deve conter apenas letras minúsculas, números e hífens.' })
  slug: string;

  @IsOptional()
  @IsEnum(Plano)
  plano?: Plano;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  idioma?: string;

  @IsString()
  adminNome: string;

  @IsEmail()
  adminEmail: string;

  @IsString()
  @MinLength(6)
  adminSenha: string;
}
