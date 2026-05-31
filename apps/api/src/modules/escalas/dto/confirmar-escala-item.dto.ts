import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { StatusConfirmacao } from '@prisma/client';

export class ConfirmarEscalaItemDto {
  @IsEnum(StatusConfirmacao)
  @IsNotEmpty()
  statusConfirmacao: StatusConfirmacao;

  @IsString()
  @IsOptional()
  observacoes?: string;
}
