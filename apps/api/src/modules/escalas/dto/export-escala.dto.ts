import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { FilterEscalaVisualizacaoDto } from './filter-escala-visualizacao.dto';

export class ExportEscalaDto extends FilterEscalaVisualizacaoDto {
  @IsIn(['pdf', 'png'])
  formato: 'pdf' | 'png' = 'pdf';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pagina?: number;
}
