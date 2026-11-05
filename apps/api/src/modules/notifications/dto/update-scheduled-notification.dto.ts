import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateScheduledNotificationDto {
  @IsString()
  @IsOptional()
  @MaxLength(120, { message: 'O título deve ter no máximo 120 caracteres.' })
  titulo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'A mensagem deve ter no máximo 500 caracteres.' })
  mensagem?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  urlDestino?: string;

  @IsDateString({}, { message: 'A data de agendamento deve ser uma data válida.' })
  @IsOptional()
  scheduledAt?: string;
}
