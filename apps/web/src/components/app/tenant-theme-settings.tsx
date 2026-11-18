'use client';

import { useId, useMemo, useState } from 'react';
import { Check, Loader2, Palette, RotateCcw, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_THEME_PALETTE,
  THEME_HEX_REGEX,
  THEME_PALETTES,
  buildTenantBrandThemeStyle,
  normalizeThemeHex,
  resolveTenantBrandTheme,
  resolveTenantSelection,
  type ThemePaletteSlug,
} from '@/lib/brand-theme';
import type { AuthUser } from '@/types';

type TenantThemePayload = NonNullable<AuthUser['tenant']>;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function TenantThemeSettings({
  tenant,
  onUpdated,
}: {
  tenant: TenantThemePayload;
  onUpdated: (tenant: TenantThemePayload) => void;
}) {
  const customHexInputId = useId();
  const customColorPickerId = useId();

  const savedSelection = useMemo(
    () =>
      resolveTenantSelection({
        themePalette: tenant.themePalette,
        primaryColor: tenant.primaryColor,
      }),
    [tenant.primaryColor, tenant.themePalette],
  );

  const savedKey = `${savedSelection.palette}:${savedSelection.primaryColor}`;
  const [prevSavedKey, setPrevSavedKey] = useState<string>(savedKey);
  const [selectedPalette, setSelectedPalette] = useState<ThemePaletteSlug>(
    savedSelection.palette,
  );
  const [customHexInput, setCustomHexInput] = useState<string>(
    savedSelection.primaryColor,
  );
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  if (savedKey !== prevSavedKey) {
    setPrevSavedKey(savedKey);
    setSelectedPalette(savedSelection.palette);
    setCustomHexInput(savedSelection.primaryColor);
  }

  const normalizedCustomHex = normalizeThemeHex(customHexInput);
  const isCustomMode = selectedPalette === 'custom';
  const activeHex =
    isCustomMode
      ? normalizedCustomHex ?? savedSelection.primaryColor
      : THEME_PALETTES.find((item) => item.id === selectedPalette)?.primaryColor ??
        DEFAULT_PRIMARY_COLOR;

  const isCustomHexValid = !isCustomMode || Boolean(normalizedCustomHex);
  const hasPendingChanges =
    selectedPalette !== savedSelection.palette ||
    (isCustomMode &&
      normalizedCustomHex !== null &&
      normalizedCustomHex !== savedSelection.primaryColor);

  const isDefaultSaved =
    savedSelection.palette === DEFAULT_THEME_PALETTE &&
    savedSelection.primaryColor === DEFAULT_PRIMARY_COLOR;

  const previewTheme = useMemo(
    () =>
      resolveTenantBrandTheme({
        themePalette: selectedPalette,
        primaryColor: activeHex,
      }),
    [selectedPalette, activeHex],
  );

  const previewStyle = useMemo(
    () =>
      buildTenantBrandThemeStyle({
        themePalette: selectedPalette,
        primaryColor: activeHex,
      }),
    [selectedPalette, activeHex],
  );

  async function revalidatePublicSiteCache() {
    if (!tenant.slug) return;
    await fetch('/api/site/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: tenant.slug }),
    }).catch(() => undefined);
  }

  async function persistTheme(
    payload: { themePalette: ThemePaletteSlug; primaryColor: string },
    successText: string,
    mode: 'save' | 'reset',
  ) {
    setMessage(null);
    if (mode === 'reset') {
      setResetting(true);
    } else {
      setSaving(true);
    }

    try {
      const updated = await api.patch<TenantThemePayload>(
        '/api/auth/tenant/theme',
        payload,
      );
      onUpdated(updated);
      await revalidatePublicSiteCache();
      setMessage({ type: 'success', text: successText });
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(
          error,
          'Não foi possível salvar a identidade visual da igreja.',
        ),
      });
    } finally {
      setSaving(false);
      setResetting(false);
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!isCustomHexValid) {
      setMessage({
        type: 'error',
        text: 'Informe uma cor hexadecimal válida no formato #RRGGBB.',
      });
      return;
    }

    await persistTheme(
      {
        themePalette: selectedPalette,
        primaryColor: activeHex,
      },
      'Identidade visual da igreja atualizada com sucesso.',
      'save',
    );
  }

  async function handleResetDefault() {
    setSelectedPalette(DEFAULT_THEME_PALETTE);
    setCustomHexInput(DEFAULT_PRIMARY_COLOR);
    await persistTheme(
      {
        themePalette: DEFAULT_THEME_PALETTE,
        primaryColor: DEFAULT_PRIMARY_COLOR,
      },
      'Tema restaurado para o padrão oficial (Âmbar / Dourado).',
      'reset',
    );
  }

  function handleSelectPreset(paletteId: ThemePaletteSlug, hex?: string) {
    setMessage(null);
    setSelectedPalette(paletteId);
    if (hex) {
      setCustomHexInput(hex);
    }
  }

  function handleCustomHexChange(rawValue: string) {
    setMessage(null);
    const cleaned = rawValue.trim();
    const withHash = cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
    setSelectedPalette('custom');
    setCustomHexInput(withHash.slice(0, 7));
  }

  return (
    <section
      aria-labelledby="tenant-theme-heading"
      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-2xs"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-accent-ink" aria-hidden="true" />
          <h2 id="tenant-theme-heading" className="text-base font-bold text-gray-900">
            Identidade Visual &amp; Cores da Igreja
          </h2>
        </div>
        <p className="text-sm text-gray-600">
          Escolha uma paleta oficial ou defina o código HEX da igreja. O sistema ajusta automaticamente o contraste em botões, links, sidebar e portal público.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-gray-800">
              Paletas Oficiais Curadas
            </p>
            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {THEME_PALETTES.map((palette) => {
                const isSelected = selectedPalette === palette.id;
                return (
                  <button
                    key={palette.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() =>
                      handleSelectPreset(palette.id, palette.primaryColor)
                    }
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? 'border-accent-ring bg-accent-soft/60 ring-2 ring-accent-ring/20'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/70'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        backgroundColor: palette.primaryColor,
                        forcedColorAdjust: 'none',
                      }}
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/10 shadow-xs"
                    >
                      {isSelected && (
                        <Check
                          className="h-4 w-4"
                          style={{
                            color:
                              resolveTenantBrandTheme({
                                themePalette: palette.id,
                                primaryColor: palette.primaryColor,
                              }).foregroundColor,
                          }}
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-gray-900">
                          {palette.name}
                        </span>
                        <span className="font-mono text-[11px] uppercase text-gray-400">
                          {palette.primaryColor}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                        {palette.description}
                      </span>
                    </span>
                  </button>
                );
              })}

              {/* Opção de Cor Customizada */}
              <button
                type="button"
                aria-pressed={isCustomMode}
                onClick={() => setSelectedPalette('custom')}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                  isCustomMode
                    ? 'border-accent-ring bg-accent-soft/60 ring-2 ring-accent-ring/20'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/70'
                }`}
              >
                <span
                  aria-hidden="true"
                  style={{
                    backgroundColor: normalizedCustomHex ?? savedSelection.primaryColor,
                    forcedColorAdjust: 'none',
                  }}
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/15 shadow-xs"
                >
                  {isCustomMode ? (
                    <Check
                      className="h-4 w-4"
                      style={{
                        color: previewTheme.foregroundColor,
                      }}
                    />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-white drop-shadow" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-gray-900">
                      Cor Customizada
                    </span>
                    <span className="font-mono text-[11px] uppercase text-gray-400">
                      HEX
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                    Use o manual de marca exato da igreja
                  </span>
                </span>
              </button>
            </div>
          </div>

          {isCustomMode && (
            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
                <div>
                  <label
                    htmlFor={customColorPickerId}
                    className="block text-xs font-semibold uppercase tracking-wide text-gray-700"
                  >
                    Seletor visual
                  </label>
                  <input
                    id={customColorPickerId}
                    type="color"
                    value={normalizedCustomHex ?? savedSelection.primaryColor}
                    onChange={(event) => {
                      setMessage(null);
                      setSelectedPalette('custom');
                      setCustomHexInput(event.target.value.toLowerCase());
                    }}
                    style={{ forcedColorAdjust: 'none' }}
                    className="mt-1.5 h-10 w-16 cursor-pointer rounded-lg border border-gray-300 bg-white p-1"
                  />
                </div>

                <div>
                  <label
                    htmlFor={customHexInputId}
                    className="block text-xs font-semibold uppercase tracking-wide text-gray-700"
                  >
                    Código HEX (#RRGGBB) *
                  </label>
                  <input
                    id={customHexInputId}
                    type="text"
                    value={customHexInput}
                    onChange={(event) => handleCustomHexChange(event.target.value)}
                    maxLength={7}
                    spellCheck={false}
                    autoCapitalize="none"
                    placeholder="#1d4ed8"
                    aria-invalid={!isCustomHexValid}
                    className={`mt-1.5 w-full rounded-xl border bg-white px-3 py-2 font-mono text-sm uppercase outline-none transition ${
                      isCustomHexValid
                        ? 'border-gray-200 focus:border-accent-ring focus:ring-2 focus:ring-accent-ring/20'
                        : 'border-red-300 text-red-700 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                    }`}
                  />
                </div>
              </div>

              {!isCustomHexValid && (
                <p className="text-xs font-medium text-red-600">
                  Formato inválido. Digite 6 dígitos hexadecimais após # (ex.: #1d4ed8).
                </p>
              )}
              {isCustomHexValid &&
                !THEME_HEX_REGEX.test(customHexInput.trim()) && (
                  <p className="text-xs text-gray-500">
                    Exemplo válido: #0f766e ou #7c3aed.
                  </p>
                )}
            </div>
          )}

          {message && (
            <p
              className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                message.type === 'error'
                  ? 'border-red-100 bg-red-50 text-red-700'
                  : 'border-emerald-100 bg-emerald-50 text-emerald-700'
              }`}
            >
              {message.text}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleResetDefault}
              disabled={saving || resetting || isDefaultSaved}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resetting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              <span>Restaurar padrão (Âmbar)</span>
            </button>

            <button
              type="submit"
              disabled={
                saving || resetting || !isCustomHexValid || !hasPendingChanges
              }
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{saving ? 'Salvando...' : 'Salvar identidade visual'}</span>
            </button>
          </div>
        </div>

        {/* Preview em Tempo Real */}
        <div
          style={previewStyle}
          className="flex flex-col justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Preview em tempo real
              </p>
              <span className="rounded-md bg-white px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-gray-700 shadow-2xs ring-1 ring-gray-200">
                {previewTheme.primaryColor}
              </span>
            </div>

            {/* Mini Sidebar Obsidiana + Área clara */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
              <div className="grid grid-cols-[116px_minmax(0,1fr)]">
                <div className="space-y-2 bg-[#09090b] p-2.5 text-zinc-200">
                  <p className="truncate text-[11px] font-bold text-white">
                    {tenant.nome}
                  </p>
                  <div
                    className="rounded-lg px-2 py-1.5 text-[11px] font-semibold"
                    style={{
                      backgroundColor: 'var(--theme-sidebar-active-bg)',
                      color: 'var(--theme-sidebar-active-text)',
                    }}
                  >
                    Painel Geral
                  </div>
                  <div className="rounded-lg px-2 py-1 text-[11px] text-zinc-400">
                    Escalas
                  </div>
                  <span
                    className="inline-block rounded-md px-2 py-0.5 text-[10px] font-bold"
                    style={{
                      backgroundColor: 'var(--theme-sidebar-badge-bg)',
                      color: 'var(--theme-sidebar-badge-text)',
                    }}
                  >
                    Membros
                  </span>
                </div>

                <div className="space-y-2.5 p-3">
                  <span
                    className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      backgroundColor: 'var(--theme-accent-soft)',
                      color: 'var(--theme-accent-ink)',
                      borderColor: 'var(--theme-accent-soft-border)',
                    }}
                  >
                    Badge em fundo claro
                  </span>
                  <p
                    className="text-xs font-semibold"
                    style={{ color: 'var(--theme-accent-ink)' }}
                  >
                    Link e destaque acessível
                  </p>
                  <button
                    type="button"
                    tabIndex={-1}
                    className="w-full rounded-lg px-3 py-1.5 text-xs font-semibold shadow-xs"
                    style={{
                      backgroundColor: 'var(--theme-brand)',
                      color: 'var(--theme-brand-foreground)',
                    }}
                  >
                    Botão Principal
                  </button>
                </div>
              </div>
            </div>

            {/* Mini Faixa Portal Público Escuro */}
            <div className="rounded-xl border border-zinc-800 bg-[#09090b] p-3.5 text-white">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ color: 'var(--site-accent-text)' }}
              >
                Portal Público &amp; Login
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-zinc-300">
                  {tenant.nome}
                </span>
                <span
                  className="shrink-0 rounded-full px-3 py-1 text-[11px] font-bold"
                  style={{
                    backgroundColor: 'var(--site-accent)',
                    color: 'var(--site-accent-foreground)',
                  }}
                >
                  Entrar
                </span>
              </div>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-gray-500">
            Contraste calculado automaticamente (WCAG AA ≥ 4.5:1) para textos sobre fundo claro, botões e áreas escuras.
          </p>
        </div>
      </form>
    </section>
  );
}
