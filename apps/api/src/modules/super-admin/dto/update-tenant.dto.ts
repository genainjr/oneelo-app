import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { Plano } from '@prisma/client';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsEnum(Plano)
  plano?: Plano;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  idioma?: string;
}
