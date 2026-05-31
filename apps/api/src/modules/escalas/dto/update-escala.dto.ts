import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { StatusEscala } from '@prisma/client';

export class UpdateEscalaDto {
  @IsString()
  @IsOptional()
  titulo?: string;

  @IsDateString()
  @IsOptional()
  data?: string;

  @IsEnum(StatusEscala)
  @IsOptional()
  status?: StatusEscala;

  @IsString()
  @IsOptional()
  observacoes?: string;
}
