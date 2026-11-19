import { NextResponse } from 'next/server';

const oneEloManifest = {
  name: 'One Elo',
  short_name: 'One Elo',
  description: 'One Elo — plataforma de gestão para igrejas da Lookup Labs.',
  id: '/dashboard',
  start_url: '/dashboard?source=pwa',
  scope: '/',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#0f2f73',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    {
      src: '/maskable-icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};

export function GET() {
  return NextResponse.json(oneEloManifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  });
}
