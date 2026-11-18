import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, Matches, ValidateIf } from 'class-validator';
import {
  ALLOWED_TENANT_THEME_PALETTES,
  TENANT_HEX_COLOR_REGEX,
} from '../tenant-theme.constants';

export class UpdateTenantThemeDto {
  @ApiProperty({
    description: 'Slug da paleta oficial ou "custom" para cor personalizada',
    example: 'royal-blue',
    enum: ALLOWED_TENANT_THEME_PALETTES,
  })
  @IsString()
  @IsNotEmpty({ message: 'Selecione uma paleta ou cor personalizada.' })
  @IsIn(ALLOWED_TENANT_THEME_PALETTES, {
    message: 'Paleta de tema invalida.',
  })
  themePalette: string;

  @ApiPropertyOptional({
    description: 'Cor primaria em formato hexadecimal #RRGGBB',
    example: '#1d4ed8',
  })
  @ValidateIf(
    (dto: UpdateTenantThemeDto) =>
      dto.themePalette === 'custom' || dto.primaryColor !== undefined,
  )
  @IsString({ message: 'Cor primaria deve ser um texto hexadecimal valido.' })
  @Matches(TENANT_HEX_COLOR_REGEX, {
    message: 'Cor primaria deve estar no formato #RRGGBB.',
  })
  primaryColor?: string;
}
