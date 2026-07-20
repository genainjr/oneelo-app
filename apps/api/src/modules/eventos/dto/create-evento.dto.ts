import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventoTipo, StatusEvento } from '@prisma/client';
import { EventoMinisterioInputDto } from './evento-ministerio-input.dto';

export { StatusEvento };

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventoMinisterioInputDto)
  @IsOptional()
  ministerios?: EventoMinisterioInputDto[];

  @IsEnum(StatusEvento)
  @IsOptional()
  status?: StatusEvento;
}
