export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  corsOrigin: string;
  sessionSecret: string;
  cookieSecure: boolean;
  seedAdminEmail: string;
  seedAdminPassword: string;
}

export function configuration(): AppConfig {
  return {
    port: parseInt(process.env.PORT ?? '4000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/carrental',
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    sessionSecret: process.env.SESSION_SECRET ?? 'change-me-in-production',
    cookieSecure: process.env.NODE_ENV === 'production',
    seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@carrental.local',
    seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'Admin1234!',
  };
}
