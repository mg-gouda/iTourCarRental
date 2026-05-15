import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'mggouda@gmail.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Win16@64';

  const passwordHash = await argon2.hash(adminPassword);

  // 1. Upsert Super Admin — also remove any stale super-admin with a different email
  //    so re-seeding with a new email doesn't leave orphaned admin accounts.
  await prisma.user.deleteMany({
    where: {
      role: 'SUPER_ADMIN',
      email: { not: adminEmail },
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      fullName: 'Mahmoud Gouda',
      isActive: true,
      role: 'SUPER_ADMIN',
    },
    create: {
      email: adminEmail,
      passwordHash,
      fullName: 'Mahmoud Gouda',
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

  // 7. Booking overlap exclusion constraint (idempotent)
  // Requires btree_gist extension; skipped gracefully if unavailable in this environment.
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'booking_no_overlap'
        ) THEN
          ALTER TABLE "Booking" ADD CONSTRAINT booking_no_overlap
            EXCLUDE USING gist (
              "carId" WITH =,
              tstzrange("pickupAt"::timestamptz, "returnAt"::timestamptz, '[)') WITH &&
            )
            WHERE ("status" IN ('HOLD', 'CONFIRMED', 'ACTIVE') AND "deletedAt" IS NULL);
        END IF;
      END$$;
    `);
    console.log('✓ Booking overlap exclusion constraint ensured');
  } catch (e: any) {
    console.warn('⚠ Booking overlap exclusion constraint skipped (service-layer enforcement active):', e?.message?.split('\n')[0]);
  }

  // 8. Default extras
  const defaultExtras = [
    { code: 'gps', name: 'GPS Navigation', pricingMode: 'per_day' },
    { code: 'child_seat', name: 'Child Seat', pricingMode: 'per_day' },
    { code: 'additional_driver', name: 'Additional Driver', pricingMode: 'per_day' },
    { code: 'insurance_basic', name: 'Basic Insurance', pricingMode: 'per_day' },
    { code: 'insurance_full', name: 'Full Coverage Insurance', pricingMode: 'per_day' },
  ];

  for (const extra of defaultExtras) {
    await prisma.extra.upsert({
      where: { code: extra.code },
      update: {},
      create: { ...extra, isActive: true },
    });
  }
  console.log(`✓ Default extras seeded: ${defaultExtras.map((e) => e.code).join(', ')}`);

  // 9. Default RatePlan for Cairo branch
  const dbCategories = await prisma.carCategory.findMany({ select: { id: true, name: true } });
  const caiPlan = await prisma.ratePlan.upsert({
    where: { id: 'seed-cairo-default' },
    update: {},
    create: {
      id: 'seed-cairo-default',
      name: 'Cairo Default',
      branchId: branch.id,
      startAt: new Date('2020-01-01'),
      endAt: new Date('2099-12-31'),
      priority: 0,
      isActive: true,
    },
  });

  const dailyRates: Record<string, number> = {
    Economy: 200, Compact: 280, Midsize: 350, SUV: 500, Luxury: 800, Van: 450,
  };

  for (const cat of dbCategories) {
    await prisma.rateRule.upsert({
      where: { ratePlanId_categoryId: { ratePlanId: caiPlan.id, categoryId: cat.id } },
      update: {},
      create: {
        ratePlanId: caiPlan.id,
        categoryId: cat.id,
        dailyRate: dailyRates[cat.name] ?? 300,
        weeklyRate: (dailyRates[cat.name] ?? 300) * 6,
        monthlyRate: (dailyRates[cat.name] ?? 300) * 22,
        currency: 'EGP',
      },
    });
  }
  console.log(`✓ Default rate plan seeded: Cairo Default (${dbCategories.length} categories)`);

  // 10. Branch settings for pricing (young driver threshold, grace period)
  const branchPricingSettings = [
    { key: `branch_${branch.id}_young_driver_age`, value: { threshold: 25, surchargePerDay: 50, currency: 'EGP' } },
    { key: `branch_${branch.id}_late_return_grace`, value: { graceMinutes: 60, penaltyPerHour: 30, currency: 'EGP' } },
  ];
  for (const s of branchPricingSettings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: { key: s.key, value: s.value, updatedById: admin.id } });
  }
  console.log('✓ Branch pricing settings seeded');

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
