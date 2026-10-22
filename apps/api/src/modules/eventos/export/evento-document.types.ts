import { EventoTipo, StatusEvento } from '@prisma/client';
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

export type EventoDocumentFormat = DocumentFormat;
export type EventoDocumentPageSelection = DocumentPageSelection;

export interface EventoDocumentMinisterio {
  id: string;
  nome: string;
}

export interface EventoDocumentItem {
  id: string;
  titulo: string;
  tipo: EventoTipo;
  status: StatusEvento;
  dataInicio: Date;
  dataFim?: Date | null;
  local?: string | null;
  descricao?: string | null;
  ministerios: EventoDocumentMinisterio[];
}

export interface EventoDocumentInput {
  organizationName: string;
  logoUrl?: string | null;
  eventos: EventoDocumentItem[];
  periodo?: {
    dataInicio?: string;
    dataFim?: string;
  };
}

export interface EventoDocumentWeekOption {
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

export type EventoExportResult = DocumentExportResult;
export type EventoRenderOptions = DocumentRenderOptions;
