import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinancialCategoryType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateFinancialCategoryDto {
  @ApiProperty({ description: 'Nome da categoria financeira.' })
  @IsString()
  name: string;

  @ApiProperty({ enum: FinancialCategoryType })
  @IsEnum(FinancialCategoryType, { message: 'Tipo de categoria financeira inválido.' })
  type: FinancialCategoryType;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
