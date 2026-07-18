import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const ONEELO_MANIFEST = {
  name: 'One Elo',
  short_name: 'One Elo',
  description: 'One Elo - plataforma de gestao para igrejas da Lookup Labs.',
  id: '/dashboard',
  start_url: '/dashboard?source=pwa',
  scope: '/',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#0f2f73',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/maskable-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

const TENANT_MANIFEST_REVISION = '3';

@Injectable()
export class PwaService {
  constructor(private readonly prisma: PrismaService) {}

  async getManifest(slug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug, ativo: true },
      select: {
        id: true,
        nome: true,
        pwaShortName: true,
        pwaIconUrl: true,
        pwaIconKey: true,
        pwaUpdatedAt: true,
      },
    });

    if (
      !tenant?.pwaShortName ||
      !tenant.pwaIconUrl?.endsWith('/icon-512.png') ||
      !tenant.pwaIconKey?.endsWith('/icon-512.png') ||
      !tenant.pwaUpdatedAt
    ) {
      return { manifest: ONEELO_MANIFEST, version: 'oneelo' };
    }

    const iconBaseUrl = tenant.pwaIconUrl.slice(0, -'icon-512.png'.length);
    const version = `${tenant.pwaUpdatedAt.getTime()}-${TENANT_MANIFEST_REVISION}`;
    const versionedIcon = (url: string) => `${url}?v=${encodeURIComponent(version)}`;
    return {
      version,
      manifest: {
        ...ONEELO_MANIFEST,
        name: tenant.pwaShortName,
        short_name: tenant.pwaShortName,
        id: `/pwa/tenant/${tenant.id}`,
        icons: [
          { src: versionedIcon(`${iconBaseUrl}icon-192.png`), sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: versionedIcon(tenant.pwaIconUrl), sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: versionedIcon(`${iconBaseUrl}icon-maskable-512.png`),
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    };
  }
}
