import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // INTERNAL_API_URL é avaliado em runtime (sem bake), ideal para Docker
        destination: `${process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
