import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator que define quais perfis têm acesso a determinada rota.
 *
 * Uso: @Roles(Role.ADMIN_GERAL, Role.PASTOR)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
