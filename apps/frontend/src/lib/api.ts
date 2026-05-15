/**
 * Typed API client for the backend.
 * All requests go through this module — no direct fetch calls in components.
 */

const API_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1')
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://backend:4000/api/v1');

export class ApiError extends Error {
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    try { errorBody = await res.json(); } catch { /* ignore */ }
    throw new ApiError(
      res.status,
      errorBody.error?.code ?? 'UNKNOWN',
      errorBody.error?.message ?? `HTTP ${res.status}`,
      errorBody.error?.details,
    );
  }

  if (res.status === 204) return undefined as T;

  const body = (await res.json()) as { data: T } | T;
  if (body !== null && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, { method: 'GET', ...init }),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined, ...init }),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined, ...init }),
  put: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined, ...init }),
  delete: <T>(path: string, init?: RequestInit) => request<T>(path, { method: 'DELETE', ...init }),
};

// ─── Domain types ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  city: string;
  country: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchDto {
  name: string;
  code: string;
  city: string;
  country: string;
  address?: string;
  phone?: string;
  email?: string;
  currency?: string;
  timezone?: string;
}

export type UpdateBranchDto = Partial<CreateBranchDto> & { isActive?: boolean };

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  branchScope: string[];
  isActive: boolean;
  twoFactorEnabled: boolean;
  language: string;
  themePreference: string | null;
  notificationPrefs: Record<string, unknown>;
  avatarUrl?: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  email: string;
  fullName: string;
  password: string;
  role: string;
  branchScope?: string[];
}

export type UpdateUserDto = Partial<Omit<CreateUserDto, 'password'>> & { isActive?: boolean };

export interface RolePermissions {
  role: string;
  permissions: Record<string, boolean>;
}

export interface PermissionOverride {
  id: string;
  key: string;
  effect: 'grant' | 'revoke';
  createdAt: string;
}

// ─── Typed API helpers ───────────────────────────────────────────────────────

export const branchesApi = {
  list: (params?: { page?: number; limit?: number; isActive?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.isActive !== undefined) q.set('isActive', String(params.isActive));
    return api.get<PaginatedResponse<Branch>>(`/branches?${q}`);
  },
  get: (id: string) => api.get<Branch>(`/branches/${id}`),
  create: (dto: CreateBranchDto) => api.post<Branch>('/branches', dto),
  update: (id: string, dto: UpdateBranchDto) => api.patch<Branch>(`/branches/${id}`, dto),
  delete: (id: string) => api.delete<void>(`/branches/${id}`),
};

export const usersApi = {
  list: (params?: { page?: number; limit?: number; role?: string; branchId?: string; isActive?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.role) q.set('role', params.role);
    if (params?.branchId) q.set('branchId', params.branchId);
    if (params?.isActive !== undefined) q.set('isActive', String(params.isActive));
    return api.get<PaginatedResponse<User>>(`/users?${q}`);
  },
  get: (id: string) => api.get<User>(`/users/${id}`),
  create: (dto: CreateUserDto) => api.post<User>('/users', dto),
  update: (id: string, dto: UpdateUserDto) => api.patch<User>(`/users/${id}`, dto),
  delete: (id: string) => api.delete<void>(`/users/${id}`),
  resetPassword: (id: string, newPassword: string) =>
    api.post<void>(`/users/${id}/reset-password`, { newPassword }),
};

export const profileApi = {
  me: () => api.get<User>('/auth/me'),
  update: (dto: { fullName?: string; language?: string; themePreference?: string | null; notificationPrefs?: Record<string, unknown> }) =>
    api.patch<User>('/profile', dto),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<void>('/profile/change-password', { currentPassword, newPassword }),
  setup2fa: () => api.post<{ otpauthUrl: string; secret: string }>('/profile/2fa/setup'),
  verify2fa: (totpCode: string) => api.post<void>('/profile/2fa/verify', { totpCode }),
  disable2fa: (currentPassword: string) => api.delete<void>('/profile/2fa'),
  getSessions: () => api.get<Array<{ id: string; device: string | null; ip: string | null; userAgent: string | null; createdAt: string; lastActiveAt: string; isCurrent: boolean }>>('/auth/sessions'),
  revokeSession: (sessionId: string) => api.delete<void>(`/auth/sessions/${sessionId}`),
};

export const permissionsApi = {
  getAllRoles: () => api.get<RolePermissions[]>('/permissions/roles'),
  getRole: (role: string) => api.get<RolePermissions>(`/permissions/roles/${role}`),
  updateRole: (role: string, key: string, effect: 'grant' | 'revoke') =>
    api.patch<void>(`/permissions/roles/${role}`, { key, effect }),
  getUserOverrides: (userId: string) =>
    api.get<PermissionOverride[]>(`/permissions/users/${userId}/overrides`),
  setUserOverride: (userId: string, key: string, effect: 'grant' | 'revoke') =>
    api.post<void>(`/permissions/users/${userId}/overrides`, { key, effect }),
  deleteUserOverride: (userId: string, key: string) =>
    api.delete<void>(`/permissions/users/${userId}/overrides/${key}`),
  getUserEffective: (userId: string) =>
    api.get<{ userId: string; role: string; permissions: string[] }>(`/permissions/users/${userId}/effective`),
};

export const lookupApi = {
  branches: (q: string) =>
    api.get<Array<{ value: string; label: string }>>(`/lookup/branches?q=${encodeURIComponent(q)}`),
  users: (q: string) =>
    api.get<Array<{ value: string; label: string; description: string }>>(`/lookup/users?q=${encodeURIComponent(q)}`),
};
