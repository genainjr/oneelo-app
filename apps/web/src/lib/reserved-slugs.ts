/**
 * Lista canonica de slugs reservados para rotas raiz do frontend,
 * APIs e arquivos especiais do Next.js.
 * Deve permanecer sincronizada com apps/api/src/common/constants/reserved-slugs.ts.
 */
export const RESERVED_SLUGS = [
  '_next',
  'activate',
  'admin',
  'agenda',
  'api',
  'app',
  'assets',
  'auth',
  'cadastro',
  'configuracoes',
  'dashboard',
  'documentos',
  'escalas',
  'favicon.ico',
  'financeiro',
  'grupos',
  'health',
  'integracoes',
  'join',
  'locale',
  'login',
  'manifest.webmanifest',
  'membros',
  'meu-perfil',
  'minhas-escalas',
  'ministerios',
  'noticias',
  'offline.html',
  'og',
  'onboarding',
  'personal-panel',
  'public',
  'resolve',
  'robots.txt',
  'site',
  'sitemap.xml',
  'static',
  'status',
  'sw.js',
  'validar-carteirinha',
  'www',
] as const;

const RESERVED_SLUG_SET = new Set<string>(RESERVED_SLUGS);

export const RESERVED_SLUG_ERROR_MESSAGE =
  'Este slug é reservado pelo sistema e não pode ser utilizado.';

export function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

export function isReservedSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') {
    return false;
  }

  return RESERVED_SLUG_SET.has(normalizeSlug(slug));
}

export function isPublicWebsitePath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return false;
  }

  const slug = decodeURIComponent(segments[0]);
  if (!slug || isReservedSlug(slug)) {
    return false;
  }

  if (segments.length === 1) {
    return true;
  }

  if (segments.length === 2 && (segments[1] === 'cadastro' || segments[1] === 'og')) {
    return true;
  }

  if (segments.length === 3 && segments[1] === 'noticias' && segments[2].length > 0) {
    return true;
  }

  return false;
}
