import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import type { Locale } from "date-fns";
import type {
  StatusConfirmacao,
  StatusEscala,
  StatusEvento,
  StatusMembro,
  Role,
} from "@/types";

export const DATE_FNS_LOCALES: Record<string, Locale> = {
  "pt-BR": ptBR,
  "pt-PT": ptBR,
  "en-US": enUS,
};

// ─── Classnames ───────────────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function includesNormalizedText(
  value: string | null | undefined,
  search: string | null | undefined,
): boolean {
  const normalizedSearch = normalizeSearchText(search);
  return (
    !normalizedSearch || normalizeSearchText(value).includes(normalizedSearch)
  );
}

// ─── Formatação de datas ──────────────────────────────────────────────────────

type DateInput = string | Date | null | undefined;
const WEEKDAY_SHORT_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function parseDateForFormat(date: DateInput, fmt: string): Date | null {
  if (!date) return null;
  if (typeof date === "string") {
    const hasTimeTokens = /[Hhms]/.test(fmt);
    if (!hasTimeTokens && date.includes("T")) {
      return parseISO(date.split("T")[0]);
    }
    return parseISO(date);
  }
  return date;
}

export function getCivilDateKey(date: DateInput): string | null {
  if (!date) return null;

  if (typeof date === "string") {
    const dateOnly = date.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (dateOnly) return dateOnly;
  }

  try {
    const parsed = typeof date === "string" ? parseISO(date) : date;
    if (!isValid(parsed)) return null;
    return format(parsed, "yyyy-MM-dd");
  } catch {
    return null;
  }
}

export function compareCivilDates(left: DateInput, right: DateInput): number {
  const leftKey = getCivilDateKey(left);
  const rightKey = getCivilDateKey(right);

  if (!leftKey && !rightKey) return 0;
  if (!leftKey) return 1;
  if (!rightKey) return -1;

  return leftKey.localeCompare(rightKey);
}

export function isCivilDateOnOrAfter(
  date: DateInput,
  reference: DateInput = new Date(),
): boolean {
  const dateKey = getCivilDateKey(date);
  const referenceKey = getCivilDateKey(reference);

  return !!dateKey && !!referenceKey && dateKey >= referenceKey;
}

export function isCivilDateBefore(
  date: DateInput,
  reference: DateInput = new Date(),
): boolean {
  const dateKey = getCivilDateKey(date);
  const referenceKey = getCivilDateKey(reference);

  return !!dateKey && !!referenceKey && dateKey < referenceKey;
}

export function formatDate(
  date: DateInput,
  fmt = "dd/MM/yyyy",
  dfLocale: Locale = ptBR,
): string {
  if (!date) return "—";
  try {
    const d = parseDateForFormat(date, fmt);
    if (!d || !isValid(d)) return "—";
    return format(d, fmt, { locale: dfLocale });
  } catch {
    return "—";
  }
}

export function getDatePartsWithWeekday(
  date: DateInput,
  fmt = "dd/MM/yyyy",
  dfLocale: Locale = ptBR,
): { weekday: string; date: string } {
  if (!date) return { weekday: "—", date: "—" };
  try {
    const d = parseDateForFormat(date, fmt);
    if (!d || !isValid(d)) return { weekday: "—", date: "—" };

    return {
      weekday: WEEKDAY_SHORT_LABELS[d.getDay()] ?? "—",
      date: format(d, fmt, { locale: dfLocale }),
    };
  } catch {
    return { weekday: "—", date: "—" };
  }
}

export function formatDateWithWeekday(
  date: DateInput,
  fmt = "dd/MM/yyyy",
  dfLocale: Locale = ptBR,
): string {
  const parts = getDatePartsWithWeekday(date, fmt, dfLocale);
  if (parts.weekday === "—" || parts.date === "—") return "—";
  return `${parts.weekday} · ${parts.date}`;
}

export function formatDateTime(
  date: DateInput,
  at = "às",
  dfLocale: Locale = ptBR,
): string {
  return formatDate(date, `dd/MM/yyyy '${at}' HH:mm`, dfLocale);
}

// ─── Formatação de telefone ───────────────────────────────────────────────────

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
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
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  VISITANTE: "Visitante",
  TRANSFERIDO: "Transferido",
};

export const STATUS_MEMBRO_COLOR: Record<StatusMembro, string> = {
  ATIVO: "bg-emerald-100 text-emerald-800",
  INATIVO: "bg-gray-100 text-gray-600",
  VISITANTE: "bg-blue-100 text-blue-800",
  TRANSFERIDO: "bg-amber-100 text-amber-800",
};

export const STATUS_ESCALA_LABEL: Record<StatusEscala, string> = {
  RASCUNHO: "Rascunho",
  PUBLICADA: "Em andamento",
  ENCERRADA: "Finalizada",
};

export const STATUS_ESCALA_COLOR: Record<StatusEscala, string> = {
  RASCUNHO: "bg-gray-100 text-gray-600",
  PUBLICADA: "bg-blue-100 text-blue-800",
  ENCERRADA: "bg-emerald-100 text-emerald-800",
};

export const STATUS_CONFIRMACAO_LABEL: Record<StatusConfirmacao, string> = {
  PENDENTE: "Pendente",
  CONFIRMADO: "Confirmado",
  RECUSADO: "Recusado",
};

export const STATUS_CONFIRMACAO_COLOR: Record<StatusConfirmacao, string> = {
  PENDENTE: "bg-amber-100 text-amber-800",
  CONFIRMADO: "bg-emerald-100 text-emerald-800",
  RECUSADO: "bg-red-100 text-red-800",
};

export const STATUS_EVENTO_LABEL: Record<StatusEvento, string> = {
  AGENDADO: "Agendado",
  REALIZADO: "Realizado",
  CANCELADO: "Cancelado",
};

export const STATUS_EVENTO_COLOR: Record<StatusEvento, string> = {
  AGENDADO: "bg-blue-100 text-blue-800",
  REALIZADO: "bg-emerald-100 text-emerald-800",
  CANCELADO: "bg-red-100 text-red-800",
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrador",
  STAFF: "Equipe",
  BASIC: "Membro",
  SUPER_ADMIN: "Super Admin",
};

export const MINISTRY_ROLE_LABEL: Record<string, string> = {
  LEADER: "Líder",
  ASSISTANT_LEADER: "Co-líder",
  MEMBER: "Membro",
};

// ─── Utilitários ─────────────────────────────────────────────────────────────

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export function pluralize(
  count: number,
  singular: string,
  plural: string,
): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}
