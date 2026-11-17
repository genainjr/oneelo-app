import { parsePhoneNumberFromString } from 'libphonenumber-js';
import {
  EstadoCivil,
  Prisma,
  Role,
  SexoMembro,
  StatusMembro,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Normaliza nome completo para comparação e deduplicação (NFD sem diacríticos, minúsculo, espaços unificados)
 */
export function normalizeName(name?: string | null): string {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normaliza e-mail (minúsculo e sem espaços)
 */
export function normalizeEmail(email?: string | null): string {
  if (!email) return '';
  return String(email).trim().toLowerCase();
}

/**
 * Normaliza número de telefone celular para formato internacional E.164
 */
export function normalizePhone(phone?: string | number | null): {
  phone?: string;
  aviso?: string;
} {
  if (phone === null || phone === undefined || phone === '') return {};
  const str = String(phone).trim();
  if (!str || str === '-' || str === '--') return {};

  const clean = str.replace(/[^\d+]/g, '');
  if (!clean) return {};

  try {
    const parsed = clean.startsWith('+')
      ? parsePhoneNumberFromString(clean)
      : parsePhoneNumberFromString(clean, 'BR');

    if (parsed && parsed.isValid()) {
      return { phone: parsed.number };
    }
  } catch {
    // Ignora erro e continua fallback
  }

  let digitsOnly = clean.replace(/\D/g, '');
  if (
    digitsOnly.startsWith('0') &&
    (digitsOnly.length === 11 || digitsOnly.length === 12)
  ) {
    digitsOnly = digitsOnly.slice(1);
  }

  if (
    digitsOnly.startsWith('55') &&
    (digitsOnly.length === 12 || digitsOnly.length === 13)
  ) {
    return { phone: `+${digitsOnly}` };
  }

  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    return { phone: `+55${digitsOnly}` };
  }

  if (digitsOnly.length === 8 || digitsOnly.length === 9) {
    return {
      phone: digitsOnly,
      aviso: 'Telefone informado sem DDD (ex: 8 ou 9 dígitos).',
    };
  }

  if (clean.startsWith('+') && clean.length >= 8) {
    return { phone: clean };
  }

  return {
    phone: digitsOnly || clean,
    aviso: 'Formato de telefone não padronizado.',
  };
}

/**
 * Extrai apenas os dígitos significativos do telefone celular para comparação
 * Ex: '+5585991101771' -> '85991101771', '085991101771' -> '85991101771'
 */
export function extractPhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (
    digits.startsWith('55') &&
    (digits.length === 12 || digits.length === 13)
  ) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

/**
 * Sanitiza CPF (recompõe zero à esquerda se tiver 10 dígitos)
 */
export function normalizeCpf(cpf?: string | number | null): {
  cpf?: string;
  erro?: string;
} {
  if (cpf === null || cpf === undefined || cpf === '') return {};
  let digits = String(cpf).replace(/\D/g, '');
  if (!digits) return {};

  if (digits.length === 10) {
    digits = digits.padStart(11, '0');
  }

  if (digits.length !== 11) {
    return { erro: 'CPF deve conter 11 dígitos numéricos.' };
  }

  return { cpf: digits };
}

export interface DuplicityExistingMemberSnapshot {
  id: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  cpf: string | null;
  dataNascimento: Date | null;
  sexo: SexoMembro | null;
  estadoCivil: EstadoCivil | null;
  observacoes: string | null;
  status: StatusMembro;
}

export interface DuplicityExistingUserSnapshot {
  id: string;
  role: Role;
  status: UserStatus;
  ativo: boolean;
  email: string;
  telefoneLogin: string | null;
}

export interface DuplicityPreloadedMember {
  id: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  cpf: string | null;
  dataNascimento?: Date | null;
  sexo?: SexoMembro | null;
  estadoCivil?: EstadoCivil | null;
  observacoes?: string | null;
  status: StatusMembro;
  user?: {
    id: string;
    role: Role;
    status: UserStatus;
    ativo: boolean;
    email: string;
    telefoneLogin?: string | null;
  } | null;
}

export interface DuplicityPreloadedPendingRequest {
  id: string;
  nome: string;
  telefone: string;
  cpf: string | null;
}

export interface DuplicityPreloadedContext {
  membros: DuplicityPreloadedMember[];
  pendingRequests: DuplicityPreloadedPendingRequest[];
}

export interface DuplicityCheckResult {
  isDuplicate: boolean;
  membroExistenteId?: string;
  membroExistenteNome?: string;
  membroExistenteStatus?: string;
  motivoDuplicidade?:
    | 'TELEFONE'
    | 'CPF'
    | 'EMAIL'
    | 'NOME_EXATO'
    | 'FICHA_PENDENTE';
  membroExistente?: DuplicityExistingMemberSnapshot;
  usuarioExistente?: DuplicityExistingUserSnapshot | null;
}

type PrismaLike = PrismaService | Prisma.TransactionClient;

const DUPLICITY_MEMBER_SELECT = {
  id: true,
  nome: true,
  whatsapp: true,
  email: true,
  cpf: true,
  dataNascimento: true,
  sexo: true,
  estadoCivil: true,
  observacoes: true,
  status: true,
  user: {
    select: {
      id: true,
      role: true,
      status: true,
      ativo: true,
      email: true,
      telefoneLogin: true,
    },
  },
} as const;

function buildMemberMatchResult(
  match: DuplicityPreloadedMember,
  motivoDuplicidade: 'TELEFONE' | 'CPF' | 'EMAIL' | 'NOME_EXATO',
): DuplicityCheckResult {
  return {
    isDuplicate: true,
    membroExistenteId: match.id,
    membroExistenteNome: match.nome,
    membroExistenteStatus: match.status,
    motivoDuplicidade,
    membroExistente: {
      id: match.id,
      nome: match.nome,
      whatsapp: match.whatsapp ?? null,
      email: match.email ?? null,
      cpf: match.cpf ?? null,
      dataNascimento: match.dataNascimento ?? null,
      sexo: match.sexo ?? null,
      estadoCivil: match.estadoCivil ?? null,
      observacoes: match.observacoes ?? null,
      status: match.status,
    },
    usuarioExistente: match.user
      ? {
          id: match.user.id,
          role: match.user.role,
          status: match.user.status,
          ativo: Boolean(match.user.ativo),
          email: match.user.email,
          telefoneLogin: match.user.telefoneLogin ?? null,
        }
      : null,
  };
}

const DUPLICITY_STATUS_PRIORITY: Record<StatusMembro, number> = {
  [StatusMembro.ATIVO]: 0,
  [StatusMembro.VISITANTE]: 1,
  [StatusMembro.INATIVO]: 2,
  [StatusMembro.TRANSFERIDO]: 3,
};

function pickBestMemberMatch(
  matches: DuplicityPreloadedMember[],
  normName: string,
): DuplicityPreloadedMember | undefined {
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];

  return [...matches].sort((a, b) => {
    const aNameMatch = normName ? normalizeName(a.nome) === normName : false;
    const bNameMatch = normName ? normalizeName(b.nome) === normName : false;
    if (aNameMatch !== bNameMatch) return aNameMatch ? -1 : 1;

    const aPriority = DUPLICITY_STATUS_PRIORITY[a.status] ?? 99;
    const bPriority = DUPLICITY_STATUS_PRIORITY[b.status] ?? 99;
    return aPriority - bPriority;
  })[0];
}

