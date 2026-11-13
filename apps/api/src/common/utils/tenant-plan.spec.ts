import { Plano } from '@prisma/client';
import {
  canAddMember,
  canUseCustomDomain,
  getDefaultStoredMemberLimit,
  getEffectiveMemberLimit,
  isUnlimitedMembers,
  LIMITES_MEMBROS_POR_PLANO,
  DEFAULT_UNLIMITED_STORED_LIMIT,
} from './tenant-plan';

describe('tenant-plan utils', () => {
  describe('canUseCustomDomain', () => {
    it('deve permitir domínio próprio apenas para o plano PROFISSIONAL', () => {
      expect(canUseCustomDomain(Plano.PROFISSIONAL)).toBe(true);
      expect(canUseCustomDomain(Plano.BASICO)).toBe(false);
      expect(canUseCustomDomain(Plano.GRATUITO)).toBe(false);
    });
  });

  describe('getDefaultStoredMemberLimit', () => {
    it('deve retornar 50 para GRATUITO', () => {
      expect(getDefaultStoredMemberLimit(Plano.GRATUITO)).toBe(50);
    });

    it('deve retornar 200 para BASICO', () => {
      expect(getDefaultStoredMemberLimit(Plano.BASICO)).toBe(200);
    });

    it('deve retornar 999999 para PROFISSIONAL', () => {
      expect(getDefaultStoredMemberLimit(Plano.PROFISSIONAL)).toBe(DEFAULT_UNLIMITED_STORED_LIMIT);
    });
  });

  describe('isUnlimitedMembers', () => {
    it('deve retornar true apenas para PROFISSIONAL', () => {
      expect(isUnlimitedMembers(Plano.PROFISSIONAL)).toBe(true);
      expect(isUnlimitedMembers(Plano.BASICO)).toBe(false);
      expect(isUnlimitedMembers(Plano.GRATUITO)).toBe(false);
    });
  });

  describe('getEffectiveMemberLimit', () => {
    it('deve retornar null para PROFISSIONAL mesmo com limiteMembros numerico legado no banco', () => {
      expect(getEffectiveMemberLimit({ plano: Plano.PROFISSIONAL, limiteMembros: 50 })).toBeNull();
      expect(getEffectiveMemberLimit({ plano: Plano.PROFISSIONAL, limiteMembros: 200 })).toBeNull();
      expect(getEffectiveMemberLimit({ plano: Plano.PROFISSIONAL, limiteMembros: null })).toBeNull();
      expect(getEffectiveMemberLimit({ plano: Plano.PROFISSIONAL })).toBeNull();
    });

    it('deve retornar o limite padrão para GRATUITO (50)', () => {
      expect(getEffectiveMemberLimit({ plano: Plano.GRATUITO, limiteMembros: 50 })).toBe(50);
      expect(getEffectiveMemberLimit({ plano: Plano.GRATUITO, limiteMembros: null })).toBe(50);
      expect(getEffectiveMemberLimit({ plano: Plano.GRATUITO })).toBe(50);
    });

    it('deve respeitar override maior que o padrão para GRATUITO', () => {
      expect(getEffectiveMemberLimit({ plano: Plano.GRATUITO, limiteMembros: 80 })).toBe(80);
    });

    it('deve retornar o limite padrão para BASICO (200), corrigindo valores legados inferiores a 200', () => {
      expect(getEffectiveMemberLimit({ plano: Plano.BASICO, limiteMembros: 50 })).toBe(200);
      expect(getEffectiveMemberLimit({ plano: Plano.BASICO, limiteMembros: null })).toBe(200);
      expect(getEffectiveMemberLimit({ plano: Plano.BASICO })).toBe(200);
    });

    it('deve respeitar override maior que o padrão para BASICO', () => {
      expect(getEffectiveMemberLimit({ plano: Plano.BASICO, limiteMembros: 350 })).toBe(350);
    });
  });

  describe('canAddMember', () => {
    describe('Plano PROFISSIONAL', () => {
      it('sempre deve permitir adicionar novos membros independentemente da contagem atual', () => {
        expect(canAddMember({ plano: Plano.PROFISSIONAL, limiteMembros: 50 }, 0)).toBe(true);
        expect(canAddMember({ plano: Plano.PROFISSIONAL, limiteMembros: 50 }, 50)).toBe(true);
        expect(canAddMember({ plano: Plano.PROFISSIONAL, limiteMembros: 50 }, 500)).toBe(true);
        expect(canAddMember({ plano: Plano.PROFISSIONAL, limiteMembros: 50 }, 5000)).toBe(true);
      });
    });

    describe('Plano GRATUITO (limite 50)', () => {
      it('deve permitir quando abaixo do limite', () => {
        expect(canAddMember({ plano: Plano.GRATUITO }, 49)).toBe(true);
        expect(canAddMember({ plano: Plano.GRATUITO }, 0)).toBe(true);
      });

      it('deve bloquear quando atingir ou superar o limite', () => {
        expect(canAddMember({ plano: Plano.GRATUITO }, 50)).toBe(false);
        expect(canAddMember({ plano: Plano.GRATUITO }, 51)).toBe(false);
      });

      it('deve respeitar override contratual maior', () => {
        const tenant = { plano: Plano.GRATUITO, limiteMembros: 75 };
        expect(canAddMember(tenant, 50)).toBe(true);
        expect(canAddMember(tenant, 74)).toBe(true);
        expect(canAddMember(tenant, 75)).toBe(false);
      });
    });

    describe('Plano BASICO (limite 200)', () => {
      it('deve permitir quando abaixo de 200 mesmo se limiteMembros legado for 50', () => {
        const tenant = { plano: Plano.BASICO, limiteMembros: 50 };
        expect(canAddMember(tenant, 50)).toBe(true);
        expect(canAddMember(tenant, 199)).toBe(true);
      });

      it('deve bloquear quando atingir ou superar 200', () => {
        const tenant = { plano: Plano.BASICO, limiteMembros: 50 };
        expect(canAddMember(tenant, 200)).toBe(false);
        expect(canAddMember(tenant, 201)).toBe(false);
      });

      it('deve respeitar override contratual maior que 200', () => {
        const tenant = { plano: Plano.BASICO, limiteMembros: 300 };
        expect(canAddMember(tenant, 200)).toBe(true);
        expect(canAddMember(tenant, 299)).toBe(true);
        expect(canAddMember(tenant, 300)).toBe(false);
      });
    });
  });
});
