import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class ReorderSegmentosDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  segmentoIds: string[];
}
