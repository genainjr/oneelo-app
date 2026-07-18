import { cache } from 'react';
import { cookies } from 'next/headers';
import type { AuthUser } from '@/types';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export const getServerAuthUser = cache(async (): Promise<AuthUser | null> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token');
  if (!accessToken) return null;

  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { cookie: `${accessToken.name}=${accessToken.value}` },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as AuthUser;
  } catch {
    return null;
  }
});
