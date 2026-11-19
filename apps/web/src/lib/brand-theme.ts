import type { CSSProperties } from 'react';

export const DEFAULT_THEME_PALETTE = 'amber-gold' as const;
export const DEFAULT_PRIMARY_COLOR = '#fbbf24' as const;
export const THEME_HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

export type CuratedPaletteSlug =
  | 'amber-gold'
  | 'royal-blue'
  | 'emerald-green'
  | 'burgundy-wine'
  | 'royal-purple'
  | 'terracotta'
  | 'slate-graphite';

export type ThemePaletteSlug = CuratedPaletteSlug | 'custom';

export interface ThemePaletteDefinition {
  id: CuratedPaletteSlug;
  name: string;
  description: string;
  primaryColor: string;
}

export interface TenantThemeInput {
  themePalette?: string | null;
  primaryColor?: string | null;
}

export interface ResolvedTenantTheme {
  palette: ThemePaletteSlug;
  primaryColor: string;
  hoverColor: string;
  foregroundColor: '#09090b' | '#000000' | '#ffffff';
  inkColor: string;
  inkHoverColor: string;
  softBgColor: string;
  softHoverColor: string;
  softBorderColor: string;
  ringColor: string;
  siteAccentColor: string;
  siteAccentHoverColor: string;
  siteAccentForegroundColor: '#09090b' | '#000000' | '#ffffff';
  siteAccentTextColor: string;
  siteAccentRingColor: string;
  siteAccentTint: string;
  siteAccentGlow: string;
  siteAccentBorder: string;
  siteAccentBorderStrong: string;
  brandShadow: string;
  sidebarBadgeBg: string;
  cssVariables: Record<string, string>;
}

export const THEME_PALETTES: readonly ThemePaletteDefinition[] = [
  {
    id: 'amber-gold',
    name: 'Âmbar / Dourado',
    description: 'Calor, nobreza e acolhimento (padrão)',
    primaryColor: '#fbbf24',
  },
  {
    id: 'royal-blue',
    name: 'Azul Real / Marinho',
    description: 'Tradicional, sereno e institucional',
    primaryColor: '#1d4ed8',
  },
  {
    id: 'emerald-green',
    name: 'Verde Esmeralda',
    description: 'Vida, crescimento e renovação',
    primaryColor: '#059669',
  },
  {
    id: 'burgundy-wine',
    name: 'Vinho / Bordô',
    description: 'Realeza, comunhão e sobriedade',
    primaryColor: '#9f1239',
  },
  {
    id: 'royal-purple',
    name: 'Roxo / Púrpura',
    description: 'Eclesiástico, solene e contemporâneo',
    primaryColor: '#7c3aed',
  },
  {
    id: 'terracotta',
    name: 'Terracota / Cobre',
    description: 'Orgânico, acolhedor e artesanal',
    primaryColor: '#c2410c',
  },
  {
    id: 'slate-graphite',
    name: 'Grafite / Ardósia',
    description: 'Minimalista, neutro e elegante',
    primaryColor: '#475569',
  },
] as const;

