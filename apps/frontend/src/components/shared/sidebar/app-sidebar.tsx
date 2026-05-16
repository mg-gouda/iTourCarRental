'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard, Calendar, Car, BookOpen, Users, Building2,
  CreditCard, FileText, AlertTriangle, Wrench, Package, ShieldAlert,
  Shield, GitBranch, UserCog, BarChart3, ClipboardList, Lock,
  Palette, Settings, User, HelpCircle, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { canDo } from '@car-rental/permissions';
import type { Role } from '@car-rental/shared-types';

interface NavItem {
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: '',
    items: [
      { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
      { key: 'calendar', href: '/calendar', icon: Calendar, permission: 'calendar.view' },
    ],
  },
  {
    label: 'fleetBookings',
    items: [
      { key: 'cars', href: '/cars', icon: Car, permission: 'cars.view' },
      { key: 'bookings', href: '/bookings', icon: BookOpen, permission: 'bookings.view' },
      { key: 'customers', href: '/customers', icon: Users, permission: 'customers.view' },
      { key: 'corporateAccounts', href: '/corporate-accounts', icon: Building2, permission: 'corporate_accounts.view' },
    ],
  },
  {
    label: 'finance',
    items: [
      { key: 'payments', href: '/payments', icon: CreditCard, permission: 'payments.view' },
      { key: 'invoices', href: '/invoices', icon: FileText, permission: 'invoices.view' },
      { key: 'damageFines', href: '/damage-fines', icon: AlertTriangle, permission: 'damage_fines.view' },
    ],
  },
  {
    label: 'operations',
    items: [
      { key: 'maintenance', href: '/maintenance', icon: Wrench, permission: 'maintenance.view' },
      { key: 'vendors', href: '/maintenance/vendors', icon: Package, permission: 'maintenance.vendors.view' },
      { key: 'parts', href: '/parts', icon: Package, permission: 'parts.view' },
      { key: 'accidents', href: '/accidents', icon: ShieldAlert, permission: 'accidents.view' },
      { key: 'insurance', href: '/insurance', icon: Shield, permission: 'insurance.view' },
    ],
  },
  {
    label: 'organization',
    items: [
      { key: 'branches', href: '/branches', icon: GitBranch, permission: 'branches.view' },
      { key: 'staff', href: '/staff', icon: UserCog, permission: 'users.view' },
    ],
  },
  {
    label: 'analytics',
    items: [
      { key: 'reports', href: '/reports', icon: BarChart3, permission: 'reports.view' },
      { key: 'auditLog', href: '/audit-log', icon: ClipboardList, permission: 'audit_log.view' },
    ],
  },
  {
    label: 'system',
    items: [
      { key: 'systemPermissions', href: '/system/permissions', icon: Lock, permission: 'system.permissions.view' },
      { key: 'systemStyling', href: '/system/styling', icon: Palette, permission: 'system.styling.view' },
      { key: 'systemSettings', href: '/system/settings', icon: Settings, permission: 'system.settings.view' },
    ],
  },
];

export function AppSidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { data: session } = useSession();

  const user = session?.user as {
    role?: Role;
    permissions?: string[];
    overrides?: { key: string; effect: 'grant' | 'revoke' }[];
    branchScope?: string[];
  } | undefined;

  function hasPermission(permission?: string) {
    if (!permission || !user) return false;
    return canDo(
      {
        role: user.role ?? ('STAFF' as Role),
        overrides: user.overrides ?? [],
        branchScope: user.branchScope ?? [],
      },
      permission,
    );
  }

  return (
    <aside
      className={cn(
        'flex h-full flex-col bg-sidebar text-sidebar-foreground',
        'border-r border-sidebar-border',
        collapsed ? 'w-16' : 'w-60',
        'transition-[width] duration-200',
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
          <Car className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm tracking-tight text-sidebar-foreground truncate">
            iTour Rental
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => hasPermission(item.permission));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              {group.label && !collapsed && (
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                  {t(group.label as Parameters<typeof t>[0], { fallback: group.label })}
                </p>
              )}
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href));

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
                          'transition-colors duration-100',
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                            : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                          collapsed && 'justify-center px-0',
                        )}
                      >
                        <item.icon
                          className={cn(
                            'h-4 w-4 shrink-0',
                            isActive
                              ? 'text-sidebar-primary'
                              : 'text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70',
                          )}
                        />
                        {!collapsed && (
                          <span className="truncate">
                            {t(item.key as Parameters<typeof t>[0])}
                          </span>
                        )}
                        {isActive && !collapsed && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Profile quick-link */}
      <div className="border-t border-sidebar-border p-2">
        <Link
          href="/profile"
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
            'text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
            'transition-colors',
            collapsed && 'justify-center px-0',
          )}
        >
          <User className="h-4 w-4 shrink-0 text-sidebar-foreground/40" />
          {!collapsed && (
            <span className="truncate">{t('profile')}</span>
          )}
        </Link>
        <Link
          href="/help"
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
            'text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
            'transition-colors',
            collapsed && 'justify-center px-0',
          )}
        >
          <HelpCircle className="h-4 w-4 shrink-0 text-sidebar-foreground/40" />
          {!collapsed && (
            <span className="truncate">{t('help')}</span>
          )}
        </Link>
      </div>
    </aside>
  );
}
