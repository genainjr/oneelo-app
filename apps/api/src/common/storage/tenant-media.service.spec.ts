import sharp from 'sharp';
import type { Multer } from 'multer';
import { TenantMediaService } from './tenant-media.service';

async function validIcon(): Promise<Multer.File> {
  const buffer = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 15, g: 47, b: 115, alpha: 1 },
    },
  }).png().toBuffer();

  return {
    fieldname: 'file',
    originalname: 'icon.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: buffer.length,
    buffer,
  } as Multer.File;
}

function createService(options: { failUploadAt?: number } = {}) {
  const tenant = {
    findUnique: jest.fn().mockResolvedValue({
      id: 'tenant-a',
      pwaIconKey: 'tenants/tenant-a/pwa/old/icon-512.png',
    }),
    update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'tenant-a', ...data })),
  };
  const prisma = {
    tenant,
    auditLog: { create: jest.fn().mockResolvedValue(undefined) },
  };
  let uploadCount = 0;
  const storage = {
    uploadPublicObject: jest.fn().mockImplementation(async () => {
      uploadCount += 1;
      if (options.failUploadAt === uploadCount) throw new Error('storage failure');
      return 'https://storage.test/object.png';
    }),
    getPublicUrl: jest.fn((_bucket, path) => `https://storage.test/${path}`),
    deleteObject: jest.fn().mockResolvedValue(undefined),
  };

  return {
    service: new TenantMediaService(prisma as never, storage as never),
    prisma,
    storage,
  };
}

describe('TenantMediaService PWA identity', () => {
  it('nao publica no banco e limpa uploads quando uma variante falha', async () => {
    const { service, prisma, storage } = createService({ failUploadAt: 2 });

    await expect(
      service.uploadTenantPwaIcon('tenant-a', await validIcon(), 'admin-a'),
    ).rejects.toThrow('storage failure');

    expect(prisma.tenant.update).not.toHaveBeenCalled();
    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('publica o banco somente depois de todas as variantes', async () => {
    const { service, prisma, storage } = createService();

    await service.uploadTenantPwaIcon('tenant-a', await validIcon(), 'admin-a', '127.0.0.1');

    expect(storage.uploadPublicObject).toHaveBeenCalledTimes(5);
    expect(prisma.tenant.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'tenant-a' },
      data: expect.objectContaining({
        pwaIconKey: expect.stringMatching(/^tenants\/tenant-a\/pwa\/.+\/icon-512\.png$/),
        pwaUpdatedAt: expect.any(Date),
      }),
    }));
    expect(storage.uploadPublicObject.mock.invocationCallOrder[3])
      .toBeLessThan(prisma.tenant.update.mock.invocationCallOrder[0]);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 'tenant-a', userId: 'admin-a' }),
    }));
    expect(JSON.stringify(prisma.auditLog.create.mock.calls)).not.toContain('buffer');
  });

  it('remove somente a identidade do tenant informado e preserva o nome curto', async () => {
    const { service, prisma, storage } = createService();

    await service.removeTenantPwaIcon('tenant-a', 'admin-a');

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'tenant-a' },
    }));
    expect(prisma.tenant.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'tenant-a' },
      data: {
        pwaIconUrl: null,
        pwaIconKey: null,
        pwaUpdatedAt: expect.any(Date),
      },
    }));
    expect(storage.deleteObject).toHaveBeenCalledTimes(5);
  });
});
