import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum ModoCriacaoEscala {
  DIAS_SEMANA = 'DIAS_SEMANA',
  EVENTOS = 'EVENTOS',
  VAZIA = 'VAZIA',
}

export class CreateEscalaDto {
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Max(12)
  mes: number;

  @IsInt()
  @IsNotEmpty()
  @Min(2000)
  @Max(2100)
  ano: number;

  @IsString()
  @IsNotEmpty()
  @IsUUID('4')
  ministerioId: string;

  @IsString()
  @IsOptional()
  observacoes?: string;

  @IsArray()
  @IsOptional()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  diasSemana?: number[]; // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb

  @IsEnum(ModoCriacaoEscala)
  @IsOptional()
  modoCriacao?: ModoCriacaoEscala;

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayUnique()
  @IsOptional()
  eventoIds?: string[];
}
