import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TENANT_BRAND_COOKIE,
  buildClearTenantBrandCookieString,
  buildTenantBrandCookieString,
  parseTenantBrandCookie,
  serializeTenantBrandCookie,
} from './tenant-brand-cookie';

describe('tenant-brand-cookie', () => {
  it('serializa e analisa JSON puro e URI-encoded corretamente', () => {
    const serialized = serializeTenantBrandCookie({
      slug: 'ccrv',
      nome: 'Comunidade Cristã Resgate de Vida',
      logoUrl: 'https://cdn.example.com/logo.png',
      pwaIconUrl: null,
      themePalette: 'royal-blue',
      primaryColor: '#1d4ed8',
    });

    assert.ok(serialized);
    const encoded = encodeURIComponent(serialized);

    const expected = {
      slug: 'ccrv',
      nome: 'Comunidade Cristã Resgate de Vida',
      logoUrl: 'https://cdn.example.com/logo.png',
      pwaIconUrl: null,
      themePalette: 'royal-blue',
      primaryColor: '#1d4ed8',
    };

    assert.deepEqual(parseTenantBrandCookie(serialized), expected);
    assert.deepEqual(parseTenantBrandCookie(encoded), expected);
  });

  it('rejeita payloads corrompidos ou sem slug/nome válidos', () => {
    assert.equal(parseTenantBrandCookie(null), null);
    assert.equal(parseTenantBrandCookie(''), null);
    assert.equal(parseTenantBrandCookie('not-json'), null);
    assert.equal(parseTenantBrandCookie('%E0%A4%A'), null);
    assert.equal(parseTenantBrandCookie(JSON.stringify({ slug: '', nome: 'Igreja' })), null);
    assert.equal(parseTenantBrandCookie(JSON.stringify({ slug: 'ccrv' })), null);
  });

  it('gera strings Set-Cookie corretas para escrita e limpeza', () => {
    const cookieStr = buildTenantBrandCookieString(
      {
        slug: 'ccrv',
        nome: 'CCRV',
        themePalette: 'emerald-green',
        primaryColor: '#059669',
      },
      true,
    );
    assert.ok(cookieStr?.startsWith(`${TENANT_BRAND_COOKIE}=`));
    assert.ok(cookieStr?.includes('Path=/'));
    assert.ok(cookieStr?.includes('SameSite=Lax'));
    assert.ok(cookieStr?.includes('Secure'));

    const clearStr = buildClearTenantBrandCookieString(false);
    assert.equal(clearStr, `${TENANT_BRAND_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`);
  });
});
