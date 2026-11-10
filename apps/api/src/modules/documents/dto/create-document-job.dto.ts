import { IsEnum, IsNotEmpty, IsOptional, IsObject, IsString } from 'class-validator';
import { TipoDocumento, FormatoDocumento } from '@prisma/client';

export class CreateDocumentJobDto {
  @IsEnum(TipoDocumento)
  @IsNotEmpty()
  tipoDocumento: TipoDocumento;

  @IsEnum(FormatoDocumento)
  @IsNotEmpty()
  formato: FormatoDocumento;

  @IsObject()
  @IsOptional()
  parametros?: Record<string, any>;

  @IsString()
  @IsOptional()
  versionHash?: string;
}
