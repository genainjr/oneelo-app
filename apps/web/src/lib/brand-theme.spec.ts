import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_THEME_PALETTE,
  THEME_PALETTES,
  buildTenantBrandThemeStyle,
  getContrastRatio,
  resolveTenantBrandTheme,
  resolveTenantSelection,
} from './brand-theme';

describe('brand-theme contrast and scale calculator', () => {
  it('usa amber-gold (#fbbf24) como fallback quando tenant é nulo ou indefinido', () => {
    assert.deepEqual(resolveTenantSelection(null), {
      palette: DEFAULT_THEME_PALETTE,
      primaryColor: DEFAULT_PRIMARY_COLOR,
    });
    assert.deepEqual(resolveTenantSelection({ themePalette: null, primaryColor: null }), {
      palette: DEFAULT_THEME_PALETTE,
      primaryColor: DEFAULT_PRIMARY_COLOR,
    });
  });

  it('força a cor oficial quando uma paleta curada válida é informada', () => {
    assert.deepEqual(
      resolveTenantSelection({
        themePalette: 'royal-blue',
        primaryColor: '#ff00ff',
      }),
      {
        palette: 'royal-blue',
        primaryColor: '#1d4ed8',
      },
    );
  });

  it('mantém contraste WCAG AA >= 4.5:1 em todas as superfícies para as 7 paletas oficiais e extremos customizados', () => {
    const cases = [
      ...THEME_PALETTES.map((palette) => ({
        themePalette: palette.id,
        primaryColor: palette.primaryColor,
      })),
      { themePalette: 'custom', primaryColor: '#000000' },
      { themePalette: 'custom', primaryColor: '#ffffff' },
      { themePalette: 'custom', primaryColor: '#38bdf8' },
      { themePalette: 'custom', primaryColor: '#fde047' },
      { themePalette: 'custom', primaryColor: '#881337' },
      { themePalette: 'custom', primaryColor: '#ec4899' },
    ];

    for (const input of cases) {
      const resolved = resolveTenantBrandTheme(input);

      assert.ok(
        getContrastRatio(resolved.primaryColor, resolved.foregroundColor) >= 4.5,
        `Contraste insuficiente no botão para ${input.primaryColor}`,
      );
      assert.ok(
        getContrastRatio(resolved.inkColor, '#ffffff') >= 4.5,
        `Contraste insuficiente de --theme-accent-ink sobre branco para ${input.primaryColor}`,
      );
      assert.ok(
        getContrastRatio(resolved.inkColor, resolved.softBgColor) >= 4.5,
        `Contraste insuficiente de --theme-accent-ink sobre tint claro para ${input.primaryColor}`,
      );
      assert.ok(
        getContrastRatio(resolved.siteAccentTextColor, '#18181b') >= 4.5,
        `Contraste insuficiente de --site-accent-text sobre fundo escuro #18181b para ${input.primaryColor}`,
      );
      assert.ok(
        getContrastRatio(resolved.siteAccentColor, resolved.siteAccentForegroundColor) >= 4.5,
        `Contraste insuficiente no CTA do site público para ${input.primaryColor}`,
      );
      assert.ok(
        getContrastRatio(resolved.ringColor, '#ffffff') >= 3.0,
        `Contraste insuficiente de --theme-accent-ring para ${input.primaryColor}`,
      );
      assert.ok(
        getContrastRatio(resolved.siteAccentRingColor, '#18181b') >= 3.0,
        `Contraste insuficiente de --site-accent-ring para ${input.primaryColor}`,
      );
    }
  });

  it('expõe CSSProperties com todas as variáveis esperadas pelo tema da igreja', () => {
    const style = buildTenantBrandThemeStyle({
      themePalette: 'royal-purple',
      primaryColor: '#7c3aed',
    }) as Record<string, string>;

    assert.equal(style['--theme-brand'], '#7c3aed');
    assert.equal(style['--theme-brand-foreground'], '#ffffff');
    assert.ok(style['--theme-accent-ink']);
    assert.ok(style['--site-accent-text']);
    assert.ok(style['--site-accent-ring']);
  });
});
