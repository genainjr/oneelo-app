import { IsArray, IsString } from 'class-validator';

export class ReorderDiasDto {
  @IsArray()
  @IsString({ each: true })
  diaIds: string[];
}
