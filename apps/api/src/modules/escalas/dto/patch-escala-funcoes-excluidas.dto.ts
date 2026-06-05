import { IsArray, IsString } from 'class-validator';

export class PatchEscalaFuncoesExcluidasDto {
  @IsArray()
  @IsString({ each: true })
  funcaoIds: string[];
}