const PALETTE_BY_ID: Record<CuratedPaletteSlug, ThemePaletteDefinition> =
  THEME_PALETTES.reduce(
    (acc, item) => {
      acc[item.id] = item;
      return acc;
    },
    {} as Record<CuratedPaletteSlug, ThemePaletteDefinition>,
  );

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface HslColor {
  h: number;
  s: number;
  l: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeThemeHex(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return THEME_HEX_REGEX.test(trimmed) ? trimmed : null;
}

export function hexToRgb(hex: string): RgbColor {
  const normalized = normalizeThemeHex(hex) ?? DEFAULT_PRIMARY_COLOR;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }: RgbColor): string {
  const toPart = (n: number) =>
    clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toPart(r)}${toPart(g)}${toPart(b)}`;
}

function rgbToHsl({ r, g, b }: RgbColor): HslColor {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }

  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: HslColor): RgbColor {
  const hn = (((h % 360) + 360) % 360) / 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;

  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;

  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

function hslToHex(hsl: HslColor): string {
  return rgbToHex(hslToRgb(hsl));
}

function toLinearChannel(channel255: number): number {
  const c = channel255 / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * toLinearChannel(r) +
    0.7152 * toLinearChannel(g) +
    0.0722 * toLinearChannel(b)
  );
}

export function getContrastRatio(hexA: string, hexB: string): number {
  const lumA = getRelativeLuminance(hexA);
  const lumB = getRelativeLuminance(hexB);
  const brightest = Math.max(lumA, lumB);
  const darkest = Math.min(lumA, lumB);
  return (brightest + 0.05) / (darkest + 0.05);
}

export function pickAccessibleForeground(
  backgroundHex: string,
): '#09090b' | '#000000' | '#ffffff' {
  const darkObsidian = '#09090b';
  const darkContrast = getContrastRatio(backgroundHex, darkObsidian);
  const whiteContrast = getContrastRatio(backgroundHex, '#ffffff');

  if (whiteContrast >= 4.5 && whiteContrast >= darkContrast) {
    return '#ffffff';
  }
  if (darkContrast >= 4.5) {
    return darkObsidian;
  }
  const blackContrast = getContrastRatio(backgroundHex, '#000000');
  return blackContrast >= whiteContrast ? '#000000' : '#ffffff';
}

function rgbaFromHex(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function adjustLightnessForMinContrast(
  baseHsl: HslColor,
  againstBackgrounds: string[],
  minRatio: number,
  direction: 'darken' | 'lighten',
): string {
  let currentL = clamp(baseHsl.l, 0, 100);
  const step = direction === 'darken' ? -2 : 2;
  let candidate = hslToHex({ h: baseHsl.h, s: baseHsl.s, l: currentL });

  const passesAll = (hex: string) =>
    againstBackgrounds.every((bg) => getContrastRatio(hex, bg) >= minRatio);

  if (passesAll(candidate)) {
    return candidate;
  }

  for (let i = 0; i < 60; i += 1) {
    currentL = clamp(currentL + step, 0, 100);
    candidate = hslToHex({ h: baseHsl.h, s: baseHsl.s, l: currentL });
    if (passesAll(candidate)) {
      return candidate;
    }
    if ((direction === 'darken' && currentL <= 4) || (direction === 'lighten' && currentL >= 96)) {
      break;
    }
  }

  if (direction === 'darken') {
    const obsidian = '#09090b';
    return passesAll(obsidian) ? obsidian : '#000000';
  }
  return '#f4f4f5';
}

const AMBER_DEFAULT_THEME: ResolvedTenantTheme = {
  palette: DEFAULT_THEME_PALETTE,
  primaryColor: '#fbbf24',
  hoverColor: '#f59e0b',
  foregroundColor: '#09090b',
  inkColor: '#b45309',
  inkHoverColor: '#92400e',
  softBgColor: '#fef3c7',
  softHoverColor: '#fde68a',
  softBorderColor: '#fcd34d',
  ringColor: '#d97706',
  siteAccentColor: '#fbbf24',
  siteAccentHoverColor: '#fcd34d',
  siteAccentForegroundColor: '#09090b',
  siteAccentTextColor: '#fcd34d',
  siteAccentRingColor: '#fbbf24',
  siteAccentTint: 'rgba(251, 191, 36, 0.14)',
  siteAccentGlow: 'rgba(251, 191, 36, 0.12)',
  siteAccentBorder: 'rgba(251, 191, 36, 0.4)',
  siteAccentBorderStrong: 'rgba(251, 191, 36, 0.65)',
  brandShadow: 'rgba(245, 158, 11, 0.2)',
  sidebarBadgeBg: 'rgba(251, 191, 36, 0.16)',
  cssVariables: {
    '--theme-brand': '#fbbf24',
    '--theme-brand-hover': '#f59e0b',
    '--theme-brand-foreground': '#09090b',
    '--theme-brand-shadow': 'rgba(245, 158, 11, 0.2)',
    '--theme-accent-ink': '#b45309',
    '--theme-accent-ink-hover': '#92400e',
    '--theme-accent-soft': '#fef3c7',
    '--theme-accent-soft-hover': '#fde68a',
    '--theme-accent-soft-border': '#fcd34d',
    '--theme-accent-ring': '#d97706',
    '--theme-stat-brand-bg': '#fef3c7',
    '--theme-stat-brand-text': '#b45309',
    '--theme-sidebar-active-bg': '#fbbf24',
    '--theme-sidebar-active-text': '#09090b',
    '--theme-sidebar-ring': '#fbbf24',
    '--theme-sidebar-badge-bg': 'rgba(251, 191, 36, 0.16)',
    '--theme-sidebar-badge-text': '#fcd34d',
    '--site-accent': '#fbbf24',
    '--site-accent-hover': '#fcd34d',
    '--site-accent-foreground': '#09090b',
    '--site-accent-text': '#fcd34d',
    '--site-accent-ring': '#fbbf24',
    '--site-accent-tint': 'rgba(251, 191, 36, 0.14)',
    '--site-accent-glow': 'rgba(251, 191, 36, 0.12)',
    '--site-accent-border': 'rgba(251, 191, 36, 0.4)',
    '--site-accent-border-strong': 'rgba(251, 191, 36, 0.65)',
  },
};

export function resolveTenantSelection(tenant?: TenantThemeInput | null): {
  palette: ThemePaletteSlug;
  primaryColor: string;
} {
  const rawPalette = tenant?.themePalette?.trim().toLowerCase();
  const normalizedHex = normalizeThemeHex(tenant?.primaryColor);

  if (rawPalette && rawPalette !== 'custom' && rawPalette in PALETTE_BY_ID) {
    const curated = PALETTE_BY_ID[rawPalette as CuratedPaletteSlug];
    return {
      palette: curated.id,
      primaryColor: curated.primaryColor,
    };
  }

  if (rawPalette === 'custom' && normalizedHex) {
    return {
      palette: 'custom',
      primaryColor: normalizedHex,
    };
  }

  if (normalizedHex) {
    const matchingCurated = THEME_PALETTES.find(
      (item) => item.primaryColor.toLowerCase() === normalizedHex,
    );
    if (matchingCurated) {
      return {
        palette: matchingCurated.id,
        primaryColor: matchingCurated.primaryColor,
      };
    }
    return {
      palette: 'custom',
      primaryColor: normalizedHex,
    };
  }

  return {
    palette: DEFAULT_THEME_PALETTE,
    primaryColor: DEFAULT_PRIMARY_COLOR,
  };
}

export function resolveTenantBrandTheme(
  tenant?: TenantThemeInput | null,
): ResolvedTenantTheme {
  const { palette, primaryColor } = resolveTenantSelection(tenant);

  if (
    palette === DEFAULT_THEME_PALETTE &&
    primaryColor === DEFAULT_PRIMARY_COLOR
  ) {
    return AMBER_DEFAULT_THEME;
  }

  const baseHsl = rgbToHsl(hexToRgb(primaryColor));
  const softSaturation = baseHsl.s < 8 ? 0 : clamp(baseHsl.s * 0.78, 18, 86);

  const softBgColor = hslToHex({ h: baseHsl.h, s: softSaturation, l: 94 });
  const softHoverColor = hslToHex({ h: baseHsl.h, s: softSaturation, l: 88 });
  const softBorderColor = hslToHex({ h: baseHsl.h, s: softSaturation, l: 78 });

  const hoverDirection = baseHsl.l <= 24 ? 9 : -7;
  const hoverColor = hslToHex({
    h: baseHsl.h,
    s: baseHsl.s,
    l: clamp(baseHsl.l + hoverDirection, 4, 94),
  });

  const foregroundColor = pickAccessibleForeground(primaryColor);

  const inkColor = adjustLightnessForMinContrast(
    baseHsl,
    ['#ffffff', '#faf9f6', softBgColor],
    4.5,
    'darken',
  );
  const inkHsl = rgbToHsl(hexToRgb(inkColor));
  const inkHoverColor = hslToHex({
    h: inkHsl.h,
    s: inkHsl.s,
    l: clamp(inkHsl.l - 7, 4, 48),
  });

  const ringColor = adjustLightnessForMinContrast(
    baseHsl,
    ['#ffffff', '#f9fafb'],
    3.0,
    'darken',
  );

  // Em superfícies escuras (#09090b / #18181b), garante texto/borda visíveis mesmo se a cor escolhida for ultra-escura
  const siteAccentColor =
    baseHsl.l < 22
      ? hslToHex({ h: baseHsl.h, s: baseHsl.s, l: 38 })
      : primaryColor;
  const siteAccentHsl = rgbToHsl(hexToRgb(siteAccentColor));
  const siteAccentHoverColor = hslToHex({
    h: siteAccentHsl.h,
    s: siteAccentHsl.s,
    l: clamp(siteAccentHsl.l + (siteAccentHsl.l > 78 ? -8 : 8), 8, 92),
  });
  const siteAccentForegroundColor = pickAccessibleForeground(siteAccentColor);

  const siteAccentTextColor = adjustLightnessForMinContrast(
    baseHsl,
    ['#18181b', '#09090b'],
    4.5,
    'lighten',
  );
  const siteAccentRingColor = adjustLightnessForMinContrast(
    baseHsl,
    ['#18181b', '#09090b'],
    3.2,
    'lighten',
  );

  const decorativeRgbSource =
    baseHsl.l < 42
      ? hslToHex({
          h: baseHsl.h,
          s: baseHsl.s < 8 ? 0 : clamp(baseHsl.s, 18, 90),
          l: 58,
        })
      : primaryColor;

  const siteAccentTint = rgbaFromHex(decorativeRgbSource, 0.14);
  const siteAccentGlow = rgbaFromHex(decorativeRgbSource, 0.12);
  const siteAccentBorder = rgbaFromHex(decorativeRgbSource, 0.42);
  const siteAccentBorderStrong = rgbaFromHex(decorativeRgbSource, 0.68);
  const brandShadow = rgbaFromHex(
    baseHsl.l < 22 ? decorativeRgbSource : primaryColor,
    0.22,
  );
  const sidebarBadgeBg = rgbaFromHex(decorativeRgbSource, 0.18);

  const cssVariables: Record<string, string> = {
    '--theme-brand': primaryColor,
    '--theme-brand-hover': hoverColor,
    '--theme-brand-foreground': foregroundColor,
    '--theme-brand-shadow': brandShadow,
    '--theme-accent-ink': inkColor,
    '--theme-accent-ink-hover': inkHoverColor,
    '--theme-accent-soft': softBgColor,
    '--theme-accent-soft-hover': softHoverColor,
    '--theme-accent-soft-border': softBorderColor,
    '--theme-accent-ring': ringColor,
    '--theme-stat-brand-bg': softBgColor,
    '--theme-stat-brand-text': inkColor,
    '--theme-sidebar-active-bg': primaryColor,
    '--theme-sidebar-active-text': foregroundColor,
    '--theme-sidebar-ring': siteAccentRingColor,
    '--theme-sidebar-badge-bg': sidebarBadgeBg,
    '--theme-sidebar-badge-text': siteAccentTextColor,
    '--site-accent': siteAccentColor,
    '--site-accent-hover': siteAccentHoverColor,
    '--site-accent-foreground': siteAccentForegroundColor,
    '--site-accent-text': siteAccentTextColor,
    '--site-accent-ring': siteAccentRingColor,
    '--site-accent-tint': siteAccentTint,
    '--site-accent-glow': siteAccentGlow,
    '--site-accent-border': siteAccentBorder,
    '--site-accent-border-strong': siteAccentBorderStrong,
  };

  return {
    palette,
    primaryColor,
    hoverColor,
    foregroundColor,
    inkColor,
    inkHoverColor,
    softBgColor,
    softHoverColor,
    softBorderColor,
    ringColor,
    siteAccentColor,
    siteAccentHoverColor,
    siteAccentForegroundColor,
    siteAccentTextColor,
    siteAccentRingColor,
    siteAccentTint,
    siteAccentGlow,
    siteAccentBorder,
    siteAccentBorderStrong,
    brandShadow,
    sidebarBadgeBg,
    cssVariables,
  };
}

export function buildTenantBrandThemeStyle(
  tenant?: TenantThemeInput | null,
): CSSProperties {
  return resolveTenantBrandTheme(tenant).cssVariables as CSSProperties;
}

export const TENANT_THEME_CSS_VARIABLE_KEYS = Object.keys(
  AMBER_DEFAULT_THEME.cssVariables,
);
