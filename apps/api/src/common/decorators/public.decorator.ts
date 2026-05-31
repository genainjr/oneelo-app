import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator que marca uma rota como pública,
 * isentando-a da verificação do JwtAuthGuard global.
 *
 * Uso: @Public() em qualquer controller ou handler
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
