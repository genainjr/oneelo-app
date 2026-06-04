import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MinistryRole, Role } from '@prisma/client';
import { MINISTRY_ROLES_KEY } from '../decorators/ministry-roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../types/jwt-payload.interface';

@Injectable()
export class MinistryGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<MinistryRole[]>(
      MINISTRY_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Se não definiu ministry roles, permite (guard não se aplica)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    if (!user) {
      throw new ForbiddenException('Acesso negado: usuário não autenticado.');
    }

    // ADMIN e STAFF têm acesso total — bypass do ministry check
    if (user.role === Role.ADMIN || user.role === Role.STAFF) {
      return true;
    }

    // Extrair ministerioId da rota (param ou body)
    const ministerioId =
      request.params.ministerioId ||
      request.params.id ||
      request.body?.ministerioId;

    if (!ministerioId) {
      throw new ForbiddenException(
        'Acesso negado: ministério não identificado na requisição.',
      );
    }

    // Verificar se o user tem memberId
    if (!user.memberId) {
      throw new ForbiddenException(
        'Acesso negado: usuário não está vinculado a um membro.',
      );
    }

    // Buscar role do membro no ministério
    const membership = await this.prisma.ministerioMembro.findUnique({
      where: {
        ministerioId_membroId: {
          ministerioId,
          membroId: user.memberId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'Acesso negado: você não participa deste ministério.',
      );
    }

    const hasRole = requiredRoles.includes(membership.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Acesso negado: sua função '${membership.role}' não possui permissão para esta ação.`,
      );
    }

    return true;
  }
}
