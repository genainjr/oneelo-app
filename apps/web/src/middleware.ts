import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE = 'access_token';

// Rotas públicas (não precisam de autenticação)
const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permite rotas públicas, assets do Next.js e arquivos estáticos
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    /\.(?:jpg|jpeg|png|gif|svg|ico|webp|woff2?)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Verifica se tem o cookie JWT
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:jpg|jpeg|png|gif|svg|ico|webp|woff2?)$).*)'],
};
