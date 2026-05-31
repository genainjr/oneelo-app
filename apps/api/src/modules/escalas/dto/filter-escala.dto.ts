import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { StatusEscala } from '@prisma/client';

export class FilterEscalaDto {
  @IsString()
  @IsOptional()
  ministerioId?: string;

  @IsEnum(StatusEscala)
  @IsOptional()
  status?: StatusEscala;

  @IsDateString()
  @IsOptional()
  dataInicio?: string;

  @IsDateString()
  @IsOptional()
  dataFim?: string;

  @IsString()
  @IsOptional()
  membroId?: string;

  @IsString()
  @IsOptional()
  pendentesApenas?: string; // Como vem via query, receberemos como string 'true' / 'false'
}
