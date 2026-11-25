import { ApiPropertyOptional } from '@nestjs/swagger';
import { FinancialPaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ConfirmFinancialTransactionDto {
  @ApiPropertyOptional({ description: 'Data efetiva de pagamento ou recebimento em ISO.' })
  @IsDateString({}, { message: 'Data de liquidação inválida.' })
  @IsOptional()
  paidAt?: string;

  @ApiPropertyOptional({ enum: FinancialPaymentMethod })
  @IsEnum(FinancialPaymentMethod, { message: 'Forma de pagamento inválida.' })
  @IsOptional()
  paymentMethod?: FinancialPaymentMethod | null;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor inválido.' })
  @Min(0.01, { message: 'Valor deve ser maior que zero.' })
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ description: 'Ajuste opcional da conta financeira na conferência.' })
  @IsString()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Ajuste opcional da categoria financeira na conferência.' })
  @IsString()
  @IsOptional()
  categoryId?: string;
}
