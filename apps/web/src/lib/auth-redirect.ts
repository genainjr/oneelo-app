import type { AuthUser } from '@/types';

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
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname === '/offline.html' ||
    /\.(?:jpg|jpeg|png|gif|svg|ico|webp|woff2?|webmanifest)$/.test(pathname)
  ) {
    return false;
  }

  return true;
}

export function getPostLoginTarget(user: Pick<AuthUser, 'role'>, redirect?: string | null) {
  const fallback = user.role === 'BASIC' ? '/personal-panel' : '/dashboard';
  const safeRedirect = isSafeAppRedirect(redirect) ? redirect : null;

  if (safeRedirect && !(user.role === 'BASIC' && safeRedirect === '/dashboard')) {
    return safeRedirect;
  }

  return fallback;
}

