import { BadRequestException } from '@nestjs/common';
import { PixKeyType } from '@prisma/client';

const EMAIL_REGEX = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TXID_REGEX = /^[A-Za-z0-9]{1,25}$/;

export function isValidCpf(rawDigits: string): boolean {
  const digits = rawDigits.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === Number(digits[10]);
}

export function isValidCnpj(rawDigits: string): boolean {
  const digits = rawDigits.replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) {
    return false;
  }

  const calcDigit = (slice: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i += 1) {
      sum += Number(slice[i]) * weights[i];
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first = calcDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (first !== Number(digits[12])) return false;

  const second = calcDigit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return second === Number(digits[13]);
}

export function normalizeAndValidatePixKey(type: PixKeyType, rawKey: string): string {
  const trimmed = (rawKey ?? '').trim();
  if (!trimmed) {
    throw new BadRequestException('Informe a chave PIX.');
  }

  switch (type) {
    case PixKeyType.CPF: {
      const digits = trimmed.replace(/\D/g, '');
      if (!isValidCpf(digits)) {
        throw new BadRequestException('Chave PIX CPF inválida. Verifique os 11 dígitos.');
      }
      return digits;
    }

    case PixKeyType.CNPJ: {
      const digits = trimmed.replace(/\D/g, '');
      if (!isValidCnpj(digits)) {
        throw new BadRequestException('Chave PIX CNPJ inválida. Verifique os 14 dígitos.');
      }
      return digits;
    }

    case PixKeyType.PHONE: {
      const digits = trimmed.replace(/\D/g, '');
      let normalizedDigits = digits;
      if (digits.length === 11) {
        normalizedDigits = `55${digits}`;
      }
      if (
        normalizedDigits.length !== 13 ||
        !normalizedDigits.startsWith('55') ||
        !/^[1-9][1-9]9\d{8}$/.test(normalizedDigits.slice(2))
      ) {
        throw new BadRequestException(
          'Chave PIX de telefone inválida. Informe um celular brasileiro com DDD (ex: +5511999998888).',
        );
      }
      return `+${normalizedDigits}`;
    }

    case PixKeyType.EMAIL: {
      const normalized = trimmed.toLowerCase();
      if (normalized.length > 77 || !EMAIL_REGEX.test(normalized)) {
        throw new BadRequestException('Chave PIX de e-mail inválida.');
      }
      return normalized;
    }

    case PixKeyType.EVP: {
      const normalized = trimmed.toLowerCase();
      if (!UUID_REGEX.test(normalized)) {
        throw new BadRequestException(
          'Chave aleatória (EVP) inválida. Informe um UUID válido.',
        );
      }
      return normalized;
    }

    default:
      throw new BadRequestException('Tipo de chave PIX inválido.');
  }
}

export function sanitizeEmvAsciiText(value: string, maxLength: number): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();
}

export function normalizePixMerchantName(value: string): string {
  const sanitized = sanitizeEmvAsciiText(value, 25);
  if (!sanitized) {
    throw new BadRequestException(
      'Informe um nome do recebedor válido (até 25 caracteres sem acentos).',
    );
  }
  return sanitized;
}

export function normalizePixMerchantCity(value: string): string {
  const sanitized = sanitizeEmvAsciiText(value, 15);
  if (!sanitized) {
    throw new BadRequestException(
      'Informe uma cidade válida para o recebedor (até 15 caracteres sem acentos).',
    );
  }
  return sanitized;
}

export function normalizePixTxid(raw?: string | null): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return '***';
  }
  if (!TXID_REGEX.test(trimmed)) {
    throw new BadRequestException(
      'O prefixo TXID deve conter entre 1 e 25 caracteres alfanuméricos (A-Z, 0-9), sem espaços ou símbolos.',
    );
  }
  return trimmed;
}

export function crc16CcittFalse(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= (payload.charCodeAt(i) & 0xff) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatTlv(id: string, value: string): string {
  const length = Buffer.byteLength(value, 'utf8');
  if (length > 99) {
    throw new BadRequestException(`Campo EMVCo ${id} excede o limite de 99 bytes.`);
  }
  return `${id}${String(length).padStart(2, '0')}${value}`;
}

export interface GeneratePixBrCodeInput {
  pixKeyType: PixKeyType;
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  txidPrefix?: string | null;
  amount?: number | null;
}

export function generatePixBrCode(input: GeneratePixBrCodeInput): string {
  const normalizedKey = normalizeAndValidatePixKey(input.pixKeyType, input.pixKey);
  const merchantName = normalizePixMerchantName(input.merchantName);
  const merchantCity = normalizePixMerchantCity(input.merchantCity);
  const txid = normalizePixTxid(input.txidPrefix);

  let amountField = '';
  if (input.amount !== undefined && input.amount !== null) {
    if (
      typeof input.amount !== 'number' ||
      !Number.isFinite(input.amount) ||
      input.amount < 0.01 ||
      input.amount > 9_999_999.99
    ) {
      throw new BadRequestException(
        'O valor informado para o PIX deve estar entre R$ 0,01 e R$ 9.999.999,99.',
      );
    }
    amountField = formatTlv('54', input.amount.toFixed(2));
  }

  const merchantAccountInfo = formatTlv(
    '26',
    `${formatTlv('00', 'br.gov.bcb.pix')}${formatTlv('01', normalizedKey)}`,
  );
  const additionalData = formatTlv('62', formatTlv('05', txid));

  const payloadWithoutCrc =
    formatTlv('00', '01') +
    merchantAccountInfo +
    formatTlv('52', '0000') +
    formatTlv('53', '986') +
    amountField +
    formatTlv('58', 'BR') +
    formatTlv('59', merchantName) +
    formatTlv('60', merchantCity) +
    additionalData +
    '6304';

  return `${payloadWithoutCrc}${crc16CcittFalse(payloadWithoutCrc)}`;
}

export function formatPixKeyForDisplay(type: PixKeyType, key: string): string {
  const clean = (key ?? '').trim();
  if (type === PixKeyType.CPF) {
    const d = clean.replace(/\D/g, '');
    if (d.length === 11) {
      return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    }
  }
  if (type === PixKeyType.CNPJ) {
    const d = clean.replace(/\D/g, '');
    if (d.length === 14) {
      return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
    }
  }
  if (type === PixKeyType.PHONE) {
    const d = clean.replace(/\D/g, '');
    if (d.length === 13 && d.startsWith('55')) {
      return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
    }
  }
  return clean;
}
