import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Lista canonica de slugs reservados para rotas raiz do frontend,
 * APIs e arquivos especiais do Next.js.
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

@ValidatorConstraint({ name: 'notReservedSlug', async: false })
export class NotReservedSlugConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null || value === '') {
      return true;
    }

    if (typeof value !== 'string') {
      return false;
    }

    return !isReservedSlug(value);
  }

  defaultMessage(): string {
    return RESERVED_SLUG_ERROR_MESSAGE;
  }
}
