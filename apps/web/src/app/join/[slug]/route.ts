import { NextRequest, NextResponse } from 'next/server';
import { isReservedSlug, normalizeSlug } from '@/lib/reserved-slugs';

export function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  return context.params.then(({ slug }) => {
    const cleanSlug = normalizeSlug(slug || '');
    if (!cleanSlug || isReservedSlug(cleanSlug)) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    const destination = new URL(`/${encodeURIComponent(cleanSlug)}/cadastro`, request.url);
    destination.search = request.nextUrl.search;
    return NextResponse.redirect(destination, 301);
  });
}
