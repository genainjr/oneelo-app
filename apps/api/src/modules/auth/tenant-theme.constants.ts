import { BadRequestException } from '@nestjs/common';

export const DEFAULT_TENANT_THEME_PALETTE = 'amber-gold' as const;
export const DEFAULT_TENANT_PRIMARY_COLOR = '#fbbf24' as const;

export const TENANT_THEME_PALETTES = {
  'amber-gold': '#fbbf24',
  'royal-blue': '#1d4ed8',
  'emerald-green': '#059669',
  'burgundy-wine': '#9f1239',
  'royal-purple': '#7c3aed',
  terracotta: '#c2410c',
  'slate-graphite': '#475569',
} as const;

export type CuratedTenantThemePalette = keyof typeof TENANT_THEME_PALETTES;

export const ALLOWED_TENANT_THEME_PALETTES = [
  'amber-gold',
  'royal-blue',
  'emerald-green',
  'burgundy-wine',
  'royal-purple',
  'terracotta',
  'slate-graphite',
  'custom',
] as const;

export type TenantThemePaletteKey =
  (typeof ALLOWED_TENANT_THEME_PALETTES)[number];

export const TENANT_HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export function normalizeHexColor(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return TENANT_HEX_COLOR_REGEX.test(trimmed) ? trimmed : null;
}

export function resolveNormalizedTenantTheme(input: {
  themePalette: string;
  primaryColor?: string | null;
}): {
  themePalette: string | null;
  primaryColor: string | null;
} {
  const palette = input.themePalette?.trim().toLowerCase();

  if (
    !palette ||
    !ALLOWED_TENANT_THEME_PALETTES.includes(palette as TenantThemePaletteKey)
  ) {
    throw new BadRequestException('Paleta de tema invalida.');
  }

  if (palette === DEFAULT_TENANT_THEME_PALETTE) {
    return {
      themePalette: null,
      primaryColor: null,
    };
  }

  if (palette !== 'custom') {
    const presetColor =
      TENANT_THEME_PALETTES[palette as CuratedTenantThemePalette];
    return {
      themePalette: palette,
      primaryColor: presetColor,
    };
  }

  const normalizedHex = normalizeHexColor(input.primaryColor);
  if (!normalizedHex) {
    throw new BadRequestException(
      'Informe uma cor primaria valida no formato #RRGGBB.',
    );
  }

  return {
    themePalette: 'custom',
    primaryColor: normalizedHex,
  };
}
