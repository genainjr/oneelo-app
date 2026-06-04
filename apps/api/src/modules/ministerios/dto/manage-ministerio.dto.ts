import { IsString, IsEnum, IsOptional } from 'class-validator';
import { MinistryRole } from '@prisma/client';

export class AddMembroMinisterioDto {
  @IsString()
  membroId: string;

  @IsOptional()
  @IsEnum(MinistryRole)
  role?: MinistryRole;
}

export class UpdateMembroRoleDto {
  @IsEnum(MinistryRole)
  role: MinistryRole;
}
