import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import type { StatusConfirmacao, StatusEscala, StatusEvento, StatusMembro, Role } from '@/types';

export const DATE_FNS_LOCALES: Record<string, Locale> = {
  'pt-BR': ptBR,
  'pt-PT': ptBR,
  'en-US': enUS,
};

// ─── Classnames ───────────────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Formatação de datas ──────────────────────────────────────────────────────

export function formatDate(date: string | Date | null | undefined, fmt = 'dd/MM/yyyy', dfLocale: Locale = ptBR): string {
  if (!date) return '—';
  try {
    let d: Date;
    if (typeof date === 'string') {
      const hasTimeTokens = /[Hhms]/.test(fmt);
      if (!hasTimeTokens && date.includes('T')) {
        d = parseISO(date.split('T')[0]);
      } else {
        d = parseISO(date);
      }
    } else {
      d = date;
    }
    if (!isValid(d)) return '—';
    return format(d, fmt, { locale: dfLocale });
  } catch {
    return '—';
  }
}

export function formatDateTime(date: string | Date | null | undefined, at = 'às', dfLocale: Locale = ptBR): string {
  return formatDate(date, `dd/MM/yyyy '${at}' HH:mm`, dfLocale);
}

// ─── Formatação de telefone ───────────────────────────────────────────────────

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

// ─── Labels e cores por status ────────────────────────────────────────────────

export const STATUS_MEMBRO_LABEL: Record<StatusMembro, string> = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  VISITANTE: 'Visitante',
  TRANSFERIDO: 'Transferido',
};

export const STATUS_MEMBRO_COLOR: Record<StatusMembro, string> = {
  ATIVO: 'bg-emerald-100 text-emerald-800',
  INATIVO: 'bg-gray-100 text-gray-600',
  VISITANTE: 'bg-blue-100 text-blue-800',
  TRANSFERIDO: 'bg-amber-100 text-amber-800',
};

export const STATUS_ESCALA_LABEL: Record<StatusEscala, string> = {
  RASCUNHO: 'Rascunho',
  PUBLICADA: 'Publicada',
  ENCERRADA: 'Encerrada',
};

export const STATUS_ESCALA_COLOR: Record<StatusEscala, string> = {
  RASCUNHO: 'bg-gray-100 text-gray-600',
  PUBLICADA: 'bg-blue-100 text-blue-800',
  ENCERRADA: 'bg-emerald-100 text-emerald-800',
};

export const STATUS_CONFIRMACAO_LABEL: Record<StatusConfirmacao, string> = {
  PENDENTE: 'Pendente',
  CONFIRMADO: 'Confirmado',
  RECUSADO: 'Recusado',
};

export const STATUS_CONFIRMACAO_COLOR: Record<StatusConfirmacao, string> = {
  PENDENTE: 'bg-amber-100 text-amber-800',
  CONFIRMADO: 'bg-emerald-100 text-emerald-800',
  RECUSADO: 'bg-red-100 text-red-800',
};

export const STATUS_EVENTO_LABEL: Record<StatusEvento, string> = {
  AGENDADO: 'Agendado',
  REALIZADO: 'Realizado',
  CANCELADO: 'Cancelado',
};

export const STATUS_EVENTO_COLOR: Record<StatusEvento, string> = {
  AGENDADO: 'bg-blue-100 text-blue-800',
  REALIZADO: 'bg-emerald-100 text-emerald-800',
  CANCELADO: 'bg-red-100 text-red-800',
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  STAFF: 'Equipe',
  BASIC: 'Membro',
  SUPER_ADMIN: 'Super Admin',
};

export const MINISTRY_ROLE_LABEL: Record<string, string> = {
  LEADER: 'Líder',
  ASSISTANT_LEADER: 'Co-líder',
  MEMBER: 'Membro',
};

// ─── Utilitários ─────────────────────────────────────────────────────────────

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}
