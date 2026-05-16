'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  LayoutDashboard, Calendar, Car, BookOpen, Users, Building2,
  CreditCard, FileText, AlertTriangle, Wrench, Package, ShieldAlert,
  Shield, GitBranch, UserCog, BarChart3, ClipboardList, Lock,
  Palette, Settings, HelpCircle, Search,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, group: 'Navigate' },
  { label: 'Calendar', href: '/calendar', icon: Calendar, group: 'Navigate' },
  { label: 'Cars', href: '/cars', icon: Car, group: 'Fleet' },
  { label: 'Bookings', href: '/bookings', icon: BookOpen, group: 'Fleet' },
  { label: 'Customers', href: '/customers', icon: Users, group: 'Fleet' },
  { label: 'Corporate Accounts', href: '/corporate-accounts', icon: Building2, group: 'Fleet' },
  { label: 'Payments', href: '/payments', icon: CreditCard, group: 'Finance' },
  { label: 'Invoices', href: '/invoices', icon: FileText, group: 'Finance' },
  { label: 'Damage & Fines', href: '/damage-fines', icon: AlertTriangle, group: 'Finance' },
  { label: 'Maintenance', href: '/maintenance', icon: Wrench, group: 'Operations' },
  { label: 'Maintenance Vendors', href: '/maintenance/vendors', icon: Package, group: 'Operations' },
  { label: 'Parts Inventory', href: '/parts', icon: Package, group: 'Operations' },
  { label: 'Accidents', href: '/accidents', icon: ShieldAlert, group: 'Operations' },
  { label: 'Insurance', href: '/insurance', icon: Shield, group: 'Operations' },
  { label: 'Branches', href: '/branches', icon: GitBranch, group: 'Organization' },
  { label: 'Staff', href: '/staff', icon: UserCog, group: 'Organization' },
  { label: 'Reports', href: '/reports', icon: BarChart3, group: 'Analytics' },
  { label: 'Audit Log', href: '/audit-log', icon: ClipboardList, group: 'Analytics' },
  { label: 'Permissions', href: '/system/permissions', icon: Lock, group: 'System' },
  { label: 'Styling & Branding', href: '/system/styling', icon: Palette, group: 'System' },
  { label: 'Settings', href: '/system/settings', icon: Settings, group: 'System' },
  { label: 'Help', href: '/help', icon: HelpCircle, group: 'System' },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const navigate = useCallback((href: string) => {
    router.push(href);
    onOpenChange(false);
    setSearch('');
  }, [router, onOpenChange]);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  if (!open) return null;

  const groups = Array.from(new Set(NAV_ITEMS.map((i) => i.group)));
  const filtered = search
    ? NAV_ITEMS.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
    : NAV_ITEMS;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* backdrop */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />

      <Command
        className="relative w-full max-w-lg rounded-2xl border border-border bg-popover shadow-2xl overflow-hidden"
        loop
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Search pages and actions…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
        </div>

        <Command.List className="max-h-72 overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
            No results found.
          </Command.Empty>

          {(search ? ['Results'] : groups).map((group) => {
            const items = search
              ? filtered
              : NAV_ITEMS.filter((i) => i.group === group);

            if (!items.length) return null;

            return (
              <Command.Group
                key={group}
                heading={group}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide"
              >
                {items.map((item) => (
                  <Command.Item
                    key={item.href}
                    value={item.label}
                    onSelect={() => navigate(item.href)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-foreground outline-none transition-colors"
                  >
                    <item.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {item.label}
                  </Command.Item>
                ))}
              </Command.Group>
            );
          })}
        </Command.List>

        <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span><kbd className="rounded border border-border px-1 py-0.5">↑↓</kbd> navigate</span>
          <span><kbd className="rounded border border-border px-1 py-0.5">↵</kbd> select</span>
          <span><kbd className="rounded border border-border px-1 py-0.5">ESC</kbd> close</span>
        </div>
      </Command>
    </div>
  );
}
