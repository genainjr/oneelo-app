import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { EventoTipo } from '@prisma/client';

export enum StatusEvento {
  AGENDADO = 'AGENDADO',
  REALIZADO = 'REALIZADO',
  CANCELADO = 'CANCELADO',
}

export class CreateEventoDto {
  @IsString()
  @IsNotEmpty({ message: 'Título é obrigatório.' })
  titulo: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsDateString()
  dataInicio: string;

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
