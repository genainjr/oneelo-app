import { IsString, IsEmail, IsOptional, IsEnum, IsDateString, IsNotEmpty } from 'class-validator';
import { StatusMembro } from '@prisma/client';

export class CreateMembroDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório.' })
  nome: string;

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
