import { IsDateString, IsOptional, IsString, IsUUID, IsEnum } from 'class-validator';
import { EventoTipo } from '@prisma/client';

export class FilterEventosDto {
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
