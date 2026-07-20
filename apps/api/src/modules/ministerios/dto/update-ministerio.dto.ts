import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';

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

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  funcoes?: string[];

  @IsBoolean()
  @IsOptional()
  usaEscalas?: boolean;
}
