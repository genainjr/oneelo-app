import { BadRequestException } from '@nestjs/common';
import type { Multer } from 'multer';

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

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
