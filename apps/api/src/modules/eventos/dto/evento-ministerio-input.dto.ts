import { IsBoolean, IsUUID } from 'class-validator';

export class EventoMinisterioInputDto {
  @IsUUID('4')
  ministerioId: string;

  @IsBoolean()
  requerEscala: boolean;
}
