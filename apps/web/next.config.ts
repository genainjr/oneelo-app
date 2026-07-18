import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .map((origin) => origin.replace(/^https?:\/\//, '').replace(/:\d+$/, ''))
  .filter(Boolean);

const nextConfig: NextConfig = {
  // PWA metadata must be present in the initial <head>; browsers may inspect it
  // before streamed metadata is appended to the document body.
  htmlLimitedBots: /.*/,
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
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
