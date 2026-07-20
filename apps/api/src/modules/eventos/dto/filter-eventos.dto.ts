import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { EventoTipo, StatusEvento } from '@prisma/client';

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

  @IsEnum(StatusEvento)
  @IsOptional()
  status?: StatusEvento;

  @IsEnum(EventoTipo)
  @IsOptional()
  tipo?: EventoTipo;

  @IsUUID('4')
  @IsOptional()
  ministerioId?: string;
}
