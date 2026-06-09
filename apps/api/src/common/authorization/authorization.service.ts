import { ForbiddenException, Injectable } from '@nestjs/common';
import { MinistryRole, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../types/jwt-payload.interface';

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  canManageTenant(user: JwtPayload): boolean {
    return user.role === Role.ADMIN || user.role === Role.STAFF;
  }

  async isMinistryLeader(
    user: JwtPayload,
    ministerioId: string,
  ): Promise<boolean> {
    if (!user.memberId) return false;

    const membership = await this.prisma.ministerioMembro.findUnique({
      where: {
        ministerioId_membroId: {
          ministerioId,
          membroId: user.memberId,
        },
      },
    });

    return (
      membership?.role === MinistryRole.LEADER ||
      membership?.role === MinistryRole.ASSISTANT_LEADER
    );
  }

  async canManageMinistry(
    user: JwtPayload,
    ministerioId: string,
  ): Promise<boolean> {
    if (this.canManageTenant(user)) return true;
    if (user.role !== Role.BASIC) return false;
    return this.isMinistryLeader(user, ministerioId);
  }

  async assertCanManageMinistry(
    user: JwtPayload,
    ministerioId: string,
  ): Promise<void> {
    const canManage = await this.canManageMinistry(user, ministerioId);

    if (!canManage) {
      throw new ForbiddenException('Acesso negado: você não lidera este ministério.');
    }
  }
}
