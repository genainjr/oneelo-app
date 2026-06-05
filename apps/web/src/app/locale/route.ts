import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale, type Locale } from '@/i18n/config';

export async function POST(request: NextRequest) {
  const { locale } = await request.json();
  const validLocale: Locale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;

  const response = NextResponse.json({ ok: true });
  response.cookies.set('NEXT_LOCALE', validLocale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
