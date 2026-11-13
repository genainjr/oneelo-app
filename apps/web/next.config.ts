import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .map((origin) => origin.replace(/^https?:\/\//, '').replace(/:\d+$/, ''))
  .filter(Boolean);

function resolveSupabaseHostname(): string | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!rawUrl) return null;

  try {
    return new URL(rawUrl).hostname;
  } catch {
    return null;
  }
}

const supabaseHostname = resolveSupabaseHostname();

const remotePatterns: NonNullable<NextConfig['images']>['remotePatterns'] = [
  {
    protocol: 'https',
    hostname: '**.supabase.co',
    pathname: '/storage/v1/object/public/**',
  },
  {
    protocol: 'https',
    hostname: '**.supabase.in',
    pathname: '/storage/v1/object/public/**',
  },
  ...(supabaseHostname
    ? [
        {
          protocol: 'https' as const,
          hostname: supabaseHostname,
          pathname: '/storage/v1/object/public/**',
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // PWA metadata must be present in the initial <head>; browsers may inspect it
  // before streamed metadata is appended to the document body.
  htmlLimitedBots: /.*/,
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  images: {
    remotePatterns,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
