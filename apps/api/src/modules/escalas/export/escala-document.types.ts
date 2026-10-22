import type {
  DocumentExportResult,
  DocumentFormat,
  DocumentPageSelection,
  DocumentRenderOptions,
  RenderedBatchDocument,
  RenderedBatchFile,
  RenderedDocument,
  RenderedNotModifiedDocument,
} from '../../../common/export';

export type EscalaDocumentFormat = DocumentFormat;
export type EscalaDocumentPageSelection = DocumentPageSelection;

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

export type {
  RenderedDocument,
  RenderedBatchFile,
  RenderedBatchDocument,
  RenderedNotModifiedDocument,
};

export type EscalaExportResult = DocumentExportResult;
export type EscalaRenderOptions = DocumentRenderOptions;
