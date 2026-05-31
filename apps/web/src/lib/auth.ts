import { AuthUser } from '@/types';

const AUTH_COOKIE = 'access_token';

/**
 * Decodifica o payload do JWT sem verificar a assinatura.
 * A verificação real acontece no backend.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Adiciona padding base64 se necessário
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Lê o cookie JWT do documento (client-side).
 * Retorna null se não encontrado.
 */
export function getTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split('=');
    if (key === AUTH_COOKIE) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

/**
 * Decodifica o usuário atual a partir do cookie JWT (client-side).
 * Retorna null se não autenticado ou token inválido.
 */
export function getCurrentUser(): AuthUser | null {
  const token = getTokenFromCookie();
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  // Verifica expiração
  if (payload.exp && typeof payload.exp === 'number') {
    if (Date.now() / 1000 > payload.exp) return null;
  }

  return {
    id: payload.sub as string,
    tenantId: payload.tenantId as string,
    nome: payload.nome as string,
    email: payload.email as string,
    role: payload.role as AuthUser['role'],
  };
}

/**
 * Verifica se o usuário tem um dos roles permitidos.
 */
export function hasRole(user: AuthUser | null, ...roles: AuthUser['role'][]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

/**
 * Roles que têm acesso ao dashboard completo
 */
export const ADMIN_ROLES: AuthUser['role'][] = [
  'ADMIN_GERAL',
  'PASTOR',
  'SECRETARIO',
];
