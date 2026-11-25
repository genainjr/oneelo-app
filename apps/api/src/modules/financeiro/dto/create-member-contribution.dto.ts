import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMemberContributionDto {
  @ApiProperty({ description: 'ID da categoria de entrada visível para membros.' })
  @IsString({ message: 'Selecione uma categoria válida.' })
  categoryId: string;

  @ApiProperty({ description: 'Valor da contribuição em reais.' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor inválido.' })
  @Min(0.01, { message: 'Valor deve ser maior que zero.' })
  @Max(9999999.99, { message: 'Valor acima do limite permitido.' })
  amount: number;

  @ApiProperty({ description: 'Data da transferência PIX em formato ISO ou YYYY-MM-DD.' })
  @IsDateString({}, { message: 'Data da contribuição inválida.' })
  date: string;

  @ApiPropertyOptional({
    description: 'Nome do titular no comprovante bancário quando diferente do membro (ex: cônjuge).',
    maxLength: 120,
  })
  @IsString()
  @MaxLength(120, { message: 'Nome do titular deve ter no máximo 120 caracteres.' })
  @IsOptional()
  payerName?: string;

  @ApiPropertyOptional({
    description: 'Observação opcional enviada pelo membro.',
    maxLength: 300,
  })
  @IsString()
  @MaxLength(300, { message: 'Observação deve ter no máximo 300 caracteres.' })
  @IsOptional()
  description?: string;
}
