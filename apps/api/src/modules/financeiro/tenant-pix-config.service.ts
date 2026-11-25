import { BadRequestException, Injectable } from '@nestjs/common';
import { AcaoAuditoria, FinancialCategoryType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { UpsertTenantPixConfigDto } from './dto/upsert-tenant-pix-config.dto';
import { FinanceAuthorizationService } from './finance-authorization.service';
import {
  generatePixBrCode,
  normalizeAndValidatePixKey,
  normalizePixMerchantCity,
  normalizePixMerchantName,
  normalizePixTxid,
  sanitizeEmvAsciiText,
} from './pix-brcode.util';

@Injectable()
export class TenantPixConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeAuthorization: FinanceAuthorizationService,
  ) {}

  async getConfig(tenantId: string, actor: JwtPayload) {
    await this.financeAuthorization.ensureCanAccessFinanceData(tenantId, actor);
    return this.loadConfigResponse(tenantId);
  }

  async upsertConfig(
    tenantId: string,
    actor: JwtPayload,
    dto: UpsertTenantPixConfigDto,
    ip?: string,
  ) {
    await this.financeAuthorization.ensureFinanceManager(tenantId, actor);

    const account = await this.prisma.financialAccount.findFirst({
      where: { id: dto.defaultAccountId, tenantId, active: true },
      select: { id: true, name: true, type: true, active: true },
    });

    if (!account) {
      throw new BadRequestException(
        'Conta financeira padrão inválida ou inativa. Selecione uma conta ativa.',
      );
    }

    const normalizedKey = normalizeAndValidatePixKey(dto.pixKeyType, dto.pixKey);
    const merchantName = normalizePixMerchantName(dto.merchantName);
    const merchantCity = normalizePixMerchantCity(dto.merchantCity);
    const rawTxid = dto.txidPrefix?.trim() || null;
    if (rawTxid) {
      normalizePixTxid(rawTxid);
    }

    // Garante validação completa do payload BRCode antes de persistir
    generatePixBrCode({
      pixKeyType: dto.pixKeyType,
      pixKey: normalizedKey,
      merchantName,
      merchantCity,
      txidPrefix: rawTxid,
    });

    const existing = await this.prisma.tenantPixConfig.findUnique({
      where: { tenantId },
    });

    const saved = await this.prisma.tenantPixConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        enabled: dto.enabled,
        showOnPublicSite: dto.showOnPublicSite,
        pixKeyType: dto.pixKeyType,
        pixKey: normalizedKey,
        merchantName,
        merchantCity,
        txidPrefix: rawTxid,
        defaultAccountId: account.id,
        updatedByUserId: actor.sub,
      },
      update: {
        enabled: dto.enabled,
        showOnPublicSite: dto.showOnPublicSite,
        pixKeyType: dto.pixKeyType,
        pixKey: normalizedKey,
        merchantName,
        merchantCity,
        txidPrefix: rawTxid,
        defaultAccountId: account.id,
        updatedByUserId: actor.sub,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actor.sub,
        entidade: 'tenant_pix_config',
        entidadeId: saved.id,
        acao: existing ? AcaoAuditoria.ATUALIZAR : AcaoAuditoria.CRIAR,
        ipAddress: ip ?? null,
        payloadBefore: existing
          ? {
              enabled: existing.enabled,
              showOnPublicSite: existing.showOnPublicSite,
              pixKeyType: existing.pixKeyType,
              defaultAccountId: existing.defaultAccountId,
            }
          : undefined,
        payloadAfter: {
          enabled: saved.enabled,
          showOnPublicSite: saved.showOnPublicSite,
          pixKeyType: saved.pixKeyType,
          defaultAccountId: saved.defaultAccountId,
        },
      },
    });

    return this.loadConfigResponse(tenantId);
  }

  private async loadConfigResponse(tenantId: string) {
    const [config, tenant, websiteConfig, visibleIncomeCategoriesCount] = await Promise.all([
      this.prisma.tenantPixConfig.findUnique({
        where: { tenantId },
        include: {
          defaultAccount: {
            select: { id: true, name: true, type: true, active: true },
          },
        },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { nome: true, slug: true },
      }),
      this.prisma.tenantWebsiteConfig.findUnique({
        where: { tenantId },
        select: { cidade: true },
      }),
      this.prisma.financialCategory.count({
        where: {
          tenantId,
          type: FinancialCategoryType.INCOME,
          active: true,
          visibleToMembers: true,
        },
      }),
    ]);

    const brCode = config
      ? generatePixBrCode({
          pixKeyType: config.pixKeyType,
          pixKey: config.pixKey,
          merchantName: config.merchantName,
          merchantCity: config.merchantCity,
          txidPrefix: config.txidPrefix,
        })
      : null;

    return {
      config,
      brCode,
      suggestedMerchantName: sanitizeEmvAsciiText(tenant?.nome ?? '', 25),
      suggestedMerchantCity: sanitizeEmvAsciiText(websiteConfig?.cidade ?? '', 15),
      visibleIncomeCategoriesCount,
    };
  }
}
