export type DocumentFormat = 'pdf' | 'png';
export type DocumentPageSelection = number | 'todas';

export interface RenderedDocument {
  kind?: 'single';
  buffer: Buffer;
  mimeType: 'application/pdf' | 'image/png';
  fileName: string;
  pageCount: number;
  etag?: string;
  notModified?: boolean;
}

export interface RenderedBatchFile {
  fileName: string;
  mimeType: 'image/png';
  base64: string;
}

export interface RenderedBatchDocument {
  kind: 'batch';
  files: RenderedBatchFile[];
  pageCount: number;
  etag?: string;
  notModified?: boolean;
}

export interface RenderedNotModifiedDocument {
  kind: 'not-modified';
  etag: string;
  pageCount: number;
  notModified: true;
}

export type DocumentExportResult =
  | RenderedDocument
  | RenderedBatchDocument
  | RenderedNotModifiedDocument;

export interface DocumentRenderOptions {
  ifNoneMatch?: string;
  queryMs?: number;
}

export interface DocumentHeaderInput {
  organizationName: string;
  logoUrl?: string | null;
  issuedAt?: Date | string | null;
}
