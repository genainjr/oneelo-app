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
  it('direciona ADMIN e STAFF sempre para /dashboard por padrão (mesmo com membro vinculado)', () => {
    assert.equal(
      getPostLoginTarget({
        role: 'ADMIN',
        memberId: 'membro-1',
        onboardingCompletedAt: '2026-01-01T00:00:00Z',
      }),
      '/dashboard',
    );
    assert.equal(
      getPostLoginTarget({
        role: 'ADMIN',
        memberId: null,
        onboardingCompletedAt: '2026-01-01T00:00:00Z',
      }),
      '/dashboard',
    );
    assert.equal(
      getPostLoginTarget({
        role: 'STAFF',
        memberId: 'membro-2',
        onboardingCompletedAt: '2026-01-01T00:00:00Z',
      }),
      '/dashboard',
    );
    assert.equal(
      getPostLoginTarget({
        role: 'STAFF',
        memberId: null,
        onboardingCompletedAt: '2026-01-01T00:00:00Z',
      }),
      '/dashboard',
    );
  });

  it('direciona BASIC para /personal-panel e SUPER_ADMIN para /admin por padrão', () => {
    assert.equal(
      getPostLoginTarget({ role: 'BASIC', onboardingCompletedAt: '2026-01-01T00:00:00Z' }),
      '/personal-panel',
    );
    assert.equal(
      getPostLoginTarget({ role: 'SUPER_ADMIN', onboardingCompletedAt: '2026-01-01T00:00:00Z' }),
      '/admin',
    );
  });

  it('permite redirect explícito para /personal-panel só quando ADMIN/STAFF possui membro vinculado e bloqueia /dashboard para BASIC', () => {
    assert.equal(
      getPostLoginTarget(
        { role: 'ADMIN', memberId: 'membro-1', onboardingCompletedAt: '2026-01-01T00:00:00Z' },
        '/personal-panel',
      ),
      '/personal-panel',
    );
    assert.equal(
      getPostLoginTarget(
        { role: 'STAFF', memberId: null, onboardingCompletedAt: '2026-01-01T00:00:00Z' },
        '/personal-panel',
      ),
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
