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

  @ApiPropertyOptional({
    default: false,
    description: 'Indica se a categoria de entrada aparece para membros em Dízimos e Ofertas.',
  })
  @IsBoolean()
  @IsOptional()
  visibleToMembers?: boolean;
}
