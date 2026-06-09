import type { Request } from 'express';

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function getClientIp(req: Request): string | undefined {
  const forwardedFor = firstHeaderValue(req.headers['x-forwarded-for']);
  const realIp = firstHeaderValue(req.headers['x-real-ip']);
  const forwardedIp = forwardedFor?.split(',')[0]?.trim();

  return forwardedIp || realIp?.trim() || req.ip;
}
