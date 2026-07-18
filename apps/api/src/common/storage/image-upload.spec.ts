import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import type { Multer } from 'multer';
import { createPwaIconVariants } from './image-upload';

async function imageFile(width: number, height: number): Promise<Multer.File> {
  const buffer = await sharp({
    create: { width, height, channels: 4, background: { r: 15, g: 47, b: 115, alpha: 1 } },
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

describe('createPwaIconVariants', () => {
  it('gera variantes regulares, quadrada original e maskable em paths versionados', async () => {
    const variants = await createPwaIconVariants('tenant-1', await imageFile(600, 600), 'v1');
    expect(variants.map((variant) => variant.path)).toEqual([
      'tenants/tenant-1/pwa/v1/icon-180.png',
      'tenants/tenant-1/pwa/v1/icon-192.png',
      'tenants/tenant-1/pwa/v1/icon-512.png',
      'tenants/tenant-1/pwa/v1/icon-square-512.png',
      'tenants/tenant-1/pwa/v1/icon-maskable-512.png',
    ]);

    const sizes = await Promise.all(variants.map((variant) => sharp(variant.buffer).metadata()));
    expect(sizes.map(({ width, height }) => [width, height])).toEqual([
      [180, 180],
      [192, 192],
      [512, 512],
      [512, 512],
      [512, 512],
    ]);

    const regularCorner = await sharp(variants[2].buffer)
      .ensureAlpha()
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .raw()
      .toBuffer();
    const squareCorner = await sharp(variants[3].buffer)
      .ensureAlpha()
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .raw()
      .toBuffer();
    const maskableCorner = await sharp(variants[4].buffer)
      .ensureAlpha()
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .raw()
      .toBuffer();

    expect(regularCorner[3]).toBe(0);
    expect(squareCorner[3]).toBe(255);
    expect(maskableCorner[3]).toBe(255);
  });

  it('rejeita imagem menor que 512 pixels', async () => {
    await expect(createPwaIconVariants('tenant-1', await imageFile(256, 256), 'v1'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita imagem que nao seja quadrada', async () => {
    await expect(createPwaIconVariants('tenant-1', await imageFile(600, 512), 'v1'))
      .rejects.toThrow('O icone deve ser uma imagem quadrada.');
  });
});
