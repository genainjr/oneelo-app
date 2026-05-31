import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
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

  @IsEnum(StatusEvento)
  @IsOptional()
  status?: StatusEvento;
}
