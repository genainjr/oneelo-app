export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

export const PIX_KEY_TYPE_LABELS: Record<PixKeyType, string> = {
  CPF: "CPF",
  CNPJ: "CNPJ",
  EMAIL: "E-mail",
  PHONE: "Telefone (Celular)",
  EVP: "Chave aleatória (EVP)",
};

const EMAIL_REGEX = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TXID_REGEX = /^[A-Za-z0-9]{1,25}$/;

export function isValidCpf(rawDigits: string): boolean {
  const digits = rawDigits.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

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
  const digits = rawDigits.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;

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

export function validateAndNormalizePixKey(
  type: PixKeyType,
  rawKey: string,
): { valid: true; normalized: string } | { valid: false; error: string } {
  const trimmed = (rawKey ?? "").trim();
  if (!trimmed) {
    return { valid: false, error: "Informe a chave PIX." };
  }

  switch (type) {
    case "CPF": {
      const digits = trimmed.replace(/\D/g, "");
      if (!isValidCpf(digits)) {
        return { valid: false, error: "Chave PIX CPF inválida. Verifique os 11 dígitos." };
      }
      return { valid: true, normalized: digits };
    }
    case "CNPJ": {
      const digits = trimmed.replace(/\D/g, "");
      if (!isValidCnpj(digits)) {
        return { valid: false, error: "Chave PIX CNPJ inválida. Verifique os 14 dígitos." };
      }
      return { valid: true, normalized: digits };
    }
    case "PHONE": {
      const digits = trimmed.replace(/\D/g, "");
      const normalizedDigits = digits.length === 11 ? `55${digits}` : digits;
      if (
        normalizedDigits.length !== 13 ||
        !normalizedDigits.startsWith("55") ||
        !/^[1-9][1-9]9\d{8}$/.test(normalizedDigits.slice(2))
      ) {
        return {
          valid: false,
          error: "Informe um celular brasileiro válido com DDD (ex: +5511999998888).",
        };
      }
      return { valid: true, normalized: `+${normalizedDigits}` };
    }
    case "EMAIL": {
      const normalized = trimmed.toLowerCase();
      if (normalized.length > 77 || !EMAIL_REGEX.test(normalized)) {
        return { valid: false, error: "Chave PIX de e-mail inválida." };
      }
      return { valid: true, normalized };
    }
    case "EVP": {
      const normalized = trimmed.toLowerCase();
      if (!UUID_REGEX.test(normalized)) {
        return { valid: false, error: "Chave aleatória (EVP) inválida. Informe um UUID válido." };
      }
      return { valid: true, normalized };
    }
    default:
      return { valid: false, error: "Tipo de chave PIX inválido." };
  }
}

export function sanitizeEmvAsciiText(value: string, maxLength: number): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 .\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .trim();
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
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function utf8ByteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

function formatTlv(id: string, value: string): string {
  const length = utf8ByteLength(value);
  return `${id}${String(length).padStart(2, "0")}${value}`;
}

export interface GeneratePixBrCodeInput {
  pixKeyType: PixKeyType;
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  txidPrefix?: string | null;
  amount?: number | null;
}

export function tryGeneratePixBrCode(
  input: GeneratePixBrCodeInput,
): { brCode: string; error?: undefined } | { brCode: null; error: string } {
  const keyResult = validateAndNormalizePixKey(input.pixKeyType, input.pixKey);
  if (!keyResult.valid) {
    return { brCode: null, error: keyResult.error };
  }

  const merchantName = sanitizeEmvAsciiText(input.merchantName, 25);
  if (!merchantName) {
    return { brCode: null, error: "Informe o nome do recebedor (até 25 caracteres sem acentos)." };
  }

  const merchantCity = sanitizeEmvAsciiText(input.merchantCity, 15);
  if (!merchantCity) {
    return { brCode: null, error: "Informe a cidade do recebedor (até 15 caracteres sem acentos)." };
  }

  const trimmedTxid = (input.txidPrefix ?? "").trim();
  if (trimmedTxid && !TXID_REGEX.test(trimmedTxid)) {
    return {
      brCode: null,
      error: "O prefixo TXID deve ter de 1 a 25 caracteres alfanuméricos (A-Z, 0-9), sem espaços.",
    };
  }
  const txid = trimmedTxid || "***";

  let amountField = "";
  if (input.amount !== undefined && input.amount !== null) {
    if (!Number.isFinite(input.amount) || input.amount < 0.01 || input.amount > 9_999_999.99) {
      return {
        brCode: null,
        error: "Valor opcional deve estar entre R$ 0,01 e R$ 9.999.999,99.",
      };
    }
    amountField = formatTlv("54", input.amount.toFixed(2));
  }

  const merchantAccountInfo = formatTlv(
    "26",
    `${formatTlv("00", "br.gov.bcb.pix")}${formatTlv("01", keyResult.normalized)}`,
  );
  const additionalData = formatTlv("62", formatTlv("05", txid));

  const payloadWithoutCrc =
    formatTlv("00", "01") +
    merchantAccountInfo +
    formatTlv("52", "0000") +
    formatTlv("53", "986") +
    amountField +
    formatTlv("58", "BR") +
    formatTlv("59", merchantName) +
    formatTlv("60", merchantCity) +
    additionalData +
    "6304";

  return { brCode: `${payloadWithoutCrc}${crc16CcittFalse(payloadWithoutCrc)}` };
}

export function formatPixKeyForDisplay(type: PixKeyType, key: string): string {
  const clean = (key ?? "").trim();
  if (type === "CPF") {
    const d = clean.replace(/\D/g, "");
    if (d.length === 11) {
      return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    }
  }
  if (type === "CNPJ") {
    const d = clean.replace(/\D/g, "");
    if (d.length === 14) {
      return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
    }
  }
  if (type === "PHONE") {
    const d = clean.replace(/\D/g, "");
    if (d.length === 13 && d.startsWith("55")) {
      return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
    }
  }
  return clean;
}
