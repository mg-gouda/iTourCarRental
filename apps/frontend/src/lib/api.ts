/**
 * Typed API client for the backend.
 * All requests go through this module — no direct fetch calls in components.
 */

const API_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1')
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://backend:4000/api/v1');

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!res.ok) {
    let errorBody: { error?: { code?: string; message?: string; details?: unknown } } = {};
    try {
      errorBody = await res.json();
    } catch {
      /* ignore parse errors */
    }
    throw new ApiError(
      res.status,
      errorBody.error?.code ?? 'UNKNOWN',
      errorBody.error?.message ?? `HTTP ${res.status}`,
      errorBody.error?.details,
    );
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const body = (await res.json()) as { data: T } | T;
  // Unwrap { data: T } envelope
  if (body !== null && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { method: 'GET', ...init }),

  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...init,
    }),

  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...init,
    }),

  put: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...init,
    }),

  delete: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { method: 'DELETE', ...init }),
};

export { ApiError };
