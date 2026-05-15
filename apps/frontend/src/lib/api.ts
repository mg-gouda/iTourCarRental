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
    api.get<Array<{ id: string; name: string; code: string; city: string }>>(`/lookup/branches?q=${encodeURIComponent(q)}`),
  users: (q: string, role?: string) => {
    const params = new URLSearchParams({ q });
    if (role) params.set('role', role);
    return api.get<Array<{ id: string; fullName: string; email: string; role: string }>>(`/lookup/users?${params}`);
  },
  cars: (q: string, status?: string, categoryId?: string) => {
    const params = new URLSearchParams({ q });
    if (status) params.set('status', status);
    if (categoryId) params.set('categoryId', categoryId);
    return api.get<Array<{ id: string; make: string; model: string; year: number; licensePlate: string; status: string; category: { id: string; name: string } }>>(`/lookup/cars?${params}`);
  },
  customers: (q: string) =>
    api.get<Array<{ id: string; fullName: string; email: string | null; phone: string; flag: string | null }>>(`/lookup/customers?q=${encodeURIComponent(q)}`),
  corporateAccounts: (q: string) =>
    api.get<Array<{ id: string; name: string; taxNumber: string | null }>>(`/lookup/corporate-accounts?q=${encodeURIComponent(q)}`),
  carCategories: (q: string) =>
    api.get<Array<{ id: string; name: string; description: string | null }>>(`/lookup/car-categories?q=${encodeURIComponent(q)}`),
  tags: (q: string) =>
    api.get<Array<{ id: string; name: string }>>(`/lookup/tags?q=${encodeURIComponent(q)}`),
};

// ─── Car types ───────────────────────────────────────────────────────────────

export type CarStatus = 'AVAILABLE' | 'RENTED' | 'IN_MAINTENANCE' | 'OUT_OF_SERVICE';
export type FuelType = 'PETROL' | 'DIESEL' | 'HYBRID' | 'ELECTRIC' | 'LPG';
export type Transmission = 'MANUAL' | 'AUTOMATIC';

export interface CarCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface Car {
  id: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin: string;
  transmission: Transmission;
  fuelType: FuelType;
  seats: number;
  currentMileage: number;
  status: CarStatus;
  purchaseCost: string | null;
  purchasedAt: string | null;
  registrationExpiry: string | null;
  gpsDeviceId: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string };
  homeBranch: { id: string; name: string };
  _count: { photos: number; bookings: number };
}

export interface CreateCarDto {
  make: string; model: string; year: number;
  licensePlate: string; vin: string; categoryId: string;
  transmission: Transmission; fuelType: FuelType; seats: number;
  homeBranchId: string; currentBranchId?: string;
  currentMileage?: number; purchaseCost?: string;
  purchasedAt?: string; registrationExpiry?: string;
  gpsDeviceId?: string;
}

export type UpdateCarDto = Partial<CreateCarDto> & { status?: CarStatus };

export const carsApi = {
  listCategories: () => api.get<CarCategory[]>('/cars/categories'),
  createCategory: (dto: { name: string; description?: string; sortOrder?: number }) =>
    api.post<CarCategory>('/cars/categories', dto),
  updateCategory: (id: string, dto: { name?: string; description?: string; sortOrder?: number }) =>
    api.patch<CarCategory>(`/cars/categories/${id}`, dto),
  deleteCategory: (id: string) => api.delete<void>(`/cars/categories/${id}`),

  list: (params?: { page?: number; limit?: number; status?: string; categoryId?: string; branchId?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.status) q.set('status', params.status);
    if (params?.categoryId) q.set('categoryId', params.categoryId);
    if (params?.branchId) q.set('branchId', params.branchId);
    if (params?.search) q.set('search', params.search);
    return api.get<PaginatedResponse<Car>>(`/cars?${q}`);
  },
  get: (id: string) => api.get<Car>(`/cars/${id}`),
  create: (dto: CreateCarDto) => api.post<Car>('/cars', dto),
  update: (id: string, dto: UpdateCarDto) => api.patch<Car>(`/cars/${id}`, dto),
  delete: (id: string) => api.delete<void>(`/cars/${id}`),
  transfer: (id: string, dto: { toBranchId: string; notes?: string }) =>
    api.post<void>(`/cars/${id}/transfer`, dto),
  addTag: (id: string, name: string) => api.post<void>(`/cars/${id}/tags`, { name }),
  removeTag: (id: string, tagId: string) => api.delete<void>(`/cars/${id}/tags/${tagId}`),
};

// ─── Insurance types ─────────────────────────────────────────────────────────

