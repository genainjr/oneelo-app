import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AddEscalaDiaDto {
  @IsISO8601()
  @IsOptional()
  data?: string;

  @IsString()
  @MaxLength(160)
  @IsOptional()
  titulo?: string;

  @IsUUID()
  @IsOptional()
  eventoId?: string;
}
