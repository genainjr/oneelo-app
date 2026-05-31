import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator que extrai o usuário autenticado do request.
 * Populado pelo JwtAuthGuard após validação do cookie JWT.
 *
 * Uso: @CurrentUser() user: JwtPayload
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
