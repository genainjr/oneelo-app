import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { EventoTipo, StatusEvento } from '@prisma/client';
import { EventoMinisterioInputDto } from './evento-ministerio-input.dto';
import { EventoOcorrenciaInputDto } from './evento-ocorrencia-input.dto';

export class CreateEventosEmLoteDto {
  @IsString()
  @IsNotEmpty({ message: 'Título é obrigatório.' })
  titulo: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsString()
  @IsOptional()
  local?: string;

  @IsEnum(EventoTipo)
  @IsOptional()
  tipo?: EventoTipo;

  @IsEnum(StatusEvento)
  @IsOptional()
  status?: StatusEvento;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventoMinisterioInputDto)
  @IsOptional()
  ministerios?: EventoMinisterioInputDto[];

  @IsArray()
  @ArrayMinSize(1, { message: 'Informe pelo menos uma ocorrência.' })
  @ArrayMaxSize(200, { message: 'O lote pode conter no máximo 200 ocorrências.' })
  @ValidateNested({ each: true })
  @Type(() => EventoOcorrenciaInputDto)
  ocorrencias: EventoOcorrenciaInputDto[];
}
