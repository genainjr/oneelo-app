import {
  IsArray,
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { EventoTipo } from '@prisma/client';
import { StatusEvento } from './create-evento.dto';

export class UpdateEventoDto {
  @IsString()
  @IsOptional()
  titulo?: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsDateString()
  @IsOptional()
  dataInicio?: string;

  @IsDateString()
  @IsOptional()
  dataFim?: string;

  @IsString()
  @IsOptional()
  local?: string;

  @IsEnum(EventoTipo)
  @IsOptional()
  tipo?: EventoTipo;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  ministerioIds?: string[];

  @IsEnum(StatusEvento)
  @IsOptional()
  status?: StatusEvento;
}
