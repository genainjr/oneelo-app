import { IsEnum, IsOptional, IsString } from 'class-validator';
import { StatusEscala } from '@prisma/client';

export class FilterEscalaVisualizacaoDto {
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
  pendentesApenas?: string;
}
