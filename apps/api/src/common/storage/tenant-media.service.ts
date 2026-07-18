import { Injectable, NotFoundException } from '@nestjs/common';
import { AcaoAuditoria } from '@prisma/client';
import type { Multer } from 'multer';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  createPwaIconVariants,
  getTenantLogoPath,
  getTenantPwaIconPathsFromMainKey,
  validateImageUpload,
} from './image-upload';
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
  pwaShortName: true,
  pwaIconUrl: true,
  pwaIconKey: true,
  pwaUpdatedAt: true,
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

  async uploadTenantPwaIcon(
    tenantId: string,
    file: Multer.File,
    actorId: string,
    ip?: string | null,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, pwaIconKey: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant nao encontrado.');
    }

    const version = `${Date.now()}-${randomUUID()}`;
    const variants = await createPwaIconVariants(tenantId, file, version);
    const uploadedPaths: string[] = [];
    let published = false;

    try {
      for (const variant of variants) {
        await this.storageService.uploadPublicObject(
          this.tenantLogoBucket,
          variant.path,
          variant.buffer,
          'image/png',
        );
        uploadedPaths.push(variant.path);
      }

      const mainVariant = variants.find((variant) => variant.path.endsWith('/icon-512.png'))!;
      const pwaIconUrl = this.storageService.getPublicUrl(this.tenantLogoBucket, mainVariant.path);
      const updated = await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          pwaIconUrl,
          pwaIconKey: mainVariant.path,
          pwaUpdatedAt: new Date(),
        },
        select: tenantLogoSelect,
      });
      published = true;

      await Promise.allSettled(
        getTenantPwaIconPathsFromMainKey(tenant.pwaIconKey).map((path) =>
          this.storageService.deleteObject(this.tenantLogoBucket, path),
        ),
      );
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId: actorId,
          entidade: 'Tenant',
          entidadeId: tenantId,
          acao: AcaoAuditoria.ATUALIZAR,
          ipAddress: ip ?? null,
          payloadAfter: { pwaIconKey: mainVariant.path, pwaIconUrl },
        },
      });

      return updated;
    } catch (error) {
      if (!published) {
        await Promise.allSettled(
          uploadedPaths.map((path) => this.storageService.deleteObject(this.tenantLogoBucket, path)),
        );
      }
      throw error;
    }
  }

  async removeTenantPwaIcon(tenantId: string, actorId: string, ip?: string | null) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, pwaIconKey: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant nao encontrado.');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { pwaIconUrl: null, pwaIconKey: null, pwaUpdatedAt: new Date() },
      select: tenantLogoSelect,
    });

    await Promise.allSettled(
      getTenantPwaIconPathsFromMainKey(tenant.pwaIconKey).map((path) =>
        this.storageService.deleteObject(this.tenantLogoBucket, path),
      ),
    );
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        entidade: 'Tenant',
        entidadeId: tenantId,
        acao: AcaoAuditoria.ATUALIZAR,
        ipAddress: ip ?? null,
        payloadAfter: { pwaIconKey: null, pwaIconUrl: null },
      },
    });

    return updated;
  }
}
