import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateUserNotificationPreferenceDto {
  @IsOptional()
  @IsBoolean()
  notifyBirthdays?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyEvents?: boolean;

  @IsOptional()
  @IsBoolean()
  notifySchedules?: boolean;
}
