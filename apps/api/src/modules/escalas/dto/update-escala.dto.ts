import { IsString, IsOptional, IsEnum } from 'class-validator';
import { StatusEscala } from '@prisma/client';

export class UpdateEscalaDto {
  @IsEnum(StatusEscala)
  @IsOptional()
  status?: StatusEscala;

  @IsString()
  @IsOptional()
  observacoes?: string;
}
