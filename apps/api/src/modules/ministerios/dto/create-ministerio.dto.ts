import { IsString, IsOptional } from 'class-validator';

export class CreateMinisterioDto {
  @IsString()
  nome: string;

  @IsString()
  @IsOptional()
  descricao?: string;
}
