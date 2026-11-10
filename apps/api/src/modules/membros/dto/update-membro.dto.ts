import { IsString, IsEmail, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { StatusMembro, SexoMembro, EstadoCivil } from '@prisma/client';

export class UpdateMembroDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  whatsapp?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  nomeExibicao?: string;

  @IsDateString()
  @IsOptional()
  dataNascimento?: string;

  @IsEnum(StatusMembro)
  @IsOptional()
  status?: StatusMembro;

  @IsString()
  @IsOptional()
  matricula?: string;

  @IsString()
  @IsOptional()
  cargo?: string;

  @IsDateString()
  @IsOptional()
  dataBatismo?: string;

  @IsString()
  @IsOptional()
  cpf?: string;

  @IsString()
  @IsOptional()
  rg?: string;

  @IsEnum(SexoMembro)
  @IsOptional()
  sexo?: SexoMembro;

  @IsEnum(EstadoCivil)
  @IsOptional()
  estadoCivil?: EstadoCivil;

  @IsString()
  @IsOptional()
  observacoes?: string;
}
