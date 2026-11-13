import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  Validate,
} from 'class-validator';
import { Plano } from '@prisma/client';
import { NotReservedSlugConstraint } from '../../../common/constants/reserved-slugs';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug deve conter apenas letras minúsculas, números e hífens.',
  })
  @Validate(NotReservedSlugConstraint)
  slug?: string;

  @IsOptional()
  @IsEnum(Plano)
  plano?: Plano;

  @IsOptional()
  @IsInt()
  @Min(1)
  limiteMembros?: number;

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
