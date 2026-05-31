import { IsString, IsOptional, IsDateString } from 'class-validator';

export class FilterEventosDto {
  @IsDateString()
  @IsOptional()
  dataInicio?: string;

  @IsDateString()
  @IsOptional()
  dataFim?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
