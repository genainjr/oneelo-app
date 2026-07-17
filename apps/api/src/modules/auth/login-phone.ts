import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function normalizeLoginPhone(value: string): string | null {
  const input = value.trim();

  if (!input.startsWith('+')) {
    return null;
  }

  const phone = parsePhoneNumberFromString(input);

  if (!phone?.isValid()) {
    return null;
  }

  return phone.number;
}

export function maskLoginPhone(value: string | null | undefined): string | null {
  if (!value) return null;

  const visibleDigits = value.replace(/\D/g, '').slice(-4);
  return visibleDigits ? `***${visibleDigits}` : null;
}
