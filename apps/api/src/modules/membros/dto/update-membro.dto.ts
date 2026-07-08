import { IsString, IsEmail, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { StatusMembro } from '@prisma/client';

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
  observacoes?: string;
}
