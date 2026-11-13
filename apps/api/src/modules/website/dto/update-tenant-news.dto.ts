import {
  IsBoolean,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
} from 'class-validator';
import {
  NoRawHtmlConstraint,
  TrimNullableString,
  TrimString,
} from './website-validation';

export class UpdateTenantNewsDto {
  @IsOptional()
  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'Título do informativo não pode ficar vazio.' })
  @MaxLength(180)
  titulo?: string;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(400)
  @Validate(NoRawHtmlConstraint)
  resumo?: string | null;

  @IsOptional()
  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'Conteúdo do informativo não pode ficar vazio.' })
  @MaxLength(15000)
  @Validate(NoRawHtmlConstraint)
  conteudo?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Data de publicação inválida.' })
  dataPublicacao?: string;

  @IsOptional()
  @IsBoolean()
  destaque?: boolean;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
