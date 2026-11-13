import { cache } from 'react';

export interface PublicTenantInfo {
  nome: string;
  slug: string;
  logoUrl?: string | null;
  pwaIconUrl?: string | null;
}

export const getPublicTenantInfoServer = cache(
  async (slug: string): Promise<PublicTenantInfo | null> => {
    const apiBase =
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:4001';

    try {
      const res = await fetch(
        `${apiBase}/api/public/tenants/${encodeURIComponent(slug)}`,
        {
          cache: 'no-store',
          signal: AbortSignal.timeout(8000),
        },
      );

      if (!res.ok) {
        return null;
      }

      return (await res.json()) as PublicTenantInfo;
    } catch {
      return null;
    }
  },
);
