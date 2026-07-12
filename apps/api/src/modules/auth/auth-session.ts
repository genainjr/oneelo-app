import type { StringValue } from 'ms';

export const DEFAULT_USER_SESSION_EXPIRES_IN = '1d';

const DURATION_UNITS_IN_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function parseDurationToMilliseconds(duration: string): number {
  const match = duration.trim().match(/^(\d+)([smhd])$/i);

  if (!match) {
    return DURATION_UNITS_IN_MS.d;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  return amount * DURATION_UNITS_IN_MS[unit];
}

export function getUserSessionExpiresIn(value?: string): StringValue {
  const duration = value?.trim();

  if (!duration || !/^\d+[smhd]$/i.test(duration)) {
    return DEFAULT_USER_SESSION_EXPIRES_IN;
  }

  return duration as StringValue;
}
