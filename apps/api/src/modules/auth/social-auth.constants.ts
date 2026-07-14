export const GOOGLE_OAUTH_SCOPES = ['openid', 'email', 'profile'] as const;

export const OAUTH_STATE_COOKIE = 'oneelo_oauth_state';
export const OAUTH_PENDING_LINK_COOKIE = 'oneelo_oauth_pending_link';

export const OAUTH_STATE_EXPIRES_IN = '10m';
export const OAUTH_PENDING_LINK_EXPIRES_IN = '10m';
export const OAUTH_TRANSIENT_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

