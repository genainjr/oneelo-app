import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinancialAccountType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateFinancialAccountDto {
  @ApiProperty({ description: 'Nome da conta ou caixa financeiro.' })
  @IsString()
  name: string;

  @ApiProperty({ enum: FinancialAccountType })
  @IsEnum(FinancialAccountType, { message: 'Tipo de conta financeira inválido.' })
  type: FinancialAccountType;

  @ApiPropertyOptional({ description: 'Saldo inicial da conta.', default: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Saldo inicial inválido.' })
  @Min(0, { message: 'Saldo inicial não pode ser negativo.' })
  @IsOptional()
  initialBalance?: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
