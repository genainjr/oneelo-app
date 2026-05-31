import { IsString, IsOptional } from 'class-validator';

export class CreateTagDto {
  @IsString()
  nome: string;

  @IsString()
  @IsOptional()
  corHex?: string;
}
