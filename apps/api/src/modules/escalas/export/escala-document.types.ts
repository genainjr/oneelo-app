export type EscalaDocumentFormat = 'pdf' | 'png';

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

export interface RenderedDocument {
  buffer: Buffer;
  mimeType: 'application/pdf' | 'image/png';
  fileName: string;
  pageCount: number;
}
