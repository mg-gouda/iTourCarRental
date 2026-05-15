import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { Car, BookOpen, CreditCard, AlertTriangle } from 'lucide-react';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user as { name?: string } | undefined;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {greeting}, {user?.name ?? 'there'} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's what's happening at your branches today.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Active Bookings"
          value="—"
          color="primary"
        />
        <KpiCard
          icon={<Car className="h-5 w-5" />}
          label="Available Cars"
          value="—"
          color="success"
        />
        <KpiCard
          icon={<CreditCard className="h-5 w-5" />}
          label="Pending Payments"
          value="—"
          color="warning"
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Overdue Returns"
          value="—"
          color="destructive"
        />
      </div>

      {/* Placeholder sections */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Recent Activity</h2>
          <p className="text-sm text-muted-foreground">Activity feed loads here once bookings are set up.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            {['New Booking', 'New Customer', 'View Calendar', 'Fleet Status'].map((action) => (
              <button
                key={action}
                className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors text-left"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'primary' | 'success' | 'warning' | 'destructive';
}) {
  const iconStyles: Record<typeof color, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconStyles[color]}`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
