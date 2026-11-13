import { IsEmail, IsEnum, IsInt, IsOptional, IsString, MinLength, Matches, Min, Validate } from 'class-validator';
import { NotReservedSlugConstraint } from '../../../common/constants/reserved-slugs';
import { Plano } from '@prisma/client';

export class CreateTenantDto {
  @IsString()
  nome: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug deve conter apenas letras minúsculas, números e hífens.' })
  @Validate(NotReservedSlugConstraint)
  slug: string;

  @IsOptional()
  @IsEnum(Plano)
  plano?: Plano;

  @IsOptional()
  @IsInt()
  @Min(1)
  limiteMembros?: number;

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
