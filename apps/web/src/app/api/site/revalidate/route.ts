import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { isReservedSlug, normalizeSlug } from '@/lib/reserved-slugs';

const AUTH_COOKIE = 'access_token';

function getServerApiBase(): string {
  return (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4001'
  ).replace(/\/+$/, '');
}

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

async function isAuthorizedFinanceManager(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${getServerApiBase()}/api/financeiro/permissions/me`, {
      method: 'GET',
      headers: {
        Cookie: `${AUTH_COOKIE}=${token}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { canManage?: boolean };
    return Boolean(data?.canManage);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  }

  const role = decodeJwtRole(token);
  const hasGlobalSitePermission = role === 'ADMIN' || role === 'STAFF';
  const hasFinanceManagerPermission = hasGlobalSitePermission
    ? false
    : await isAuthorizedFinanceManager(token);

  if (!hasGlobalSitePermission && !hasFinanceManagerPermission) {
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
