import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@carrental.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin1234!';

  const passwordHash = await argon2.hash(adminPassword);

  // 1. Upsert Super Admin
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: {
      email: adminEmail,
      passwordHash,
      fullName: 'Super Admin',
      role: 'SUPER_ADMIN',
      branchScope: [],
      isActive: true,
      language: 'en',
    },
  });
  console.log(`✓ Super Admin upserted: ${admin.email}`);

  // 2. Create Cairo HQ branch
  const branch = await prisma.branch.upsert({
    where: { code: 'CAI' },
    update: {},
    create: {
      name: 'Cairo HQ',
      code: 'CAI',
      city: 'Cairo',
      country: 'Egypt',
      timezone: 'Africa/Cairo',
      defaultCurrency: 'EGP',
      taxRate: 0.14,
      taxInclusive: false,
      isActive: true,
    },
  });
  console.log(`✓ Branch upserted: ${branch.name}`);

  // 3. Create Car Categories
  const categories = [
    { name: 'Economy', sortOrder: 1 },
    { name: 'Compact', sortOrder: 2 },
    { name: 'Midsize', sortOrder: 3 },
    { name: 'SUV', sortOrder: 4 },
    { name: 'Luxury', sortOrder: 5 },
    { name: 'Van', sortOrder: 6 },
  ];

  for (const cat of categories) {
    await prisma.carCategory.upsert({
      where: { name: cat.name },
      update: { sortOrder: cat.sortOrder },
      create: cat,
    });
  }
  console.log(`✓ Car categories seeded: ${categories.map((c) => c.name).join(', ')}`);

  // 4. Default Styling Profile
  const defaultTokens = {
    '--color-primary': '#2563eb',
    '--color-primary-foreground': '#ffffff',
    '--color-accent': '#0ea5e9',
    '--color-accent-foreground': '#ffffff',
    '--color-background': '#ffffff',
    '--color-foreground': '#0f172a',
    '--color-card': '#f8fafc',
    '--color-card-foreground': '#0f172a',
    '--color-border': '#e2e8f0',
    '--color-input': '#e2e8f0',
    '--color-ring': '#2563eb',
    '--color-muted': '#f1f5f9',
    '--color-muted-foreground': '#64748b',
    '--color-destructive': '#ef4444',
    '--color-destructive-foreground': '#ffffff',
    '--color-success': '#22c55e',
    '--color-success-foreground': '#ffffff',
    '--color-warning': '#f59e0b',
    '--color-warning-foreground': '#ffffff',
    '--color-info': '#3b82f6',
    '--color-info-foreground': '#ffffff',
    '--color-popover': '#ffffff',
    '--color-popover-foreground': '#0f172a',
    '--radius': '0.5rem',
    '--font-sans': 'Inter, sans-serif',
    '--font-arabic': 'Cairo, sans-serif',
    '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    '--shadow': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  };

  const darkTokens = {
    '--color-primary': '#3b82f6',
    '--color-primary-foreground': '#ffffff',
    '--color-accent': '#38bdf8',
    '--color-accent-foreground': '#0f172a',
    '--color-background': '#0f172a',
    '--color-foreground': '#f8fafc',
    '--color-card': '#1e293b',
    '--color-card-foreground': '#f8fafc',
    '--color-border': '#334155',
    '--color-input': '#334155',
    '--color-ring': '#3b82f6',
    '--color-muted': '#1e293b',
    '--color-muted-foreground': '#94a3b8',
    '--color-destructive': '#ef4444',
    '--color-destructive-foreground': '#ffffff',
    '--color-success': '#22c55e',
    '--color-success-foreground': '#ffffff',
    '--color-warning': '#f59e0b',
    '--color-warning-foreground': '#ffffff',
    '--color-info': '#60a5fa',
    '--color-info-foreground': '#0f172a',
    '--color-popover': '#1e293b',
    '--color-popover-foreground': '#f8fafc',
    '--radius': '0.5rem',
    '--font-sans': 'Inter, sans-serif',
    '--font-arabic': 'Cairo, sans-serif',
    '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    '--shadow': '0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.4)',
    '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)',
  };

  const existingProfile = await prisma.stylingProfile.findFirst({
    where: { isActive: true },
  });

  if (!existingProfile) {
    await prisma.stylingProfile.create({
      data: {
        isActive: true,
        tokens: defaultTokens,
        darkTokens,
        updatedById: admin.id,
      },
    });
    console.log('✓ Default StylingProfile created');
  } else {
    console.log('✓ StylingProfile already exists, skipping');
  }

  // 5. Default Settings
  const defaultSettings = [
    {
      key: 'password_policy',
      value: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecial: true,
        maxAgeDays: 90,
        preventReuse: 5,
      },
    },
    {
      key: 'login_throttle',
      value: {
        maxFailedAttempts: 5,
        lockoutDurationMinutes: 30,
        windowMinutes: 15,
      },
    },
    {
      key: 'two_person_refund_threshold',
      value: {
        amount: 500,
        currency: 'EGP',
      },
    },
    {
      key: 'tax_defaults',
      value: {
        defaultRate: 0.14,
        inclusive: false,
        label: 'VAT',
      },
    },
    {
      key: 'cancellation_policy_defaults',
      value: {
        tiers: [
          { hoursBeforePickup: 48, refundPercent: 100 },
          { hoursBeforePickup: 24, refundPercent: 50 },
          { hoursBeforePickup: 0, refundPercent: 0 },
        ],
      },
    },
    {
      key: 'sla_targets',
      value: {
        bookingConfirmationMinutes: 15,
        maintenanceResponseHours: 4,
        customerComplaintHours: 24,
      },
    },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: {
        key: setting.key,
        value: setting.value,
        updatedById: admin.id,
      },
    });
  }
  console.log(`✓ Default settings seeded: ${defaultSettings.map((s) => s.key).join(', ')}`);

  // 6. Default Feature Flags
  const featureFlags = [
    { key: 'two_factor_auth_required_all', enabled: false },
    { key: 'customer_portal', enabled: false },
    { key: 'telematics_integration', enabled: false },
    { key: 'bulk_csv_import', enabled: false },
    { key: 'command_palette', enabled: true },
    { key: 'advanced_reporting', enabled: false },
    { key: 'webhook_deliveries', enabled: false },
    { key: 'waitlist_bookings', enabled: false },
  ];

  for (const flag of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {},
      create: {
        key: flag.key,
        enabled: flag.enabled,
        rolloutPct: 0,
        roles: [],
      },
    });
  }
  console.log(`✓ Feature flags seeded: ${featureFlags.map((f) => f.key).join(', ')}`);

  console.log('\n✅ Seed complete');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
