export type EscalaDocumentFormat = 'pdf' | 'png';
export type EscalaDocumentPageSelection = number | 'todas';

export interface EscalaDocumentRole {
  id: string;
  name: string;
}

export interface EscalaDocumentDay {
  date: Date;
  title?: string | null;
  hiddenRoleIds: string[];
  assignments: Array<{
    roleId: string;
    memberName: string;
  }>;
}

export interface EscalaDocumentSchedule {
  id: string;
  ministryName: string;
  month: number;
  year: number;
  roles: EscalaDocumentRole[];
  days: EscalaDocumentDay[];
}

export interface EscalaDocumentInput {
  organizationName: string;
  logoUrl?: string | null;
  schedules: EscalaDocumentSchedule[];
}

export interface EscalaDocumentWeekOption {
  page: number;
  weekStart: string | null;
  weekEnd: string | null;
  label: string;
  fileName: string;
  eventCount: number;
}

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

export type EscalaExportResult =
  | RenderedDocument
  | RenderedBatchDocument
  | RenderedNotModifiedDocument;

export interface EscalaRenderOptions {
  ifNoneMatch?: string;
  queryMs?: number;
}
