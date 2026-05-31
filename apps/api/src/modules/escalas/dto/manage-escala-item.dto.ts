import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ManageEscalaItemDto {
  @IsString()
  @IsNotEmpty()
  membroId: string;

  @IsString()
  @IsNotEmpty()
  funcao: string;

  @IsString()
  @IsOptional()
  observacoes?: string;
}
