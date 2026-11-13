import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderSchedulesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos um horário para reordenação.' })
  @IsUUID('4', { each: true, message: 'Identificador de culto inválido.' })
  orderedIds: string[];
}
