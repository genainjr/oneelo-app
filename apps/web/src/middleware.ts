import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { locales, defaultLocale, type Locale } from './i18n/config';

const AUTH_COOKIE = 'access_token';
const LOCALE_COOKIE = 'NEXT_LOCALE';

const PUBLIC_PATHS = ['/login', '/locale'];

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    /\.(?:jpg|jpeg|png|gif|svg|ico|webp|woff2?)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
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
