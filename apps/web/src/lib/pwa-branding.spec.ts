import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canUseCachedTenantOnLogin,
  isStandalonePwaContext,
} from './pwa-branding';

describe('canUseCachedTenantOnLogin', () => {
  it('bloqueia uso do cache ao acessar /login diretamente no navegador sem ?igreja=', () => {
    assert.equal(
      canUseCachedTenantOnLogin({
        querySlug: null,
        sourceParam: null,
        isStandaloneDisplayMode: false,
      }),
      false,
    );
    assert.equal(
      canUseCachedTenantOnLogin({
        querySlug: '   ',
        sourceParam: undefined,
        isStandaloneDisplayMode: false,
      }),
      false,
    );
  });

  it('permite identificar igreja quando ha slug explicito na URL', () => {
    assert.equal(
      canUseCachedTenantOnLogin({
        querySlug: 'ccrv',
        sourceParam: null,
        isStandaloneDisplayMode: false,
      }),
      true,
    );
  });

  it('mantem fallback do cache quando aberto em modo PWA instalado ou com ?source=pwa', () => {
    assert.equal(
      canUseCachedTenantOnLogin({
        querySlug: null,
        sourceParam: null,
        isStandaloneDisplayMode: true,
      }),
      true,
    );
    assert.equal(
      canUseCachedTenantOnLogin({
        querySlug: null,
        sourceParam: 'pwa',
        isStandaloneDisplayMode: false,
      }),
      true,
    );
  });
});

describe('isStandalonePwaContext', () => {
  it('retorna true quando source=pwa sem depender de window', () => {
    assert.equal(isStandalonePwaContext('pwa'), true);
    assert.equal(isStandalonePwaContext(null), false);
  });

  it('detecta standalone via navigator.standalone ou matchMedia no browser', () => {
    const originalWindow = (globalThis as { window?: unknown }).window;

    try {
      (globalThis as { window?: unknown }).window = {
        navigator: { standalone: true },
        matchMedia: () => ({ matches: false }),
      };
      assert.equal(isStandalonePwaContext(null), true);

      (globalThis as { window?: unknown }).window = {
        navigator: { standalone: false },
        matchMedia: (query: string) => ({
          matches: query === '(display-mode: standalone)',
        }),
      };
      assert.equal(isStandalonePwaContext(null), true);

      (globalThis as { window?: unknown }).window = {
        navigator: { standalone: false },
        matchMedia: () => ({ matches: false }),
      };
      assert.equal(isStandalonePwaContext(null), false);
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = originalWindow;
      }
    }
  });
});