export interface InsurancePolicy {
  id: string;
  carId: string;
  provider: string;
  policyNumber: string;
  coverage: string;
  startAt: string;
  expiryAt: string;
  premium: string | null;
  currency: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const insuranceApi = {
  listPolicies: (carId: string) => api.get<InsurancePolicy[]>(`/insurance/cars/${carId}/policies`),
  createPolicy: (dto: { carId: string; provider: string; policyNumber: string; coverage: string; startAt: string; expiryAt: string; premium?: string; currency?: string; notes?: string }) =>
    api.post<InsurancePolicy>('/insurance/policies', dto),
  updatePolicy: (id: string, dto: Partial<Omit<InsurancePolicy, 'id' | 'carId' | 'createdAt' | 'updatedAt'>>) =>
    api.patch<InsurancePolicy>(`/insurance/policies/${id}`, dto),
  deletePolicy: (id: string) => api.delete<void>(`/insurance/policies/${id}`),
};

// ─── Customer types ───────────────────────────────────────────────────────────

export type CustomerSource = 'ADMIN_CREATED' | 'SELF_REGISTERED' | 'WALK_IN';
export type CustomerFlag = 'BLACKLISTED' | 'WATCHLIST' | 'VIP';

export interface DriverLicense {
  id: string;
  licenseNumber: string;
  issuingCountry: string;
  licenseType: string;
  expiryDate: string;
  storageKey: string | null;
}

export interface Customer {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  address: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  source: CustomerSource;
  flag: CustomerFlag | null;
  flagReason: string | null;
  internalNotes: string | null;
  visibleNotes: string | null;
  createdAt: string;
  updatedAt: string;
  corporateAccount: { id: string; name: string } | null;
  licenses: DriverLicense[];
  _count: { bookings: number };
}

export interface CreateCustomerDto {
  fullName: string; phone: string; source: CustomerSource;
  email?: string; address?: string; nationality?: string;
  dateOfBirth?: string; flag?: CustomerFlag; flagReason?: string;
  corporateAccountId?: string; internalNotes?: string; visibleNotes?: string;
  primaryLicense?: { licenseNumber: string; issuingCountry: string; licenseType: string; expiryDate: string };
}

export type UpdateCustomerDto = Partial<Omit<CreateCustomerDto, 'primaryLicense'>>;

export const customersApi = {
  list: (params?: { page?: number; limit?: number; search?: string; flag?: string; corporateAccountId?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.flag) q.set('flag', params.flag);
    if (params?.corporateAccountId) q.set('corporateAccountId', params.corporateAccountId);
    return api.get<PaginatedResponse<Customer>>(`/customers?${q}`);
  },
  get: (id: string) => api.get<Customer>(`/customers/${id}`),
  create: (dto: CreateCustomerDto) => api.post<Customer>('/customers', dto),
  update: (id: string, dto: UpdateCustomerDto) => api.patch<Customer>(`/customers/${id}`, dto),
  delete: (id: string) => api.delete<void>(`/customers/${id}`),
  addLicense: (id: string, dto: { licenseNumber: string; issuingCountry: string; licenseType: string; expiryDate: string }) =>
    api.post<DriverLicense>(`/customers/${id}/licenses`, dto),
  deleteLicense: (id: string, licenseId: string) => api.delete<void>(`/customers/${id}/licenses/${licenseId}`),
  addTag: (id: string, name: string) => api.post<void>(`/customers/${id}/tags`, { name }),
  removeTag: (id: string, tagId: string) => api.delete<void>(`/customers/${id}/tags/${tagId}`),
};

// ─── Corporate account types ──────────────────────────────────────────────────

export interface CorporateAccount {
  id: string;
  name: string;
  taxNumber: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  billingAddress: string | null;
  creditLimit: string | null;
  currency: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { customers: number };
}

export interface CreateCorporateAccountDto {
  name: string; taxNumber?: string; contactName?: string;
  contactEmail?: string; contactPhone?: string;
  billingAddress?: string; creditLimit?: string;
  currency?: string; notes?: string;
}

export type UpdateCorporateAccountDto = Partial<CreateCorporateAccountDto>;

export const corporateAccountsApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    return api.get<PaginatedResponse<CorporateAccount>>(`/corporate-accounts?${q}`);
  },
  get: (id: string) => api.get<CorporateAccount>(`/corporate-accounts/${id}`),
  create: (dto: CreateCorporateAccountDto) => api.post<CorporateAccount>('/corporate-accounts', dto),
  update: (id: string, dto: UpdateCorporateAccountDto) => api.patch<CorporateAccount>(`/corporate-accounts/${id}`, dto),
  delete: (id: string) => api.delete<void>(`/corporate-accounts/${id}`),
};
