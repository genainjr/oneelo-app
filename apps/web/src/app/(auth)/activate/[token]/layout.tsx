import type { Metadata } from 'next';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

type ActivationBranding = {
  tenant?: {
    nome: string;
    logoUrl?: string | null;
    pwaIconUrl?: string | null;
  } | null;
};

async function getActivationBranding(token: string): Promise<ActivationBranding | null> {
  try {
    const response = await fetch(
      `${API_BASE}/api/auth/activation/${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    );
    if (!response.ok) return null;
    return (await response.json()) as ActivationBranding;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const activation = await getActivationBranding(token);
  const tenantName = activation?.tenant?.nome?.trim() || 'One Elo';
  const tenantLogo = activation?.tenant?.logoUrl || activation?.tenant?.pwaIconUrl;
  const title = `Ative seu acesso à ${tenantName}`;
  const description = `Você recebeu um convite para acessar ${tenantName} pelo One Elo.`;

  return {
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: tenantLogo ? [{ url: tenantLogo, alt: tenantName }] : undefined,
    },
    twitter: {
      card: tenantLogo ? 'summary_large_image' : 'summary',
      title,
      description,
      images: tenantLogo ? [tenantLogo] : undefined,
    },
  };
}

export default function ActivationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
