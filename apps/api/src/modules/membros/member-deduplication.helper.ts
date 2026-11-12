import { parsePhoneNumberFromString } from 'libphonenumber-js';
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
}

/**
 * Consulta duplicidade de cadastro no tenant por telefone, CPF, e-mail e nome exato
 */
export async function checkMemberDuplicity(
  prisma: PrismaService,
  tenantId: string,
  candidate: {
    telefone?: string | null;
    cpf?: string | null;
    email?: string | null;
    nome?: string | null;
    excludeSolicitacaoId?: string;
  },
): Promise<DuplicityCheckResult> {
  const normCpf = normalizeCpf(candidate.cpf).cpf;
  const normEmail = normalizeEmail(candidate.email);
  const normPhone = normalizePhone(candidate.telefone).phone;
  const phoneDigits = extractPhoneDigits(normPhone || candidate.telefone);
  const normName = normalizeName(candidate.nome);

  // 1. Buscar membros existentes no tenant
  const membros = await prisma.membro.findMany({
    where: { tenantId },
    select: {
      id: true,
      nome: true,
      whatsapp: true,
      email: true,
      cpf: true,
      status: true,
    },
  });

  // Checagem por CPF
  if (normCpf) {
    const match = membros.find((m) => {
      const mCpf = normalizeCpf(m.cpf).cpf;
      return mCpf && mCpf === normCpf;
    });
    if (match) {
      return {
        isDuplicate: true,
        membroExistenteId: match.id,
        membroExistenteNome: match.nome,
        membroExistenteStatus: match.status,
        motivoDuplicidade: 'CPF',
      };
    }
  }

  // Checagem por Telefone
  if (phoneDigits) {
    const match = membros.find((m) => {
      const mDigits = extractPhoneDigits(m.whatsapp);
      return mDigits && mDigits === phoneDigits;
    });
    if (match) {
      return {
        isDuplicate: true,
        membroExistenteId: match.id,
        membroExistenteNome: match.nome,
        membroExistenteStatus: match.status,
        motivoDuplicidade: 'TELEFONE',
      };
    }
  }

  // Checagem por E-mail
  if (normEmail) {
    const match = membros.find((m) => {
      const mEmail = normalizeEmail(m.email);
      return mEmail && mEmail === normEmail;
    });
    if (match) {
      return {
        isDuplicate: true,
        membroExistenteId: match.id,
        membroExistenteNome: match.nome,
        membroExistenteStatus: match.status,
        motivoDuplicidade: 'EMAIL',
      };
    }
  }

  // Checagem por Nome Completo Exato
  if (normName) {
    const match = membros.find((m) => normalizeName(m.nome) === normName);
    if (match) {
      return {
        isDuplicate: true,
        membroExistenteId: match.id,
        membroExistenteNome: match.nome,
        membroExistenteStatus: match.status,
        motivoDuplicidade: 'NOME_EXATO',
      };
    }
  }

  // 2. Verificar se já existe outra ficha PENDENTE com mesmo telefone ou CPF
  const pendingRequests = await prisma.solicitacaoCadastroMembro.findMany({
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
