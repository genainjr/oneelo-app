import type { AuthUser } from '@/types';
import { isReservedSlug, normalizeSlug } from './reserved-slugs';

/**
 * Resolve the login route for a tenant, falling back to the generic One Elo login
 * when no valid tenant slug is available.
 */
export function getTenantLoginPath(tenantSlug?: string | null): string {
  const cleanSlug = tenantSlug ? normalizeSlug(tenantSlug) : '';
  if (!cleanSlug || isReservedSlug(cleanSlug)) {
    return '/login';
  }
  return `/login?igreja=${encodeURIComponent(cleanSlug)}`;
}

export function isOnboardingEnabled() {
  return process.env.NEXT_PUBLIC_ONBOARDING_ENABLED === 'true';
}

export function isSafeAppRedirect(value: string | null | undefined) {
  if (!value) return false;
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//')) return false;

  const [pathname] = value.split('?');

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/login' ||
    pathname === '/login/social-link' ||
    pathname === '/admin/login' ||
    (pathname === '/onboarding' && !isOnboardingEnabled()) ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname === '/offline.html' ||
    /\.(?:jpg|jpeg|png|gif|svg|ico|webp|woff2?|webmanifest)$/.test(pathname)
  ) {
    return false;
  }

  return true;
}

export function hasLinkedMember(
  user?: Pick<AuthUser, 'memberId' | 'membro'> | null,
): boolean {
  return Boolean(user?.memberId || user?.membro?.id);
}

export function getPostLoginTarget(
  user: Pick<AuthUser, 'role' | 'onboardingCompletedAt'> &
    Partial<Pick<AuthUser, 'memberId' | 'membro'>>,
  redirect?: string | null,
) {
  if (isOnboardingEnabled() && !user.onboardingCompletedAt) {
    return '/onboarding';
  }

  const canUsePersonalPanel =
    user.role === 'BASIC' ||
    ((user.role === 'ADMIN' || user.role === 'STAFF') && hasLinkedMember(user));

  const fallback =
    user.role === 'SUPER_ADMIN'
      ? '/admin'
      : user.role === 'BASIC'
        ? '/personal-panel'
        : '/dashboard';
  const safeRedirect = isSafeAppRedirect(redirect) ? redirect : null;

  if (
    safeRedirect &&
    !(user.role === 'BASIC' && safeRedirect === '/dashboard') &&
    !(!canUsePersonalPanel && safeRedirect === '/personal-panel')
  ) {
    return safeRedirect;
  }

  return fallback;
}

