import { IsDateString, IsOptional } from 'class-validator';

export class EventoOcorrenciaInputDto {
  @IsDateString({}, { message: 'Data inicial inválida em uma das ocorrências.' })
  dataInicio: string;

  @IsDateString({}, { message: 'Data final inválida em uma das ocorrências.' })
  @IsOptional()
  dataFim?: string;
}
