import { IsString, IsEnum, IsOptional, IsArray } from 'class-validator';
import { MinistryRole } from '@prisma/client';

export class AddMembroMinisterioDto {
  @IsString()
  membroId: string;

  @IsOptional()
  @IsEnum(MinistryRole)
  role?: MinistryRole;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  funcaoIds?: string[];
}

export class UpdateMembroRoleDto {
  @IsOptional()
  @IsEnum(MinistryRole)
  role?: MinistryRole;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  funcaoIds?: string[];
}
