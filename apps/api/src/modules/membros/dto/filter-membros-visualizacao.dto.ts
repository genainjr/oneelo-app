import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MinistryRole, StatusMembro } from '@prisma/client';

export class FilterMembrosVisualizacaoDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsEnum(StatusMembro)
  @IsOptional()
  status?: StatusMembro;

  @IsString()
  @IsOptional()
  whatsapp?: string;

  @IsString()
  @IsOptional()
  tags?: string;

  @IsEnum(['AND', 'OR'])
  @IsOptional()
  operacao?: 'AND' | 'OR';

  @IsString()
  @IsOptional()
  ministerioId?: string;

  @IsEnum(MinistryRole)
  @IsOptional()
  ministerioRole?: MinistryRole;

  @IsString()
  @IsOptional()
  aniversarioMes?: string;

  @IsString()
  @IsOptional()
  semTelefone?: string;
}
