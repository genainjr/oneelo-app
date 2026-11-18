import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinancialTransactionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class FinancialTransactionOccurrenceDto {
  @ApiProperty({ description: 'Data prevista ou de vencimento da ocorrência em ISO.' })
  @IsDateString({}, { message: 'Data da ocorrência inválida.' })
  date: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor inválido.' })
  @Min(0.01, { message: 'Valor deve ser maior que zero.' })
  amount: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: FinancialTransactionStatus })
  @IsEnum(FinancialTransactionStatus, { message: 'Status de lançamento financeiro inválido.' })
  @IsOptional()
  status?: FinancialTransactionStatus;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt({ message: 'Número da parcela inválido.' })
  @Min(1, { message: 'Número da parcela deve ser maior que zero.' })
  @IsOptional()
  installmentNumber?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt({ message: 'Total de parcelas inválido.' })
  @Min(1, { message: 'Total de parcelas deve ser maior que zero.' })
  @IsOptional()
  totalInstallments?: number;
}
