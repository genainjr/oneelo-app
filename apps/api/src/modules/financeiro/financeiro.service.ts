import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AcaoAuditoria, FinanceRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { FinanceAuthorizationService } from './finance-authorization.service';

@Injectable()
export class FinanceiroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeAuthorization: FinanceAuthorizationService,
  ) {}

  async getPermissionSummary(tenantId: string, user: JwtPayload) {
    return this.financeAuthorization.getPermissionSummary(tenantId, user);
  }

  async listPermissions(tenantId: string, actor: JwtPayload) {
    await this.financeAuthorization.ensureCanManagePermissions(tenantId, actor, {
      mutation: false,
    });

    return this.prisma.financePermission.findMany({
      where: { tenantId, revokedAt: null },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            nome: true,
            email: true,
            role: true,
            status: true,
            ativo: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { user: { nome: 'asc' } }],
    });
  }

  async updateUserPermission(
    tenantId: string,
    targetUserId: string,
    role: FinanceRole | null | undefined,
    actor: JwtPayload,
    ip?: string,
  ) {
    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
      select: { id: true },
    });

    if (!targetUser) {
      throw new NotFoundException('Usuário não encontrado neste tenant.');
    }

    const normalizedRole = role ?? null;
    await this.financeAuthorization.ensureCanManagePermissions(tenantId, actor, {
      mutation: true,
      requestedRole: normalizedRole,
    });

    const existing = await this.prisma.financePermission.findUnique({
      where: { tenantId_userId: { tenantId, userId: targetUserId } },
      select: { role: true, revokedAt: true },
    });

    const managerCount =
      await this.financeAuthorization.countActiveManagers(tenantId);
    if (
      existing?.role === FinanceRole.FINANCE_MANAGER &&
      !existing.revokedAt &&
      managerCount <= 1 &&
      normalizedRole !== FinanceRole.FINANCE_MANAGER
    ) {
      throw new BadRequestException(
        'Não é possível remover o último gestor financeiro do tenant.',
      );
    }

    const before = existing && !existing.revokedAt ? existing.role : null;

    if (!normalizedRole) {
      if (existing) {
        await this.prisma.financePermission.update({
          where: { tenantId_userId: { tenantId, userId: targetUserId } },
          data: {
            revokedAt: new Date(),
            updatedByUserId: actor.sub,
          },
        });
      }

      await this.auditPermissionChange(
        tenantId,
        actor.sub,
        targetUserId,
        before,
        null,
        ip,
      );

      return { userId: targetUserId, role: null };
    }

    const updated = await this.prisma.financePermission.upsert({
      where: { tenantId_userId: { tenantId, userId: targetUserId } },
      create: {
        tenantId,
        userId: targetUserId,
        role: normalizedRole,
        createdByUserId: actor.sub,
        updatedByUserId: actor.sub,
      },
      update: {
        role: normalizedRole,
        revokedAt: null,
        updatedByUserId: actor.sub,
      },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditPermissionChange(
      tenantId,
      actor.sub,
      targetUserId,
      before,
      updated.role,
      ip,
    );

    return updated;
  }

  private async auditPermissionChange(
    tenantId: string,
    actorId: string,
    targetUserId: string,
    before: FinanceRole | null,
    after: FinanceRole | null,
    ip?: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        entidade: 'finance_permissions',
        entidadeId: targetUserId,
        acao: AcaoAuditoria.ATUALIZAR,
        ipAddress: ip ?? null,
        payloadBefore: { role: before },
        payloadAfter: { role: after },
      },
    });
  }
}
