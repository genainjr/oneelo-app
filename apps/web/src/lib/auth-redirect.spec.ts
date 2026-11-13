import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTenantLoginPath } from './auth-redirect';

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
