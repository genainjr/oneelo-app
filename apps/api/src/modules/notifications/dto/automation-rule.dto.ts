import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationAutomationType } from '@prisma/client';

export class UpsertAutomationRuleDto {
  @IsEnum(NotificationAutomationType)
  tipo: NotificationAutomationType;

  @IsBoolean()
  ativo: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  horario?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  antecedenciaHoras?: number | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  titulo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  mensagem: string;
}

export class UpdateAutomationRulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertAutomationRuleDto)
  regras: UpsertAutomationRuleDto[];
}

export class ResetAutomationRuleDto {
  @IsEnum(NotificationAutomationType)
  tipo: NotificationAutomationType;
}
