import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateMinisterioDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}
