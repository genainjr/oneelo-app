import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  RenderedBatchDocument,
  RenderedDocument,
} from './document-export.types';
import { matchesIfNoneMatch } from './document-format.utils';

interface ResultCacheEntry {
  value: RenderedDocument | RenderedBatchDocument;
  expiresAt: number;
  bytes: number;
}

@Injectable()
export class DocumentCacheService {
  private maxCacheBytes = 15 * 1024 * 1024;
  private cacheTtlMs = 10 * 60 * 1000;
  private readonly resultCache = new Map<string, ResultCacheEntry>();
  private resultCacheBytes = 0;

  computeEtag(payload: unknown): string {
    const serialized = JSON.stringify(payload);
    const digest = createHash('sha256').update(serialized).digest('hex').slice(0, 32);
    return `"${digest}"`;
  }

  isNotModified(ifNoneMatch: string | undefined, etag: string): boolean {
    return matchesIfNoneMatch(ifNoneMatch, etag);
  }

  get(key: string): (RenderedDocument | RenderedBatchDocument) | null {
    const entry = this.resultCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.resultCache.delete(key);
      this.resultCacheBytes = Math.max(0, this.resultCacheBytes - entry.bytes);
      return null;
    }

    // Refresh LRU order
    this.resultCache.delete(key);
    this.resultCache.set(key, entry);
    return entry.value;
  }

  set(
    key: string,
    value: RenderedDocument | RenderedBatchDocument,
    bytes: number,
  ): void {
    if (bytes <= 0 || bytes > this.maxCacheBytes) {
      return;
    }

    const existing = this.resultCache.get(key);
    if (existing) {
      this.resultCache.delete(key);
      this.resultCacheBytes = Math.max(0, this.resultCacheBytes - existing.bytes);
    }

    const now = Date.now();
    for (const [k, v] of this.resultCache.entries()) {
      if (now > v.expiresAt) {
        this.resultCache.delete(k);
        this.resultCacheBytes = Math.max(0, this.resultCacheBytes - v.bytes);
      }
    }

    while (
      this.resultCache.size > 0 &&
      this.resultCacheBytes + bytes > this.maxCacheBytes
    ) {
      const oldestKey = this.resultCache.keys().next().value;
      if (!oldestKey) break;
      const oldest = this.resultCache.get(oldestKey);
      this.resultCache.delete(oldestKey);
      if (oldest) {
        this.resultCacheBytes = Math.max(0, this.resultCacheBytes - oldest.bytes);
      }
    }

    this.resultCache.set(key, {
      value,
      bytes,
      expiresAt: now + this.cacheTtlMs,
    });
    this.resultCacheBytes += bytes;
  }

  setLimitsForTesting(limits: { maxCacheBytes?: number }) {
    if (limits.maxCacheBytes !== undefined) {
      this.maxCacheBytes = limits.maxCacheBytes;
    }
  }

  clear(): void {
    this.resultCache.clear();
    this.resultCacheBytes = 0;
  }
}
