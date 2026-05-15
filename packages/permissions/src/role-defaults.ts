import { Role } from '@car-rental/shared-types';

// Full permission key set for the application
// Format: page.action or page.action.field
export const ALL_PERMISSIONS = new Set<string>([
  // Dashboard
  'dashboard.view',
  // Calendar
  'calendar.view',
  // Cars / Fleet
  'cars.view', 'cars.create', 'cars.edit', 'cars.delete', 'cars.export', 'cars.transfer',
  // Bookings
  'bookings.view', 'bookings.create', 'bookings.edit', 'bookings.delete', 'bookings.export',
  'bookings.cancel', 'bookings.refund', 'bookings.view.cost_breakdown',
  // Customers
  'customers.view', 'customers.create', 'customers.edit', 'customers.delete', 'customers.export',
  // Corporate Accounts
  'corporate_accounts.view', 'corporate_accounts.create', 'corporate_accounts.edit', 'corporate_accounts.delete',
  // Payments
  'payments.view', 'payments.create', 'payments.edit', 'payments.delete', 'payments.export',
  // Invoices
  'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.delete', 'invoices.export',
  // Damage & Fines
  'damage_fines.view', 'damage_fines.create', 'damage_fines.edit', 'damage_fines.delete',
  // Maintenance
  'maintenance.view', 'maintenance.create', 'maintenance.edit', 'maintenance.delete',
  'maintenance.vendors.view', 'maintenance.vendors.create', 'maintenance.vendors.edit',
  // Parts
  'parts.view', 'parts.create', 'parts.edit', 'parts.delete',
  // Accidents
  'accidents.view', 'accidents.create', 'accidents.edit', 'accidents.delete',
  // Insurance
  'insurance.view', 'insurance.create', 'insurance.edit', 'insurance.delete',
  // Branches
  'branches.view', 'branches.create', 'branches.edit', 'branches.delete',
  // Staff / Users
  'users.view', 'users.create', 'users.edit', 'users.delete', 'users.impersonate',
  // Reports
  'reports.view', 'reports.export',
  // Audit Log
  'audit_log.view',
  // System
  'system.permissions.view', 'system.permissions.edit',
  'system.styling.view', 'system.styling.edit',
  'system.settings.view', 'system.settings.edit',
]);

type PermissionSet = Set<string>;

const SUPER_ADMIN_PERMISSIONS: PermissionSet = new Set(ALL_PERMISSIONS);

const BRANCH_MANAGER_PERMISSIONS: PermissionSet = new Set([
  'dashboard.view', 'calendar.view',
  'cars.view', 'cars.create', 'cars.edit', 'cars.transfer',
  'bookings.view', 'bookings.create', 'bookings.edit', 'bookings.cancel', 'bookings.refund',
  'bookings.view.cost_breakdown',
  'customers.view', 'customers.create', 'customers.edit',
  'corporate_accounts.view', 'corporate_accounts.create', 'corporate_accounts.edit',
  'payments.view', 'payments.create',
  'invoices.view', 'invoices.create',
  'damage_fines.view', 'damage_fines.create', 'damage_fines.edit',
  'maintenance.view', 'maintenance.create', 'maintenance.edit',
  'maintenance.vendors.view',
  'parts.view',
  'accidents.view', 'accidents.create', 'accidents.edit',
  'insurance.view',
  'branches.view',
  'users.view', 'users.create', 'users.edit',
  'reports.view',
  'system.styling.view', 'system.settings.view',
]);

const STAFF_PERMISSIONS: PermissionSet = new Set([
  'dashboard.view', 'calendar.view',
  'cars.view',
  'bookings.view', 'bookings.create', 'bookings.edit',
  'customers.view', 'customers.create', 'customers.edit',
  'corporate_accounts.view',
  'payments.create', 'payments.view',
  'invoices.view',
  'damage_fines.view', 'damage_fines.create',
  'accidents.view', 'accidents.create',
  'insurance.view',
  'branches.view',
]);

const ACCOUNTANT_PERMISSIONS: PermissionSet = new Set([
  'dashboard.view',
  'bookings.view', 'bookings.view.cost_breakdown',
  'customers.view',
  'corporate_accounts.view',
  'cars.view',
  'payments.view', 'payments.create', 'payments.edit', 'payments.export',
  'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.export',
  'damage_fines.view',
  'reports.view', 'reports.export',
  'branches.view',
]);

const MECHANIC_PERMISSIONS: PermissionSet = new Set([
  'dashboard.view',
  'cars.view',
  'maintenance.view', 'maintenance.create', 'maintenance.edit',
  'maintenance.vendors.view', 'maintenance.vendors.create', 'maintenance.vendors.edit',
  'parts.view', 'parts.create', 'parts.edit',
  'accidents.view', 'accidents.create', 'accidents.edit',
]);

const CUSTOMER_PERMISSIONS: PermissionSet = new Set<string>();

export const ROLE_DEFAULTS: Record<Role, PermissionSet> = {
  [Role.SUPER_ADMIN]: SUPER_ADMIN_PERMISSIONS,
  [Role.BRANCH_MANAGER]: BRANCH_MANAGER_PERMISSIONS,
  [Role.STAFF]: STAFF_PERMISSIONS,
  [Role.ACCOUNTANT]: ACCOUNTANT_PERMISSIONS,
  [Role.MECHANIC]: MECHANIC_PERMISSIONS,
  [Role.CUSTOMER]: CUSTOMER_PERMISSIONS,
};
