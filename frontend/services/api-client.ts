import { env } from '@/lib/env';
import { useAuthStore } from '@/store/auth-store';
import type { PageMeta, Session } from '@/types/api';

/** Error thrown for any non-2xx API response, carrying the server's stable error code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field errors from a 400 VALIDATION_ERROR, keyed by field path. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(
      (this.details as { path: string; message: string }[]).map((issue) => [issue.path, issue.message]),
    );
  }
}

interface Envelope<T> {
  success: boolean;
  data: T;
  meta?: PageMeta;
  error?: { code: string; message: string; details?: unknown; requestId?: string };
}

export interface ApiResult<T> {
  data: T;
  meta: PageMeta | undefined;
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

const CSRF_HEADERS = { 'X-Requested-With': 'XMLHttpRequest' };

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${env.apiUrl}/api${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function parse<T>(response: Response): Promise<ApiResult<T>> {
  if (response.status === 204) return { data: undefined as T, meta: undefined };
  const body = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !body?.success) {
    const error = body?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'NETWORK_ERROR',
      error?.message ?? 'Something went wrong. Please try again.',
      error?.details,
      error?.requestId,
    );
  }
  return { data: body.data, meta: body.meta };
}

// ─── Session refresh (single-flight) ─────────────────────────────────────────

let refreshPromise: Promise<Session | null> | null = null;

async function doRefresh(attempt = 0): Promise<Session | null> {
  const response = await fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    headers: CSRF_HEADERS,
  });
  try {
    const { data } = await parse<Session>(response);
    useAuthStore.getState().setSession(data);
    return data;
  } catch (error) {
    // Another tab rotated the token a moment ago; the browser now holds the new cookie.
    if (error instanceof ApiError && error.code === 'REFRESH_TOKEN_ROTATED' && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return doRefresh(1);
    }
    useAuthStore.getState().clear();
    return null;
  }
}

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<Session | null> {
  refreshPromise ??= doRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

// ─── Requests ────────────────────────────────────────────────────────────────

async function send<T>(path: string, options: RequestOptions, retried = false): Promise<ApiResult<T>> {
  const token = useAuthStore.getState().accessToken;
  const isFormData = options.body instanceof FormData;

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    credentials: 'include',
    signal: options.signal,
    headers: {
      ...(isFormData || options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: isFormData ? (options.body as FormData) : options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  // Access token expired → refresh once and replay the request.
  if (response.status === 401 && token && !retried) {
    const session = await refreshSession();
    if (session) return send<T>(path, options, true);
  }
  return parse<T>(response);
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => send<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => send<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => send<T>(path, { method: 'PATCH', body }),
  delete: <T = void>(path: string) => send<T>(path, { method: 'DELETE' }),

  /** Auth endpoints that use the refresh cookie. */
  async logout(): Promise<void> {
    await fetch(buildUrl('/auth/logout'), { method: 'POST', credentials: 'include', headers: CSRF_HEADERS }).catch(
      () => undefined,
    );
    useAuthStore.getState().clear();
  },
};
