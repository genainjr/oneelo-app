import { IsDefined, IsUUID, ValidateIf } from 'class-validator';

export class UpdateEscalaDiaEventoDto {
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  eventoId!: string | null;
}
