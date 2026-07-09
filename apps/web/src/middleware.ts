import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { locales, defaultLocale, type Locale } from './i18n/config';

const AUTH_COOKIE = 'access_token';
const LOCALE_COOKIE = 'NEXT_LOCALE';

const PUBLIC_PATHS = ['/', '/login', '/locale', '/admin/login'];

function detectLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }

  const acceptLang = request.headers.get('accept-language') || '';
  for (const locale of locales) {
    const lang = locale.toLowerCase();
    if (acceptLang.toLowerCase().includes(lang) ||
        acceptLang.toLowerCase().includes(lang.substring(0, 2))) {
      return locale;
    }
  }

  return defaultLocale;
}

function decodeJwtRole(token: string): string | null {
  try {
    const payloadB64 = token.split('.')[1];
    const decoded = JSON.parse(atob(payloadB64));
    return decoded.role ?? null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p || (p !== '/' && pathname.startsWith(p))) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    /\.(?:jpg|jpeg|png|gif|svg|ico|webp|woff2?)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (!token) {
    const isAdminRoute = pathname.startsWith('/admin');
    const loginUrl = new URL(isAdminRoute ? '/admin/login' : '/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = decodeJwtRole(token);
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isBasic = role === 'BASIC';

  // SUPER_ADMIN fora de /admin → redireciona para o painel admin
  if (isSuperAdmin && !pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // Usuário comum tentando acessar /admin → redireciona para dashboard
  if (!isSuperAdmin && pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (isBasic) {
    const blockedBasicPaths = [
      '/dashboard',
      '/membros',
      '/configuracoes',
      '/financeiro',
      '/grupos',
      '/integracoes',
    ];
    const isBlocked = blockedBasicPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

    if (isBlocked) {
      return NextResponse.redirect(new URL('/personal-panel', request.url));
    }
  }

  const response = NextResponse.next();

  if (!request.cookies.get(LOCALE_COOKIE)) {
    const locale = detectLocale(request);
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:jpg|jpeg|png|gif|svg|ico|webp|woff2?)$).*)'],
};
