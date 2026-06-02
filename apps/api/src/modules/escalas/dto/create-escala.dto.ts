import { IsString, IsNotEmpty, IsInt, IsOptional } from 'class-validator';

export class CreateEscalaDto {
  @IsInt()
  @IsNotEmpty()
  mes: number;

  @IsInt()
  @IsNotEmpty()
  ano: number;

  @IsString()
  @IsNotEmpty()
  ministerioId: string;

  @IsString()
  @IsOptional()
  observacoes?: string;
}
