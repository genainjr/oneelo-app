import { IsString, IsNotEmpty, IsInt, IsOptional, Min } from 'class-validator';

export class CreateSegmentoDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  ordem?: number;
}
