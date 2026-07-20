import {
  IsArray,
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventoTipo } from '@prisma/client';
import { StatusEvento } from './create-evento.dto';
import { EventoMinisterioInputDto } from './evento-ministerio-input.dto';

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventoMinisterioInputDto)
  @IsOptional()
  ministerios?: EventoMinisterioInputDto[];

  @IsEnum(StatusEvento)
  @IsOptional()
  status?: StatusEvento;
}
