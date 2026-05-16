import type { Metadata } from 'next';
import { BookOpen, Keyboard, Car, BookMarked, Users, CreditCard, Wrench, BarChart3, Settings, FileDown } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Help' };

const SHORTCUTS = [
  { keys: ['⌘K'], description: 'Open command palette' },
  { keys: ['Esc'], description: 'Close dialog / panel' },
  { keys: ['Enter'], description: 'Submit focused form' },
  { keys: ['Tab'], description: 'Move between form fields' },
];

const SECTIONS = [
  {
    icon: Car,
    title: 'Fleet Management',
    href: '/cars',
    description: 'Add and manage vehicles, track status (available, rented, maintenance, out of service), bulk import via CSV, transfer between branches.',
  },
  {
    icon: BookMarked,
    title: 'Bookings',
    href: '/bookings',
    description: 'Create bookings and holds, process modifications, run vehicle inspections at pickup and return, manage the waitlist.',
  },
  {
    icon: Users,
    title: 'Customers',
    href: '/customers',
    description: 'Customer profiles, driver license tracking, flags (VIP, Watchlist, Blacklisted), additional drivers, corporate accounts.',
  },
  {
    icon: CreditCard,
    title: 'Payments & Invoices',
    href: '/payments',
    description: 'Record payments and deposits, generate PDF invoices in English or Arabic, process refunds, manage damage and fines.',
  },
  {
    icon: Wrench,
    title: 'Maintenance',
    href: '/maintenance',
    description: 'Log maintenance records with cost and downtime, track external vendors, manage parts inventory, file accident reports.',
  },
  {
    icon: BarChart3,
    title: 'Reports',
    href: '/reports',
    description: 'Revenue by period, fleet utilization, booking status breakdown, top customers, staff activity, maintenance costs per vehicle.',
  },
  {
    icon: Settings,
    title: 'Settings',
    href: '/system/settings',
    description: 'Configure webhooks, manage API keys, toggle feature flags. Permission and styling settings are under System.',
  },
];

const CSV_FORMATS = [
  {
    kind: 'Cars',
    columns: [
      { name: 'plate', required: true, note: 'License plate number' },
      { name: 'make', required: true, note: 'e.g. Toyota' },
      { name: 'model', required: true, note: 'e.g. Camry' },
      { name: 'year', required: true, note: '4-digit year' },
      { name: 'color', required: false, note: '' },
      { name: 'vin', required: false, note: '' },
      { name: 'status', required: false, note: 'AVAILABLE · MAINTENANCE · OUT_OF_SERVICE (default: AVAILABLE)' },
      { name: 'dailyRate', required: false, note: 'Numeric, branch default if omitted' },
      { name: 'mileage', required: false, note: 'Current odometer reading' },
    ],
  },
  {
    kind: 'Customers',
    columns: [
      { name: 'name', required: true, note: 'Full name' },
      { name: 'email', required: true, note: 'Must be unique' },
      { name: 'phone', required: false, note: '' },
      { name: 'nationality', required: false, note: 'ISO country code' },
      { name: 'licenseNumber', required: false, note: '' },
      { name: 'licenseExpiry', required: false, note: 'YYYY-MM-DD' },
      { name: 'flag', required: false, note: 'BLACKLISTED · WATCHLIST · VIP' },
      { name: 'notes', required: false, note: '' },
    ],
  },
];

export default function Page() {
  return (
    <div className="space-y-8 animate-fade-in max-w-3xl">
      <h1 className="text-2xl font-semibold text-foreground">Help & Reference</h1>

      {/* Keyboard shortcuts */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Keyboard className="h-4 w-4 text-muted-foreground" />
          Keyboard Shortcuts
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SHORTCUTS.map((s) => (
            <div key={s.description} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
              <span className="text-sm text-muted-foreground">{s.description}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] font-mono font-medium text-foreground shadow-sm"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Module reference */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          Module Reference
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SECTIONS.map(({ icon: Icon, title, href, description }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-xl border border-border bg-card p-4 space-y-2 hover:border-primary/50 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium text-foreground">{title}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* CSV import reference */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileDown className="h-4 w-4 text-muted-foreground" />
          CSV Import Format
        </div>
        <div className="space-y-4">
          {CSV_FORMATS.map((fmt) => (
            <div key={fmt.kind} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-muted/30">
                <span className="text-xs font-semibold text-foreground">{fmt.kind} CSV</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Column</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Required</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {fmt.columns.map((col) => (
                    <tr key={col.name} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2 font-mono text-foreground">{col.name}</td>
                      <td className="px-4 py-2">
                        {col.required ? (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive font-medium">required</span>
                        ) : (
                          <span className="text-muted-foreground">optional</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{col.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {/* Support */}
      <section className="rounded-xl border border-border bg-card p-6 text-center space-y-2">
        <p className="text-sm font-medium text-foreground">Need more help?</p>
        <p className="text-xs text-muted-foreground">
          Contact your system administrator or reach out via the support channel configured in Settings.
        </p>
      </section>
    </div>
  );
}
