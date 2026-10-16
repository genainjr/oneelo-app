import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class ManageEscalaItemDto {
  @IsString()
  @IsNotEmpty()
  escalaDiaId: string;

  @IsString()
  @IsNotEmpty()
  membroId: string;

  @IsString()
  @IsNotEmpty()
  ministerioFuncaoId: string;

  @IsString()
  @IsOptional()
  observacoes?: string;

  @IsBoolean()
  @IsOptional()
  confirmarAvisos?: boolean;
}
