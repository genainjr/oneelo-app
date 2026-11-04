import { Plano } from '@prisma/client';

export const LIMITES_MEMBROS_POR_PLANO: Record<Plano, number | null> = {
  GRATUITO: 50,
  BASICO: 200,
  PROFISSIONAL: null, // Ilimitado
};

export interface TenantPlanData {
  plano: Plano;
  limiteMembros?: number | null;
}

/**
 * Determina se o plano do tenant possui membros ilimitados.
 */
export function isUnlimitedMembers(plano: Plano): boolean {
  return LIMITES_MEMBROS_POR_PLANO[plano] === null;
}

/**
 * Retorna o limite efetivo de membros para um tenant.
 * - Plano PROFISSIONAL: sempre retorna null (ilimitado), independentemente de valores legados em limiteMembros.
 * - Outros planos: utiliza o teto padrão do plano. Se limiteMembros for maior que o padrão (override contratual),
 *   respeita o valor maior.
 */
export function getEffectiveMemberLimit(tenant: TenantPlanData): number | null {
  if (isUnlimitedMembers(tenant.plano)) {
    return null;
  }

  const defaultLimit = LIMITES_MEMBROS_POR_PLANO[tenant.plano] ?? 50;

  if (typeof tenant.limiteMembros === 'number' && tenant.limiteMembros > defaultLimit) {
    return tenant.limiteMembros;
  }

  return defaultLimit;
}

/**
 * Valida se é permitido adicionar um novo membro com base na quantidade atual de membros ativos.
 */
export function canAddMember(tenant: TenantPlanData, currentActiveCount: number): boolean {
  const limit = getEffectiveMemberLimit(tenant);
  if (limit === null) {
    return true;
  }
  return currentActiveCount < limit;
}
