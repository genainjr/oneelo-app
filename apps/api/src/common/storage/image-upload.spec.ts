import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import type { Multer } from 'multer';
import {
  createPwaIconVariants,
  MAX_FINANCIAL_RECEIPT_SIZE,
  validateFinancialReceiptUpload,
} from './image-upload';

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

describe('validateFinancialReceiptUpload', () => {
  const makeReceipt = (mimetype: string, buffer: Buffer, size = buffer.length): Multer.File =>
    ({
      fieldname: 'file',
      originalname: 'comprovante',
      encoding: '7bit',
      mimetype,
      size,
      buffer,
    }) as Multer.File;

  it('aceita PDF, JPEG, PNG e WEBP com assinatura válida', () => {
    expect(() =>
      validateFinancialReceiptUpload(makeReceipt('application/pdf', Buffer.from('%PDF-1.7\n...'))),
    ).not.toThrow();
    expect(() =>
      validateFinancialReceiptUpload(makeReceipt('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0]))),
    ).not.toThrow();
    expect(() =>
      validateFinancialReceiptUpload(
        makeReceipt('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])),
      ),
    ).not.toThrow();
    expect(() =>
      validateFinancialReceiptUpload(
        makeReceipt('image/webp', Buffer.from('RIFF\x24\x00\x00\x00WEBP', 'latin1')),
      ),
    ).not.toThrow();
  });

  it('rejeita arquivo disfarçado com MIME válido mas conteúdo inválido (magic bytes)', () => {
    expect(() =>
      validateFinancialReceiptUpload(
        makeReceipt('image/png', Buffer.from('<html><script>alert(1)</script></html>')),
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      validateFinancialReceiptUpload(makeReceipt('application/pdf', Buffer.from('NOT-A-PDF'))),
    ).toThrow(BadRequestException);
  });

  it('rejeita arquivo ausente, MIME não permitido ou acima de 10 MB', () => {
    expect(() => validateFinancialReceiptUpload(undefined)).toThrow(BadRequestException);
    expect(() =>
      validateFinancialReceiptUpload(makeReceipt('image/svg+xml', Buffer.from('<svg></svg>'))),
    ).toThrow(BadRequestException);
    expect(() =>
      validateFinancialReceiptUpload(
        makeReceipt('application/pdf', Buffer.from('%PDF-1.7'), MAX_FINANCIAL_RECEIPT_SIZE + 1),
      ),
    ).toThrow(BadRequestException);
  });
});
