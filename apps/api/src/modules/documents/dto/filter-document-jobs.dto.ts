import { IsEnum, IsOptional, IsString } from 'class-validator';
import { StatusDocumentJob, TipoDocumento } from '@prisma/client';

export class FilterDocumentJobsDto {
  @IsEnum(StatusDocumentJob)
  @IsOptional()
  status?: StatusDocumentJob;

  @IsEnum(TipoDocumento)
  @IsOptional()
  tipoDocumento?: TipoDocumento;

  @IsString()
  @IsOptional()
  categoria?: string;

  @IsString()
  @IsOptional()
  limit?: string;

  @IsString()
  @IsOptional()
  offset?: string;
}
