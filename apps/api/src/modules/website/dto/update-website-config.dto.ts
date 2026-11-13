import { IsOptional, IsString, MaxLength, Validate } from 'class-validator';
import {
  NoRawHtmlConstraint,
  SafeHttpUrlConstraint,
  TrimNullableString,
} from './website-validation';

export class UpdateWebsiteConfigDto {
  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(160)
  tituloHero?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(400)
  subtituloHero?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(500)
  versiculoTema?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(120)
  versiculoReferencia?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(5000)
  @Validate(NoRawHtmlConstraint)
  sobreNos?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(8000)
  @Validate(NoRawHtmlConstraint)
  historia?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(5000)
  @Validate(NoRawHtmlConstraint)
  visaoValores?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(200)
  pastoresNomes?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(4000)
  @Validate(NoRawHtmlConstraint)
  pastoresBio?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(200)
  endereco?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(30)
  numero?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(120)
  bairro?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(120)
  cidade?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(60)
  estado?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(20)
  cep?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(600)
  @Validate(SafeHttpUrlConstraint)
  googleMapsUrl?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(300)
  horarioSecretaria?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(400)
  @Validate(SafeHttpUrlConstraint)
  instagramUrl?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(400)
  @Validate(SafeHttpUrlConstraint)
  youtubeUrl?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(400)
  @Validate(SafeHttpUrlConstraint)
  facebookUrl?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(400)
  @Validate(SafeHttpUrlConstraint)
  spotifyUrl?: string | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(40)
  whatsappAtendimento?: string | null;
}
