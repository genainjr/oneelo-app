import type { Metadata } from 'next';
import { DashboardShell } from '@/components/app/dashboard-shell';
import { getServerAuthUser } from '@/lib/server-auth';
import { TENANT_MANIFEST_REVISION } from '@/lib/pwa-branding';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const user = await getServerAuthUser();
  const tenant = user?.tenant;
  const hasCustomPwa = Boolean(
    tenant?.pwaShortName && tenant.pwaIconUrl && tenant.pwaIconKey && tenant.pwaUpdatedAt,
  );
  if (!tenant || !hasCustomPwa) return {};

  const version = encodeURIComponent(`${tenant.pwaUpdatedAt!}:${TENANT_MANIFEST_REVISION}`);
  const manifest = `/api/pwa/${encodeURIComponent(tenant.slug)}/manifest.webmanifest?v=${version}`;
  const appleIcon = tenant.pwaIconUrl!.replace(/icon-512\.png$/, 'icon-180.png');

  return {
    applicationName: tenant.pwaShortName!,
    title: { default: tenant.nome, template: `%s | ${tenant.nome}` },
    manifest,
    appleWebApp: { capable: true, title: tenant.pwaShortName!, statusBarStyle: 'default' },
    icons: { apple: [{ url: appleIcon, sizes: '180x180', type: 'image/png' }] },
  };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerAuthUser();
  return <DashboardShell initialUser={user}>{children}</DashboardShell>;
}
