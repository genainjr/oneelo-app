import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório.' })
  nome: string;

  @IsString()
  @IsOptional()
  corHex?: string;
}
