import type { Viewport } from 'next';
import { DashboardShell } from '@/components/app/dashboard-shell';
import { resolveServerTenantBrand } from '@/lib/server-tenant-brand';

export const viewport: Viewport = {
  themeColor: '#09090b',
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialTenantBrand = await resolveServerTenantBrand();

  return (
    <DashboardShell initialUser={null} initialTenantBrand={initialTenantBrand}>
      {children}
    </DashboardShell>
  );
}
