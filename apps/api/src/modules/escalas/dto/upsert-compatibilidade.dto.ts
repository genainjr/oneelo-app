import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { RegraCompatibilidade } from '@prisma/client';

export class UpsertCompatibilidadeDto {
  @IsString()
  @IsNotEmpty()
  funcaoAId: string;

  @IsString()
  @IsNotEmpty()
  funcaoBId: string;

  @IsEnum(RegraCompatibilidade)
  @IsOptional()
  regra?: RegraCompatibilidade | null;

  @IsString()
  @IsOptional()
  observacao?: string | null;
}
