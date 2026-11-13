const DEFAULT_SYSTEM_HOSTS = [
  'localhost',
  '127.0.0.1',
  '::1',
  'oneelo.com',
  'www.oneelo.com',
  'oneelo.com.br',
  'www.oneelo.com.br',
  'app.oneelo.com.br',
  'oneelo.vercel.app',
];

const IPV4_HOST_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export function getCanonicalAppOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://oneelo.vercel.app';
  return raw.replace(/\/+$/, '');
}

export function extractHostname(rawHostHeader: string | null | undefined): string {
  if (!rawHostHeader) return '';
  const value = rawHostHeader.split(',')[0].trim().toLowerCase();
  if (!value) return '';

  if (value.startsWith('[')) {
    const endBracket = value.indexOf(']');
    return endBracket > 0 ? value.slice(1, endBracket) : value;
  }

  const colonIndex = value.indexOf(':');
  const withoutPort =
    colonIndex !== -1 && value.indexOf(':', colonIndex + 1) === -1
      ? value.slice(0, colonIndex)
      : value;

  return withoutPort.replace(/\.+$/, '');
}

export function isSystemHost(rawHost: string | null | undefined): boolean {
  const host = extractHostname(rawHost);
  if (!host) return true;

  // Custom domains are always public FQDNs; raw IP addresses (localhost/LAN) and
  // local domains must never enter custom-domain rewriting or canonical redirects.
  if (
    IPV4_HOST_REGEX.test(host) ||
    host.includes(':') ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  const extraHosts = [
    process.env.NEXT_PUBLIC_SYSTEM_HOSTS ?? '',
    process.env.WEBSITE_SYSTEM_HOSTS ?? '',
    process.env.NEXT_ALLOWED_DEV_ORIGINS ?? '',
  ]
    .join(',')
    .split(',')
    .map((item) => item.trim().toLowerCase().replace(/^https?:\/\//, ''))
    .map((item) => extractHostname(item))
    .filter(Boolean);

  try {
    const appUrlHost = extractHostname(new URL(getCanonicalAppOrigin()).hostname);
    if (appUrlHost) extraHosts.push(appUrlHost);
  } catch {
    // Ignore invalid env URL
  }

  const systemSet = new Set([...DEFAULT_SYSTEM_HOSTS, ...extraHosts]);

  if (
    systemSet.has(host) ||
    host.endsWith('.vercel.app') ||
    host.endsWith('.oneelo.com.br') ||
    host.endsWith('.oneelo.com')
  ) {
    return true;
  }

  return false;
}

export function isCustomDomainAllowedPath(pathname: string): boolean {
  if (pathname === '/' || pathname === '/cadastro' || pathname === '/og') {
    return true;
  }

  if (pathname.startsWith('/noticias/') && pathname.length > '/noticias/'.length) {
    const rest = pathname.slice('/noticias/'.length);
    return !rest.includes('/');
  }

  return false;
}
