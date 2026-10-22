import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { MAX_IMAGE_SIZE } from '../storage/image-upload';

interface TenantLogoCacheEntry {
  dataUri: string | null;
  expiresAt: number;
  bytes: number;
}

let cachedLookupLabsLogoDataUri: string | null | undefined;

@Injectable()
export class TenantLogoService {
  private readonly logger = new Logger(TenantLogoService.name);
  private readonly logoCache = new Map<string, TenantLogoCacheEntry>();
  private readonly maxLogoCacheEntries = 25;
  private readonly maxLogoBytes = MAX_IMAGE_SIZE;
  private readonly logoCacheTtlMs = 30 * 60 * 1000;
  private readonly logoNegativeTtlMs = 15 * 1000;
  private readonly logoFetchTimeoutMs = 5_000;

  getLookupLabsLogoDataUri(): string | null {
    if (cachedLookupLabsLogoDataUri !== undefined) {
      return cachedLookupLabsLogoDataUri;
    }

    const candidatePaths = [
      join(process.cwd(), 'assets/LogoLookupLabs.png'),
      join(process.cwd(), 'apps/api/assets/LogoLookupLabs.png'),
      join(process.cwd(), 'apps/web/public/LogoLookupLabs.png'),
      join(__dirname, '../../../../assets/LogoLookupLabs.png'),
      join(__dirname, '../../../../../web/public/LogoLookupLabs.png'),
    ];

    for (const filePath of candidatePaths) {
      try {
        if (existsSync(filePath)) {
          const buffer = readFileSync(filePath);
          cachedLookupLabsLogoDataUri = `data:image/png;base64,${buffer.toString('base64')}`;
          return cachedLookupLabsLogoDataUri;
        }
      } catch {
        // ignore and try next candidate
      }
    }

    cachedLookupLabsLogoDataUri = null;
    return null;
  }

  async resolveTenantLogoDataUri(logoUrl?: string | null): Promise<string | null> {
    if (!logoUrl) return null;
    const trimmed = logoUrl.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:image/')) {
      return trimmed;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      return null;
    }

    const now = Date.now();
    const cached = this.logoCache.get(trimmed);
    if (cached) {
      if (now <= cached.expiresAt) {
        this.logoCache.delete(trimmed);
        this.logoCache.set(trimmed, cached);
        return cached.dataUri;
      }
      this.logoCache.delete(trimmed);
    }

    try {
      const response = await fetch(trimmed, {
        signal: AbortSignal.timeout(this.logoFetchTimeoutMs),
      });
      if (!response.ok) {
        this.logger.warn(
          JSON.stringify({
            event: 'export_logo_fetch_failed',
            status: response.status,
          }),
        );
        this.storeLogoCache(trimmed, null, 0, now + this.logoNegativeTtlMs);
        return null;
      }
      const contentType = (response.headers.get('content-type') ?? 'image/png')
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (
        !contentType.startsWith('image/') &&
        contentType !== 'application/octet-stream'
      ) {
        this.storeLogoCache(trimmed, null, 0, now + this.logoNegativeTtlMs);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > this.maxLogoBytes) {
        this.logger.warn(
          JSON.stringify({
            event: 'export_logo_size_rejected',
            byteLength: arrayBuffer.byteLength,
            maxLogoBytes: this.maxLogoBytes,
          }),
        );
        this.storeLogoCache(trimmed, null, 0, now + this.logoNegativeTtlMs);
        return null;
      }
      const rawBuffer = Buffer.from(arrayBuffer);
      let optimizedBuffer: Buffer = rawBuffer;
      let finalMime = contentType.startsWith('image/') ? contentType : 'image/png';
      try {
        optimizedBuffer = await sharp(rawBuffer)
          .rotate()
          .resize(240, 240, { fit: 'inside', withoutEnlargement: true })
          .png({ compressionLevel: 9 })
          .toBuffer();
        finalMime = 'image/png';
      } catch {
        // Fallback to original buffer if sharp cannot decode synthetic/custom image
      }

      const dataUri = `data:${finalMime};base64,${optimizedBuffer.toString('base64')}`;
      this.storeLogoCache(
        trimmed,
        dataUri,
        optimizedBuffer.byteLength,
        now + this.logoCacheTtlMs,
      );
      return dataUri;
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'export_logo_fetch_error',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      this.storeLogoCache(trimmed, null, 0, now + this.logoNegativeTtlMs);
      return null;
    }
  }

  private storeLogoCache(
    key: string,
    dataUri: string | null,
    bytes: number,
    expiresAt: number,
  ) {
    if (this.logoCache.has(key)) {
      this.logoCache.delete(key);
    }
    while (this.logoCache.size >= this.maxLogoCacheEntries) {
      const oldestKey = this.logoCache.keys().next().value;
      if (!oldestKey) break;
      this.logoCache.delete(oldestKey);
    }
    this.logoCache.set(key, { dataUri, bytes, expiresAt });
  }

  clearCache() {
    this.logoCache.clear();
  }
}
