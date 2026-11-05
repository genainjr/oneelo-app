import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  NotificationAudienceType,
  NotificationOrigin,
  NotificationStatus,
} from '@prisma/client';

export class FilterNotificationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @IsOptional()
  @IsEnum(NotificationOrigin)
  origem?: NotificationOrigin;

  @IsOptional()
  @IsEnum(NotificationAudienceType)
  tipoPublico?: NotificationAudienceType;

  @IsOptional()
  @IsUUID('4')
  ministerioId?: string;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
