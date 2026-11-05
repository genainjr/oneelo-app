import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { NotificationAudienceType } from '@prisma/client';

export class CreateManualNotificationDto {
  @IsString()
  @IsNotEmpty({ message: 'O título é obrigatório.' })
  @MaxLength(120, { message: 'O título deve ter no máximo 120 caracteres.' })
  titulo: string;

  @IsString()
  @IsNotEmpty({ message: 'A mensagem é obrigatória.' })
  @MaxLength(500, { message: 'A mensagem deve ter no máximo 500 caracteres.' })
  mensagem: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  urlDestino?: string;

  @IsEnum(NotificationAudienceType, {
    message: 'O tipo de público deve ser ALL_MEMBERS, MINISTRY ou SPECIFIC_USERS.',
  })
  tipoPublico: NotificationAudienceType;

  @IsUUID('4', { message: 'O ID do ministério deve ser um UUID válido.' })
  @IsOptional()
  ministerioId?: string;

  @IsArray({ message: 'Os IDs de usuários devem ser fornecidos em um array.' })
  @IsUUID('4', { each: true, message: 'Cada ID de usuário deve ser um UUID válido.' })
  @IsOptional()
  userIds?: string[];

  @IsDateString({}, { message: 'A data de agendamento deve ser uma data válida.' })
  @IsOptional()
  scheduledAt?: string;
}
