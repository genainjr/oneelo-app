import { IsString, IsBoolean } from 'class-validator';

export class ToggleDiaFuncaoOcultaDto {
  @IsString()
  funcaoId: string;

  @IsBoolean()
  ocultar: boolean;
}
