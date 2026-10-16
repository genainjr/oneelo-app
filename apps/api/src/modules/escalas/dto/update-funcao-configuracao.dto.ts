import { IsArray, IsString, IsOptional } from 'class-validator';

export class UpdateFuncaoConfiguracaoDto {
  @IsArray()
  @IsString({ each: true })
  segmentoIds: string[];

  @IsString()
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  localAtuacao?: string | null;
}
