import { ImageResponse } from 'next/og';
import { getPublicTenantInfoServer } from '@/components/public-site/join/tenant-public';
import { isReservedSlug, normalizeSlug } from '@/lib/reserved-slugs';

const IMAGE_SIZE = {
  width: 512,
  height: 512,
};

const SATORI_SUPPORTED_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif']);

async function fetchSupportedImageDataUri(url?: string | null): Promise<string | null> {
  if (!url) return null;

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const rawContentType = (res.headers.get('content-type') || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const contentType = rawContentType === 'image/jpg' ? 'image/jpeg' : rawContentType;
    if (!SATORI_SUPPORTED_MIMES.has(contentType)) {
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

function getChurchInitials(nome?: string | null): string {
  if (!nome) return 'IG';
  const words = nome
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-Z0-9]/i.test(w));
  if (words.length === 0) return 'IG';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const cleanSlug = normalizeSlug(slug);
  if (!cleanSlug || isReservedSlug(cleanSlug)) {
    return new Response('Not found', { status: 404 });
  }

  const tenant = await getPublicTenantInfoServer(cleanSlug);

  const logoDataUri =
    (await fetchSupportedImageDataUri(tenant?.logoUrl)) ||
    (await fetchSupportedImageDataUri(tenant?.pwaIconUrl));

  if (logoDataUri) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            padding: '40px',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoDataUri}
            alt={tenant?.nome || 'Logo da Igreja'}
            width={432}
            height={432}
            style={{
              width: '432px',
              height: '432px',
              objectFit: 'contain',
            }}
          />
        </div>
      ),
      {
        ...IMAGE_SIZE,
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=300',
        },
      },
    );
  }

  const initials = getChurchInitials(tenant?.nome);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)',
          color: '#ffffff',
          padding: '40px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '180px',
            height: '180px',
            borderRadius: '44px',
            backgroundColor: 'rgba(251, 191, 36, 0.14)',
            border: '3px solid rgba(251, 191, 36, 0.45)',
            color: '#fbbf24',
            fontSize: '72px',
            fontWeight: 700,
            letterSpacing: '-2px',
          }}
        >
          {initials}
        </div>
        {tenant?.nome ? (
          <div
            style={{
              marginTop: '32px',
              fontSize: '30px',
              fontWeight: 700,
              textAlign: 'center',
              lineHeight: 1.25,
              maxWidth: '420px',
              display: 'flex',
            }}
          >
            {tenant.nome}
          </div>
        ) : null}
      </div>
    ),
    {
      ...IMAGE_SIZE,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    },
  );
}
