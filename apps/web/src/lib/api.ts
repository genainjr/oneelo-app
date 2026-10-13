import { ApiError } from '@/types';

// Em produção no browser, usa caminho relativo (proxy do Next.js via rewrites)
// No servidor (SSR/middleware) e em dev local, usa a URL direta da API (suporta INTERNAL_API_URL no Docker)
const API_BASE =
  typeof window !== 'undefined'
    ? ''
    : (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001');

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

// ─── Erros customizados ───────────────────────────────────────────────────────

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly data: ApiError,
  ) {
    const msg = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message;
    super(msg);
    this.name = 'HttpError';
  }
}

export interface ApiFileResponse {
  blob: Blob;
  fileName: string | null;
  headers: Headers;
}

function getFileName(contentDisposition: string | null) {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
}

// ─── Cliente HTTP ─────────────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    credentials: 'include',
    headers: isFormData || isBlob
      ? {
          ...headers,
        }
      : {
          'Content-Type': 'application/json',
          ...headers,
        },
    body: body === undefined ? undefined : isFormData || isBlob ? body : JSON.stringify(body),
  });

  // Sem conteúdo (ex: DELETE retornando 204)
  if (res.status === 204) {
    return undefined as T;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = { statusCode: res.status, message: res.statusText };
  }

  if (!res.ok) {
    throw new HttpError(res.status, data as ApiError);
  }

  return data as T;
}

async function requestFile(path: string, options: RequestOptions = {}): Promise<ApiFileResponse> {
  const { body, headers, ...rest } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    credentials: 'include',
    headers: isFormData || isBlob
      ? { ...headers }
      : { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : isFormData || isBlob ? body : JSON.stringify(body),
  });

  if (!res.ok) {
    let data: ApiError;
    try {
      data = await res.json() as ApiError;
    } catch {
      data = { statusCode: res.status, message: res.statusText };
    }
    throw new HttpError(res.status, data);
  }

  return {
    blob: await res.blob(),
    fileName: getFileName(res.headers.get('Content-Disposition')),
    headers: res.headers,
  };
}

// ─── Métodos HTTP ─────────────────────────────────────────────────────────────

export const api = {
  get<T>(path: string, options?: RequestOptions) {
    return request<T>(path, { ...options, method: 'GET' });
  },

  getFile(path: string, options?: RequestOptions) {
    return requestFile(path, { ...options, method: 'GET' });
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>(path, { ...options, method: 'POST', body });
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>(path, { ...options, method: 'PATCH', body });
  },

  put<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>(path, { ...options, method: 'PUT', body });
  },

  delete<T>(path: string, options?: RequestOptions) {
    return request<T>(path, { ...options, method: 'DELETE' });
  },
};

// ─── Utilitário para query strings ───────────────────────────────────────────

export function buildQuery(params: any): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return q ? `?${q}` : '';
}
