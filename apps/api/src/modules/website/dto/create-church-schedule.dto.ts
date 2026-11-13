import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ModalidadeCulto } from '@prisma/client';
import { TrimNullableString, TrimString } from './website-validation';

export class CreateChurchScheduleDto {
  @IsInt({ message: 'Dia da semana deve ser um número inteiro entre 0 e 6.' })
  @Min(0)
  @Max(6)
  diaSemana: number;

  @TrimString()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Horário deve estar no formato HH:mm.',
  })
  horario: string;

  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'Título do culto é obrigatório.' })
  @MaxLength(120)
  titulo: string;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(500)
  descricao?: string | null;

  @IsOptional()
  @IsEnum(ModalidadeCulto)
  modalidade?: ModalidadeCulto;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
