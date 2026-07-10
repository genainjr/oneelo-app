import { IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { EventoTipo } from '@prisma/client';

export class FilterEventosDto {
  @IsIn(['PUBLIC', 'MANAGE'])
  @IsOptional()
  scope?: 'PUBLIC' | 'MANAGE';

  @IsDateString()
  @IsOptional()
  dataInicio?: string;

  @IsDateString()
  @IsOptional()
  dataFim?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsEnum(EventoTipo)
  @IsOptional()
  tipo?: EventoTipo;

  @IsUUID('4')
  @IsOptional()
  ministerioId?: string;
}
