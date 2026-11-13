import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { isReservedSlug, normalizeSlug } from '@/lib/reserved-slugs';

const AUTH_COOKIE = 'access_token';

function decodeJwtRole(token: string): string | null {
  try {
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return null;
    const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    const decoded = JSON.parse(json) as { role?: string };
    return decoded.role ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  }

  const role = decodeJwtRole(token);
  if (role !== 'ADMIN' && role !== 'STAFF') {
    return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
  }

  let body: { slug?: string; noticiaSlug?: string } = {};
  try {
    body = (await request.json()) as { slug?: string; noticiaSlug?: string };
  } catch {
    body = {};
  }

  const cleanSlug = body.slug ? normalizeSlug(body.slug) : '';
  if (!cleanSlug || isReservedSlug(cleanSlug)) {
    return NextResponse.json({ revalidated: false });
  }

  revalidateTag(`site-${cleanSlug}`, { expire: 0 });
  revalidatePath(`/${cleanSlug}`, 'layout');
  revalidatePath(`/${cleanSlug}`);

  if (body.noticiaSlug) {
    const cleanNewsSlug = normalizeSlug(body.noticiaSlug);
    if (cleanNewsSlug) {
      revalidatePath(`/${cleanSlug}/noticias/${cleanNewsSlug}`);
    }
  }

  return NextResponse.json({ revalidated: true, slug: cleanSlug });
}
