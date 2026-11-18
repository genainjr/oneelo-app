import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FinancialPaymentMethod,
  FinancialTransactionStatus,
  FinancialTransactionType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { FinancialTransactionOccurrenceDto } from './financial-transaction-occurrence.dto';

export class CreateFinancialTransactionsBatchDto {
  @ApiProperty({ enum: FinancialTransactionType })
  @IsEnum(FinancialTransactionType, { message: 'Tipo de lançamento financeiro inválido.' })
  type: FinancialTransactionType;

  @ApiPropertyOptional({
    enum: FinancialTransactionStatus,
    default: FinancialTransactionStatus.PENDING,
  })
  @IsEnum(FinancialTransactionStatus, { message: 'Status de lançamento financeiro inválido.' })
  @IsOptional()
  defaultStatus?: FinancialTransactionStatus;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Conta financeira é obrigatória.' })
  accountId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Categoria financeira é obrigatória.' })
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

  @ApiProperty({ type: [FinancialTransactionOccurrenceDto] })
  @IsArray({ message: 'Lista de ocorrências inválida.' })
  @ArrayMinSize(1, { message: 'Informe pelo menos uma ocorrência.' })
  @ArrayMaxSize(120, { message: 'O lote pode conter no máximo 120 ocorrências.' })
  @ValidateNested({ each: true })
  @Type(() => FinancialTransactionOccurrenceDto)
  occurrences: FinancialTransactionOccurrenceDto[];
}
