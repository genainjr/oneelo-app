import { IsString, IsOptional, IsEnum } from 'class-validator';

export class FilterMembrosDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  whatsapp?: string;

  @IsString()
  @IsOptional()
  tags?: string;

  @IsEnum(['AND', 'OR'])
  @IsOptional()
  operacao?: 'AND' | 'OR';
}
