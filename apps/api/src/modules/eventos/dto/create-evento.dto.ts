import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';

export enum StatusEvento {
  AGENDADO = 'AGENDADO',
  REALIZADO = 'REALIZADO',
  CANCELADO = 'CANCELADO',
}

export class CreateEventoDto {
  @IsString()
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

  @IsEnum(StatusEvento)
  @IsOptional()
  status?: StatusEvento;
}
