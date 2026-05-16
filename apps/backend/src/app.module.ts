import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { configuration } from './config/env';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthGuard } from './common/guards/auth.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BranchesModule } from './modules/branches/branches.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { StylingModule } from './modules/styling/styling.module';
import { SettingsModule } from './modules/settings/settings.module';
import { LookupModule } from './modules/lookup/lookup.module';
import { CarsModule } from './modules/cars/cars.module';
import { InsuranceModule } from './modules/insurance/insurance.module';
import { CustomersModule } from './modules/customers/customers.module';
import { CorporateAccountsModule } from './modules/corporate-accounts/corporate-accounts.module';
import { RatePlansModule } from './modules/rate-plans/rate-plans.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { DamageFinesModule } from './modules/damage-fines/damage-fines.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { PartsModule } from './modules/parts/parts.module';
import { AccidentsModule } from './modules/accidents/accidents.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { SavedViewsModule } from './modules/saved-views/saved-views.module';
import { ImportModule } from './modules/import/import.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    BranchesModule,
    PermissionsModule,
    AuditLogModule,
    StylingModule,
    SettingsModule,
    LookupModule,
    CarsModule,
    InsuranceModule,
    CustomersModule,
    CorporateAccountsModule,
    RatePlansModule,
    BookingsModule,
    PaymentsModule,
    InvoicesModule,
    RefundsModule,
    DamageFinesModule,
    MaintenanceModule,
    VendorsModule,
    PartsModule,
    AccidentsModule,
    ReportsModule,
    NotificationsModule,
    WebhooksModule,
    ApiKeysModule,
    FeatureFlagsModule,
    SavedViewsModule,
    ImportModule,
  ],
  providers: [
    // Global guards — run on every route
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
    // Global interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
