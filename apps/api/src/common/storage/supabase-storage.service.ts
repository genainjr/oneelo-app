import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseStorageService {
  constructor(private readonly configService: ConfigService) {}

  private get baseUrl() {
    const baseUrl = this.configService.get<string>('SUPABASE_URL');
    if (!baseUrl) {
      throw new InternalServerErrorException('SUPABASE_URL nao configurada.');
    }
    return baseUrl.replace(/\/$/, '');
  }

  private get serviceKey() {
    const serviceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey) {
      throw new InternalServerErrorException('SUPABASE_SERVICE_ROLE_KEY nao configurada.');
    }
    return serviceKey;
  }

  private encodePath(path: string) {
    return path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }

  private get authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      apikey: this.serviceKey,
    };

    if (!this.serviceKey.startsWith('sb_secret_')) {
      headers.Authorization = `Bearer ${this.serviceKey}`;
    }

    return headers;
  }

  getPublicUrl(bucket: string, path: string) {
    return `${this.baseUrl}/storage/v1/object/public/${bucket}/${this.encodePath(path)}`;
  }

  async uploadPublicObject(
    bucket: string,
    path: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/storage/v1/object/${bucket}/${this.encodePath(path)}`,
      {
        method: 'PUT',
        headers: {
          ...this.authHeaders,
          'Content-Type': mimeType,
          'x-upsert': 'true',
        },
        body: new Uint8Array(buffer),
      },
    );

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new BadRequestException(
        details || 'Nao foi possivel enviar a imagem para o Supabase Storage.',
      );
    }

    return this.getPublicUrl(bucket, path);
  }

  async deleteObject(bucket: string, path?: string | null) {
    if (!path) return;

    const response = await fetch(
      `${this.baseUrl}/storage/v1/object/${bucket}/${this.encodePath(path)}`,
      {
        method: 'DELETE',
        headers: this.authHeaders,
      },
    );

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new BadRequestException(
        details || 'Nao foi possivel remover a imagem do Supabase Storage.',
      );
    }
  }

  async replacePublicObject(
    bucket: string,
    path: string,
    buffer: Buffer,
    mimeType: string,
  ) {
    return this.uploadPublicObject(bucket, path, buffer, mimeType);
  }
}
