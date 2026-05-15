export interface SessionDto {
  id: string;
  device?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}
