import { IsString, IsNotEmpty, IsInt, IsOptional, IsArray, Min, Max } from 'class-validator';

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

  @IsArray()
  @IsOptional()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  diasSemana?: number[]; // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
}