/**
 * Pré-carrega membros não excluídos (ativos, visitantes e ex-membros) e solicitações pendentes para checagem em lote (evita N+1).
 */
export async function loadMemberDuplicityContext(
  prisma: PrismaLike,
  tenantId: string,
  preloadedPendingRequests?: DuplicityPreloadedPendingRequest[],
): Promise<DuplicityPreloadedContext> {
  const membros = (await prisma.membro.findMany({
    where: {
      tenantId,
      deletedAt: null,
    },
    select: DUPLICITY_MEMBER_SELECT,
  })) as DuplicityPreloadedMember[];

  const pendingRequests = preloadedPendingRequests
    ? preloadedPendingRequests
    : await prisma.solicitacaoCadastroMembro.findMany({
        where: {
          tenantId,
          status: 'PENDENTE',
        },
        select: {
          id: true,
          nome: true,
          telefone: true,
          cpf: true,
        },
      });

  return { membros, pendingRequests };
}

/**
 * Consulta duplicidade de cadastro no tenant por CPF, telefone, e-mail e nome exato
 */
export async function checkMemberDuplicity(
  prisma: PrismaLike,
  tenantId: string,
  candidate: {
    telefone?: string | null;
    cpf?: string | null;
    email?: string | null;
    nome?: string | null;
    excludeSolicitacaoId?: string;
  },
  preloadedContext?: DuplicityPreloadedContext,
): Promise<DuplicityCheckResult> {
  const normCpf = normalizeCpf(candidate.cpf).cpf;
  const normEmail = normalizeEmail(candidate.email);
  const normPhone = normalizePhone(candidate.telefone).phone;
  const phoneDigits = extractPhoneDigits(normPhone || candidate.telefone);
  const normName = normalizeName(candidate.nome);

  // 1. Buscar membros não excluídos no tenant (inclui ATIVO, VISITANTE, INATIVO e TRANSFERIDO para reativação)
  const membros: DuplicityPreloadedMember[] = preloadedContext
    ? preloadedContext.membros
    : ((await prisma.membro.findMany({
        where: {
          tenantId,
          deletedAt: null,
        },
        select: DUPLICITY_MEMBER_SELECT,
      })) as DuplicityPreloadedMember[]);

  // Checagem por CPF
  if (normCpf) {
    const match = pickBestMemberMatch(
      membros.filter((m) => {
        const mCpf = normalizeCpf(m.cpf).cpf;
        return mCpf && mCpf === normCpf;
      }),
      normName,
    );
    if (match) {
      return buildMemberMatchResult(match, 'CPF');
    }
  }

  // Checagem por Telefone
  if (phoneDigits) {
    const match = pickBestMemberMatch(
      membros.filter((m) => {
        const mDigits = extractPhoneDigits(m.whatsapp);
        return mDigits && mDigits === phoneDigits;
      }),
      normName,
    );
    if (match) {
      return buildMemberMatchResult(match, 'TELEFONE');
    }
  }

  // Checagem por E-mail
  if (normEmail) {
    const match = pickBestMemberMatch(
      membros.filter((m) => {
        const mEmail = normalizeEmail(m.email);
        return mEmail && mEmail === normEmail;
      }),
      normName,
    );
    if (match) {
      return buildMemberMatchResult(match, 'EMAIL');
    }
  }

  // Checagem por Nome Completo Exato
  if (normName) {
    const match = pickBestMemberMatch(
      membros.filter((m) => normalizeName(m.nome) === normName),
      normName,
    );
    if (match) {
      return buildMemberMatchResult(match, 'NOME_EXATO');
    }
  }

  // 2. Verificar se já existe outra ficha PENDENTE com mesmo telefone ou CPF
  const pendingRequests = preloadedContext
    ? preloadedContext.pendingRequests.filter((r) =>
        candidate.excludeSolicitacaoId
          ? r.id !== candidate.excludeSolicitacaoId
          : true,
      )
    : await prisma.solicitacaoCadastroMembro.findMany({
        where: {
          tenantId,
          status: 'PENDENTE',
          ...(candidate.excludeSolicitacaoId
            ? { id: { not: candidate.excludeSolicitacaoId } }
            : {}),
        },
        select: {
          id: true,
          nome: true,
          telefone: true,
          cpf: true,
        },
      });

  if (phoneDigits) {
    const match = pendingRequests.find(
      (r) => extractPhoneDigits(r.telefone) === phoneDigits,
    );
    if (match) {
      return {
        isDuplicate: true,
        membroExistenteNome: match.nome,
        motivoDuplicidade: 'FICHA_PENDENTE',
      };
    }
  }

  if (normCpf) {
    const match = pendingRequests.find(
      (r) => normalizeCpf(r.cpf).cpf === normCpf,
    );
    if (match) {
      return {
        isDuplicate: true,
        membroExistenteNome: match.nome,
        motivoDuplicidade: 'FICHA_PENDENTE',
      };
    }
  }

  return { isDuplicate: false };
}
