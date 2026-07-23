import { BadRequestException } from '@nestjs/common';
import type { Multer } from 'multer';
import sharp from 'sharp';

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_FINANCIAL_RECEIPT_SIZE = 10 * 1024 * 1024;

const FINANCIAL_RECEIPT_EXTENSION_BY_MIME: Record<string, string> = {
  ...IMAGE_EXTENSION_BY_MIME,
  'application/pdf': 'pdf',
};

export function validateImageUpload(file: Multer.File | undefined, label: string) {
  if (!file) {
    throw new BadRequestException(`Arquivo da ${label} e obrigatorio.`);
  }

  if (!IMAGE_EXTENSION_BY_MIME[file.mimetype]) {
    throw new BadRequestException('Formato de imagem invalido. Use JPG, PNG ou WEBP.');
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new BadRequestException('A imagem deve ter no maximo 5 MB.');
  }
}

export function getImageExtension(file: Multer.File) {
  const extension = IMAGE_EXTENSION_BY_MIME[file.mimetype];
  if (!extension) {
    throw new BadRequestException('Formato de imagem invalido.');
  }
  return extension;
}

export function getMemberPhotoPath(tenantId: string, memberId: string, file: Multer.File) {
  return `tenants/${tenantId}/members/${memberId}/photo-${Date.now()}.${getImageExtension(file)}`;
}

export function getTenantLogoPath(tenantId: string, file: Multer.File) {
  return `tenants/${tenantId}/logo/logo-${Date.now()}.${getImageExtension(file)}`;
}

export function validateFinancialReceiptUpload(file: Multer.File | undefined) {
  if (!file) {
    throw new BadRequestException('Comprovante é obrigatório.');
  }

  if (!FINANCIAL_RECEIPT_EXTENSION_BY_MIME[file.mimetype]) {
    throw new BadRequestException('Formato de comprovante inválido. Use PDF, JPG, PNG ou WEBP.');
  }

  if (file.size > MAX_FINANCIAL_RECEIPT_SIZE) {
    throw new BadRequestException('O comprovante deve ter no máximo 10 MB.');
  }
}

export function getFinancialReceiptPath(tenantId: string, transactionId: string, file: Multer.File) {
  const extension = FINANCIAL_RECEIPT_EXTENSION_BY_MIME[file.mimetype];
  if (!extension) {
    throw new BadRequestException('Formato de comprovante inválido.');
  }
  return `tenants/${tenantId}/financeiro/transactions/${transactionId}/receipt-${Date.now()}.${extension}`;
}

export const PWA_ICON_SIZES = [180, 192, 512] as const;

export interface PwaIconVariant {
  path: string;
  buffer: Buffer;
}

function createRoundedIconMask(size: number) {
  // Mantem a proporcao de cantos do icone OneElo anterior (aprox. 20% do lado).
  const radius = Math.round(size * 0.2);
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`,
  );
}

export function getTenantPwaIconPaths(tenantId: string, version: string) {
  const prefix = `tenants/${tenantId}/pwa/${version}`;

  return {
    icon180: `${prefix}/icon-180.png`,
    icon192: `${prefix}/icon-192.png`,
    icon512: `${prefix}/icon-512.png`,
    square512: `${prefix}/icon-square-512.png`,
    maskable512: `${prefix}/icon-maskable-512.png`,
  };
}

export function getTenantPwaIconPathsFromMainKey(mainKey?: string | null) {
  if (!mainKey?.endsWith('/icon-512.png')) return [];
  const prefix = mainKey.slice(0, -'/icon-512.png'.length);

  return [
    `${prefix}/icon-180.png`,
    `${prefix}/icon-192.png`,
    mainKey,
    `${prefix}/icon-square-512.png`,
    `${prefix}/icon-maskable-512.png`,
  ];
}

export async function createPwaIconVariants(
  tenantId: string,
  file: Multer.File | undefined,
  version: string,
): Promise<PwaIconVariant[]> {
  validateImageUpload(file, 'icone do aplicativo');

  const input = sharp(file!.buffer, { failOn: 'error' }).rotate();
  const metadata = await input.metadata().catch(() => {
    throw new BadRequestException('Nao foi possivel ler a imagem do icone.');
  });

  if (!metadata.width || !metadata.height) {
    throw new BadRequestException('Nao foi possivel identificar as dimensoes do icone.');
  }

  if (metadata.width < 512 || metadata.height < 512) {
    throw new BadRequestException('O icone deve ter pelo menos 512 x 512 pixels.');
  }

  if (metadata.width !== metadata.height) {
    throw new BadRequestException('O icone deve ser uma imagem quadrada.');
  }

  const paths = getTenantPwaIconPaths(tenantId, version);
  const regularVariants = await Promise.all(
    PWA_ICON_SIZES.map(async (size) => ({
      path: paths[`icon${size}` as keyof typeof paths],
      buffer: await sharp(file!.buffer)
        .rotate()
        .resize(size, size, { fit: 'cover' })
        .composite([{ input: createRoundedIconMask(size), blend: 'dest-in' }])
        .png({ compressionLevel: 9 })
        .toBuffer(),
    })),
  );
  const maskableBuffer = await sharp(file!.buffer)
    .rotate()
    .resize(410, 410, { fit: 'contain' })
    .extend({ top: 51, bottom: 51, left: 51, right: 51, background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const squareBuffer = await sharp(file!.buffer)
    .rotate()
    .resize(512, 512, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return [
    ...regularVariants,
    { path: paths.square512, buffer: squareBuffer },
    { path: paths.maskable512, buffer: maskableBuffer },
  ];
}
