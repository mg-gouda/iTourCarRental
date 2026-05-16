'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  BookOpen, Car, TrendingUp, Wrench,
  DollarSign, Users, Activity,
} from 'lucide-react';
import { format } from 'date-fns';

import { reportsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox/combobox';

// ─── Colour tokens (CSS-var aware) ───────────────────────────────────────────

const COLORS = [
  'hsl(217 91% 60%)',
  'hsl(142 71% 45%)',
  'hsl(37 91% 55%)',
  'hsl(280 65% 60%)',
  'hsl(15 80% 55%)',
];
const STATUS_COLOR: Record<string, string> = {
  COMPLETED: 'hsl(142 76% 36%)',
  ACTIVE: 'hsl(217 91% 60%)',
  CONFIRMED: 'hsl(37 91% 55%)',
  CANCELLED: 'hsl(0 72% 51%)',
  NO_SHOW: 'hsl(0 60% 60%)',
  HOLD: 'hsl(250 60% 60%)',
  PENDING: 'hsl(200 80% 60%)',
  OVERDUE: 'hsl(30 80% 50%)',
};

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ReportsClient() {
  const thisYear = new Date().getFullYear();
  const [from, setFrom] = useState(`${thisYear}-01-01`);
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [groupBy, setGroupBy] = useState<'day' | 'month' | 'year'>('month');

  const params = { from, to, groupBy };

  const { data: summary } = useQuery({ queryKey: ['reports-summary', params], queryFn: () => reportsApi.summary(params) });
  const { data: revenue } = useQuery({ queryKey: ['reports-revenue', params], queryFn: () => reportsApi.revenue(params) });
  const { data: statusData } = useQuery({ queryKey: ['reports-status', params], queryFn: () => reportsApi.bookingsByStatus(params) });
  const { data: fleetData } = useQuery({ queryKey: ['reports-fleet'], queryFn: () => reportsApi.fleetUtilization() });
  const { data: maintData } = useQuery({ queryKey: ['reports-maint', params], queryFn: () => reportsApi.maintenanceCosts(params) });
  const { data: topCustomers } = useQuery({ queryKey: ['reports-customers', params], queryFn: () => reportsApi.topCustomers(params) });
  const { data: staffData } = useQuery({ queryKey: ['reports-staff', params], queryFn: () => reportsApi.staffActivity(params) });

  const groupByOptions = [
    { value: 'day', label: 'By Day' },
    { value: 'month', label: 'By Month' },
    { value: 'year', label: 'By Year' },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Group by</Label>
          <Combobox
            options={groupByOptions}
            value={groupBy}
            onValueChange={(v) => setGroupBy(v as 'day' | 'month' | 'year')}
            placeholder="Group by"
            className="w-32"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setFrom(`${thisYear}-01-01`); setTo(format(new Date(), 'yyyy-MM-dd')); setGroupBy('month'); }}
        >
          Reset
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Total Revenue"
          value={summary ? `AED ${summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 })}` : '—'}
          sub="Payments in period"
        />
        <KpiCard
          icon={<BookOpen className="h-4 w-4" />}
          label="Total Bookings"
          value={summary?.totalBookings ?? '—'}
          sub={`${summary?.activeBookings ?? 0} currently active`}
        />
        <KpiCard
          icon={<Car className="h-4 w-4" />}
          label="Fleet Utilization"
          value={summary ? `${summary.fleetUtilizationPct}%` : '—'}
          sub={`${summary?.rentedCars ?? 0} rented / ${summary?.totalCars ?? 0} total`}
        />
        <KpiCard
          icon={<Wrench className="h-4 w-4" />}
          label="Active Maintenance"
          value={summary?.activeMaintenance ?? '—'}
          sub={`${summary?.inMaintenanceCars ?? 0} cars in maintenance`}
        />
      </div>

      {/* Revenue over time */}
      <Section title="Revenue Over Time">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={revenue ?? []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [`AED ${v.toLocaleString()}`, 'Revenue']}
            />
            <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      {/* Two-col row: booking status + fleet utilization */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Bookings by Status">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusData ?? []} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis type="category" dataKey="status" width={90} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(s) => s.charAt(0) + s.slice(1).toLowerCase()} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {(statusData ?? []).map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLOR[entry.status] ?? COLORS[0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Fleet Utilization by Category">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={fleetData ?? []} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`${v}%`, 'Utilization']}
              />
              <Bar dataKey="utilization" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                {(fleetData ?? []).map((_entry, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* Top customers + Staff activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Top Customers by Revenue">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Customer</th>
                  <th className="pb-2 font-medium text-right">Bookings</th>
                  <th className="pb-2 font-medium text-right">Total Spent</th>
                </tr>
              </thead>
              <tbody>
                {(topCustomers ?? []).map((r, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5">
                      <div className="font-medium text-foreground">{r.customer}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground">{r.bookings}</td>
                    <td className="py-2.5 text-right font-mono font-medium">AED {r.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 0 })}</td>
                  </tr>
                ))}
                {!topCustomers?.length && (
                  <tr><td colSpan={3} className="py-6 text-center text-muted-foreground text-xs">No data for this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Staff Activity">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Staff</th>
                  <th className="pb-2 font-medium text-right">Bookings</th>
                  <th className="pb-2 font-medium text-right">Payments</th>
                </tr>
              </thead>
              <tbody>
                {(staffData ?? []).map((r, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5">
                      <div className="font-medium text-foreground">{r.staff}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="py-2.5 text-right">{r.bookingsCreated}</td>
                    <td className="py-2.5 text-right">{r.paymentsRecorded}</td>
                  </tr>
                ))}
                {!staffData?.length && (
                  <tr><td colSpan={3} className="py-6 text-center text-muted-foreground text-xs">No data for this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      {/* Maintenance costs */}
      <Section title="Top Maintenance Costs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Car</th>
                <th className="pb-2 font-medium">Plate</th>
                <th className="pb-2 font-medium text-right">Records</th>
                <th className="pb-2 font-medium text-right">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {(maintData ?? []).map((r, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 font-medium text-foreground">{r.car}</td>
                  <td className="py-2.5 font-mono text-xs text-muted-foreground">{r.licensePlate}</td>
                  <td className="py-2.5 text-right text-muted-foreground">{r.records}</td>
                  <td className="py-2.5 text-right font-mono font-medium">AED {r.totalCost.toLocaleString(undefined, { minimumFractionDigits: 0 })}</td>
                </tr>
              ))}
              {!maintData?.length && (
                <tr><td colSpan={4} className="py-6 text-center text-muted-foreground text-xs">No maintenance records for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Additional KPIs row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Available Cars"
          value={summary?.availableCars ?? '—'}
          sub="Ready to rent"
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Bookings Created"
          value={summary?.totalBookings ?? '—'}
          sub="In selected period"
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Avg. Revenue / Booking"
          value={
            summary && summary.totalBookings > 0
              ? `AED ${(summary.totalRevenue / summary.totalBookings).toFixed(0)}`
              : '—'
          }
          sub="Revenue ÷ bookings"
        />
      </div>
    </div>
  );
}
