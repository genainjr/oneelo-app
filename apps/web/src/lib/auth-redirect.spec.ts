import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPostLoginTarget, getTenantLoginPath } from './auth-redirect';

describe('getTenantLoginPath', () => {
  it('retorna /login?igreja=<slug> para slug válido normalizado', () => {
    assert.equal(getTenantLoginPath('ccrv'), '/login?igreja=ccrv');
    assert.equal(getTenantLoginPath('  CCRV  '), '/login?igreja=ccrv');
  });

  it('retorna /login genérico quando slug é vazio ou ausente', () => {
    assert.equal(getTenantLoginPath(null), '/login');
    assert.equal(getTenantLoginPath(undefined), '/login');
    assert.equal(getTenantLoginPath('   '), '/login');
  });

  it('retorna /login genérico quando slug é reservado', () => {
    assert.equal(getTenantLoginPath('login'), '/login');
    assert.equal(getTenantLoginPath('admin'), '/login');
    assert.equal(getTenantLoginPath('dashboard'), '/login');
  });
});

describe('getPostLoginTarget', () => {
  it('direciona ADMIN, STAFF e BASIC para /personal-panel por padrão', () => {
    assert.equal(
      getPostLoginTarget({ role: 'ADMIN', onboardingCompletedAt: '2026-01-01T00:00:00Z' }),
      '/personal-panel',
    );
    assert.equal(
      getPostLoginTarget({ role: 'STAFF', onboardingCompletedAt: '2026-01-01T00:00:00Z' }),
      '/personal-panel',
    );
    assert.equal(
      getPostLoginTarget({ role: 'BASIC', onboardingCompletedAt: '2026-01-01T00:00:00Z' }),
      '/personal-panel',
    );
  });

  it('direciona SUPER_ADMIN para /admin por padrão', () => {
    assert.equal(
      getPostLoginTarget({ role: 'SUPER_ADMIN', onboardingCompletedAt: '2026-01-01T00:00:00Z' }),
      '/admin',
    );
  });

  it('preserva redirect explícito seguro para ADMIN/STAFF e bloqueia /dashboard para BASIC', () => {
    assert.equal(
      getPostLoginTarget({ role: 'ADMIN', onboardingCompletedAt: '2026-01-01T00:00:00Z' }, '/dashboard'),
      '/dashboard',
    );
    assert.equal(
      getPostLoginTarget({ role: 'STAFF', onboardingCompletedAt: '2026-01-01T00:00:00Z' }, '/membros'),
      '/membros',
    );
    assert.equal(
      getPostLoginTarget({ role: 'BASIC', onboardingCompletedAt: '2026-01-01T00:00:00Z' }, '/dashboard'),
      '/personal-panel',
    );
    assert.equal(
      getPostLoginTarget({ role: 'BASIC', onboardingCompletedAt: '2026-01-01T00:00:00Z' }, '/minhas-escalas'),
      '/minhas-escalas',
    );
  });
});
