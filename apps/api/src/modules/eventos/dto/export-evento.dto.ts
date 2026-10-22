import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import { FilterEventosDto } from './filter-eventos.dto';

export class ExportEventoDto extends FilterEventosDto {
  @IsOptional()
  _t?: string;

  @IsIn(['pdf', 'png'])
  formato: 'pdf' | 'png' = 'pdf';

  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (value === 'todas') {
      return 'todas';
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : value;
  })
  @IsOptional()
  @ValidateIf((dto: ExportEventoDto) => dto.pagina !== undefined && dto.pagina !== 'todas')
  @IsInt()
  @Min(1)
  pagina?: number | 'todas';
}
