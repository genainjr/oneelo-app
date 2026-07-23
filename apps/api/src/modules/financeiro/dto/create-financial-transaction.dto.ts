import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinancialPaymentMethod, FinancialTransactionStatus, FinancialTransactionType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateFinancialTransactionDto {
  @ApiProperty({ enum: FinancialTransactionType })
  @IsEnum(FinancialTransactionType, { message: 'Tipo de lançamento financeiro inválido.' })
  type: FinancialTransactionType;

  @ApiPropertyOptional({ enum: FinancialTransactionStatus, default: FinancialTransactionStatus.CONFIRMED })
  @IsEnum(FinancialTransactionStatus, { message: 'Status de lançamento financeiro inválido.' })
  @IsOptional()
  status?: FinancialTransactionStatus;

  @ApiProperty({ description: 'Data do lançamento em ISO.' })
  @IsDateString({}, { message: 'Data do lançamento inválida.' })
  date: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor inválido.' })
  @Min(0.01, { message: 'Valor deve ser maior que zero.' })
  amount: number;

  @ApiProperty()
  @IsString()
  accountId: string;

  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  eventoId?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  memberId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: FinancialPaymentMethod })
  @IsEnum(FinancialPaymentMethod, { message: 'Forma de pagamento inválida.' })
  @IsOptional()
  paymentMethod?: FinancialPaymentMethod | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  counterpartyName?: string;
}
