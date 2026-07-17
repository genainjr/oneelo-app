const DEFAULT_LOCAL_FRONTEND_URL = 'http://localhost:3001';
const DEFAULT_PRODUCTION_FRONTEND_URL = 'https://oneelo.vercel.app';

export function buildActivationLink(
  token: string,
  configuredOrigins?: string,
  nodeEnv?: string,
) {
  const configuredFrontendUrl = configuredOrigins
    ?.split(',')
    .map((origin) => origin.trim())
    .find(Boolean);
  const frontendUrl = configuredFrontendUrl || (
    nodeEnv === 'production'
      ? DEFAULT_PRODUCTION_FRONTEND_URL
      : DEFAULT_LOCAL_FRONTEND_URL
  );

  return `${frontendUrl.replace(/\/$/, '')}/activate/${token}`;
}
