import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { FinanceRole, Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';

export type FinancePermissionSummary = {
  role: FinanceRole | null;
  hasManager: boolean;
  canBootstrap: boolean;
  canManage: boolean;
  canAccess: boolean;
};

@Injectable()
export class FinanceAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getPermissionSummary(
    tenantId: string,
    user: JwtPayload,
  ): Promise<FinancePermissionSummary> {
    const [permission, managerCount] = await Promise.all([
      this.prisma.financePermission.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.sub } },
        select: { role: true, revokedAt: true },
      }),
      this.countActiveManagers(tenantId),
    ]);

    const role = permission?.revokedAt ? null : (permission?.role ?? null);
    const canBootstrap = managerCount === 0 && user.role === Role.ADMIN;
    const canManage = role === FinanceRole.FINANCE_MANAGER;

    return {
      role,
      hasManager: managerCount > 0,
      canBootstrap,
      canManage,
      canAccess: Boolean(role) || canBootstrap,
    };
  }

  countActiveManagers(tenantId: string) {
    return this.prisma.financePermission.count({
      where: {
        tenantId,
        role: FinanceRole.FINANCE_MANAGER,
        revokedAt: null,
      },
    });
  }

  async ensureCanManagePermissions(
    tenantId: string,
    actor: JwtPayload,
    options: {
      mutation: boolean;
      requestedRole?: FinanceRole | null;
    },
  ) {
    const summary = await this.getPermissionSummary(tenantId, actor);
    if (summary.canManage) return summary;

    if (summary.canBootstrap) {
      if (!options.mutation) return summary;
      if (options.requestedRole !== FinanceRole.FINANCE_MANAGER) {
        throw new BadRequestException(
          'O setup inicial deve definir um Gestor financeiro.',
        );
      }
      return summary;
    }

    throw new ForbiddenException(
      'Acesso negado: permissão financeira insuficiente.',
    );
  }

  async ensureCanAccessFinance(tenantId: string, actor: JwtPayload) {
    const summary = await this.getPermissionSummary(tenantId, actor);
    if (summary.canAccess) return summary;

    throw new ForbiddenException(
      'Acesso negado: permissão financeira insuficiente.',
    );
  }

  async ensureCanAccessFinanceData(tenantId: string, actor: JwtPayload) {
    const summary = await this.getPermissionSummary(tenantId, actor);
    if (summary.role) return summary;

    throw new ForbiddenException(
      'Acesso negado: permissão financeira insuficiente.',
    );
  }

  async ensureFinanceManager(tenantId: string, actor: JwtPayload) {
    const summary = await this.getPermissionSummary(tenantId, actor);
    if (summary.canManage) return summary;

    throw new ForbiddenException(
      'Acesso negado: permissão financeira insuficiente.',
    );
  }

  async ensureFinanceRole(
    tenantId: string,
    actor: JwtPayload,
    allowedRoles: FinanceRole[],
  ) {
    const summary = await this.getPermissionSummary(tenantId, actor);
    if (summary.role && allowedRoles.includes(summary.role)) return summary;

    throw new ForbiddenException(
      'Acesso negado: permissão financeira insuficiente.',
    );
  }
}
