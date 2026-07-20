import { IsString, IsEnum, IsOptional, IsArray, IsBoolean } from 'class-validator';
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

  @IsOptional()
  @IsBoolean()
  podeSerEscalado?: boolean;
}

export class UpdateMembroRoleDto {
  @IsOptional()
  @IsEnum(MinistryRole)
  role?: MinistryRole;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  funcaoIds?: string[];

  @IsOptional()
  @IsBoolean()
  podeSerEscalado?: boolean;
}
