import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SexoMembro, EstadoCivil } from '@prisma/client';

export type StatusLinhaImportacao = 'VALIDO' | 'DUPLICADO' | 'ERRO';
export type EstrategiaDuplicidade = 'SKIP' | 'UPDATE';

export class ImportMemberRowData {
  @IsNotEmpty({ message: 'Número da linha é obrigatório.' })
  linha: number;

  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório.' })
  nome: string;

  @IsString()
  @IsOptional()
  nomeExibicao?: string;

  @IsString()
  @IsOptional()
  whatsapp?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  dataNascimento?: string;

  @IsEnum(SexoMembro)
  @IsOptional()
  sexo?: SexoMembro;

  @IsEnum(EstadoCivil)
  @IsOptional()
  estadoCivil?: EstadoCivil;

  @IsString()
  @IsOptional()
  cargo?: string;

  @IsString()
  @IsOptional()
  dataBatismo?: string;

  @IsString()
  @IsOptional()
  cpf?: string;

  @IsString()
  @IsOptional()
  rg?: string;

  @IsString()
  @IsOptional()
  matricula?: string;

  @IsString()
  @IsOptional()
  observacoes?: string;

  @IsString()
  @IsOptional()
  statusLinha?: StatusLinhaImportacao;

  @IsArray()
  @IsOptional()
  erros?: string[];

  @IsArray()
  @IsOptional()
  avisos?: string[];

  @IsString()
  @IsOptional()
  membroExistenteId?: string;
}

export class ImportPreviewLimitePlanoDto {
  limite: number | null;
  totalAtivos: number;
  disponiveis: number | null;
  excedeuLimite: boolean;
}

export class ImportPreviewResponseDto {
  totalLinhas: number;
  validosCount: number;
  duplicadosCount: number;
  errosCount: number;
  limitePlano: ImportPreviewLimitePlanoDto;
  linhas: ImportMemberRowData[];
}

export class ConfirmImportDto {
  @IsEnum(['SKIP', 'UPDATE'])
  estrategiaDuplicados: EstrategiaDuplicidade;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportMemberRowData)
  membros: ImportMemberRowData[];
}

export class ConfirmImportResultDto {
  totalProcessados: number;
  inseridos: number;
  atualizados: number;
  pulados: number;
}
