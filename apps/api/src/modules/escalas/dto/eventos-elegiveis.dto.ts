import { Type } from 'class-transformer';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class EventosElegiveisDto {
  @IsUUID('4')
  ministerioId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  ano: number;
}
