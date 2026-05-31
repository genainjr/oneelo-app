import { IsString, IsNotEmpty, IsDateString, IsOptional } from 'class-validator';

export class CreateEscalaDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsDateString()
  @IsNotEmpty()
  data: string;

  @IsString()
  @IsNotEmpty()
  ministerioId: string;

  @IsString()
  @IsOptional()
  observacoes?: string;
}
