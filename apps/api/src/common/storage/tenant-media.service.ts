import { Injectable, NotFoundException } from '@nestjs/common';
import { AcaoAuditoria } from '@prisma/client';
import type { Multer } from 'multer';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantLogoPath, validateImageUpload } from './image-upload';
import { SupabaseStorageService } from './supabase-storage.service';

const tenantLogoSelect = {
  id: true,
  nome: true,
  slug: true,
  plano: true,
  statusAssinatura: true,
  limiteMembros: true,
  ativo: true,
  email: true,
  telefone: true,
  idioma: true,
  logoUrl: true,
  logoKey: true,
  createdAt: true,
};

@Injectable()
export class TenantMediaService {
  private readonly tenantLogoBucket = 'tenant-logos';

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  async uploadTenantLogo(
    tenantId: string,
    file: Multer.File,
    actorId: string,
    ip?: string | null,
  ) {
    validateImageUpload(file, 'logo');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, logoKey: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant nao encontrado.');
    }

    const path = getTenantLogoPath(tenantId, file);
    const logoUrl = await this.storageService.uploadPublicObject(
      this.tenantLogoBucket,
      path,
      file.buffer,
      file.mimetype,
    );

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        logoUrl,
        logoKey: path,
      },
      select: tenantLogoSelect,
    });

    if (tenant.logoKey && tenant.logoKey !== path) {
      await this.storageService.deleteObject(this.tenantLogoBucket, tenant.logoKey).catch(() => undefined);
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        entidade: 'Tenant',
        entidadeId: tenantId,
        acao: AcaoAuditoria.ATUALIZAR,
        ipAddress: ip ?? null,
        payloadAfter: { logoKey: path, logoUrl },
      },
    });

    return updated;
  }

  async removeTenantLogo(tenantId: string, actorId: string, ip?: string | null) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, logoKey: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant nao encontrado.');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        logoUrl: null,
        logoKey: null,
      },
      select: tenantLogoSelect,
    });

    await this.storageService.deleteObject(this.tenantLogoBucket, tenant.logoKey).catch(() => undefined);

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        entidade: 'Tenant',
        entidadeId: tenantId,
        acao: AcaoAuditoria.ATUALIZAR,
        ipAddress: ip ?? null,
        payloadAfter: { logoKey: null, logoUrl: null },
      },
    });

    return updated;
  }
}
