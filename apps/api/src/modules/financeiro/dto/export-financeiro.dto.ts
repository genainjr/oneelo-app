import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import {
  FinancialTransactionStatus,
  FinancialTransactionType,
} from '@prisma/client';

function normalizeOptionalString({ value }: { value: unknown }): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalFilterEnum({ value }: { value: unknown }): string | undefined {
  const normalized = normalizeOptionalString({ value });
  if (!normalized || normalized.toLowerCase() === 'all') {
    return undefined;
  }
  return normalized;
}

export class ExportFinanceiroDto {
  @IsOptional()
  _t?: string;

  @Transform(({ value }) => {
    const normalized = normalizeOptionalString({ value });
    return normalized ? normalized.toLowerCase() : 'pdf';
  })
  @IsOptional()
  @IsIn(['pdf'])
  formato: 'pdf' = 'pdf';

  @Transform(normalizeOptionalString)
  @IsOptional()
  @IsString()
  startDate?: string;

  @Transform(normalizeOptionalString)
  @IsOptional()
  @IsString()
  endDate?: string;

  @Transform(normalizeOptionalFilterEnum)
  @IsOptional()
  @IsEnum(FinancialTransactionStatus)
  status?: FinancialTransactionStatus;

  @Transform(normalizeOptionalFilterEnum)
  @IsOptional()
  @IsEnum(FinancialTransactionType)
  type?: FinancialTransactionType;

  @Transform(normalizeOptionalString)
  @IsOptional()
  @IsString()
  accountId?: string;

  @Transform(normalizeOptionalString)
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Transform(normalizeOptionalString)
  @IsOptional()
  @IsString()
  eventoId?: string;

  @Transform(normalizeOptionalString)
  @IsOptional()
  @IsString()
  memberId?: string;

  @Transform(normalizeOptionalString)
  @IsOptional()
  @IsString()
  recurringGroupId?: string;

  @Transform(normalizeOptionalString)
  @IsOptional()
  @IsString()
  description?: string;
}
