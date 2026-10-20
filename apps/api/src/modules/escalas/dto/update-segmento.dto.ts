import { IsString, IsNotEmpty, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateSegmentoDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  nome?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  ordem?: number;
}
