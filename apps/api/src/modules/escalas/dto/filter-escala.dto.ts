import { IsString, IsOptional, IsEnum } from 'class-validator';
import { StatusEscala } from '@prisma/client';

export class FilterEscalaDto {
  @IsString()
  @IsOptional()
  ministerioId?: string;

  @IsEnum(StatusEscala)
  @IsOptional()
  status?: StatusEscala;

  @IsString()
  @IsOptional()
  mes?: string;

  @IsString()
  @IsOptional()
  ano?: string;

  @IsString()
  @IsOptional()
  membroId?: string;

  @IsString()
  @IsOptional()
  pendentesApenas?: string;
}
