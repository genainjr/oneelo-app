import { IsString, IsOptional, IsArray, IsNotEmpty } from 'class-validator';

export class CreateMinisterioDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório.' })
  nome: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  funcoes?: string[];
}
