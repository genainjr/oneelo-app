import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateMinisterioDto {
  @IsString()
  nome: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  funcoes?: string[];
}
