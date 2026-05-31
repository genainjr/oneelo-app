import { IsString, IsOptional } from 'class-validator';

export class UpdateTagDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  corHex?: string;
}
