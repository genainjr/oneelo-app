export const IMAGE_UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp';
export const IMAGE_UPLOAD_MAX_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateImageFile(file: File) {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return 'Use uma imagem JPG, PNG ou WEBP.';
  }

  if (file.size > IMAGE_UPLOAD_MAX_SIZE) {
    return 'A imagem deve ter no maximo 5 MB.';
  }

  return null;
}

export function buildImageFormData(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return formData;
}
