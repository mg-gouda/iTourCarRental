'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft, Car, User, MapPin, Calendar, CreditCard, Wrench,
  UserPlus, Trash2, Check, X, FileText, AlertCircle, Loader2,
} from 'lucide-react';
import {
  bookingsApi, Booking, AdditionalDriver, BookingStatus,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/lib/hooks/use-toast';

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<BookingStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  HOLD: 'outline', CONFIRMED: 'default', ACTIVE: 'default',
  COMPLETED: 'secondary', CANCELLED: 'destructive', NO_SHOW: 'destructive', OVERDUE: 'destructive',
};
const STATUS_LABEL: Record<BookingStatus, string> = {
  HOLD: 'Hold', CONFIRMED: 'Confirmed', ACTIVE: 'Active',
  COMPLETED: 'Completed', CANCELLED: 'Cancelled', NO_SHOW: 'No Show', OVERDUE: 'Overdue',
};

function fmt(date: string) { return format(parseISO(date), 'dd MMM yyyy HH:mm'); }

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ─── Row helper ───────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-right text-foreground">{value ?? '—'}</span>
    </div>
  );
}

// ─── Additional drivers panel ─────────────────────────────────────────────────

function DriversPanel({ booking }: { booking: Booking }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ fullName: '', age: '', phone: '' });

  const addMutation = useMutation({
    mutationFn: () => bookingsApi.addDriver(booking.id, {
      fullName: form.fullName,
      age: parseInt(form.age, 10),
      phone: form.phone || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['booking', booking.id] });
      setForm({ fullName: '', age: '', phone: '' });
      setAdding(false);
      toast({ title: 'Driver added' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: (driverId: string) => bookingsApi.removeDriver(booking.id, driverId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['booking', booking.id] });
      toast({ title: 'Driver removed' });
    },
  });

  const canEdit = ['HOLD', 'CONFIRMED', 'ACTIVE'].includes(booking.status);

  return (
    <Section title="Additional Drivers" icon={UserPlus}>
      <div className="space-y-2">
        {booking.additionalDrivers.length === 0 && !adding && (
          <p className="text-xs text-muted-foreground">No additional drivers.</p>
        )}
        {booking.additionalDrivers.map((d: AdditionalDriver) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
            <div>
              <p className="text-sm font-medium">{d.fullName}</p>
              <p className="text-xs text-muted-foreground">Age {d.age}{d.phone ? ` · ${d.phone}` : ''}</p>
            </div>
            {canEdit && (
              <button
                onClick={() => removeMutation.mutate(d.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                disabled={removeMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {adding && (
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Full Name</Label>
                <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} className="h-7 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Age</Label>
                <Input type="number" min={18} value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))} className="h-7 text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone (optional)</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="h-7 text-xs" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={() => addMutation.mutate()} disabled={!form.fullName || !form.age || addMutation.isPending}>
                {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Add
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAdding(false)}>
                <X className="h-3 w-3" /> Cancel
              </Button>
            </div>
          </div>
        )}
        {canEdit && !adding && (
          <Button variant="outline" size="sm" className="h-7 text-xs w-full mt-1" onClick={() => setAdding(true)}>
            + Add Driver
          </Button>
        )}
      </div>
    </Section>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────────────

function QuickActions({ booking }: { booking: Booking }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const confirmMutation = useMutation({
    mutationFn: () => bookingsApi.confirm(booking.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['booking', booking.id] }); toast({ title: 'Booking confirmed' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  const cancelMutation = useMutation({
    mutationFn: () => bookingsApi.cancel(booking.id, { reason: cancelReason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['booking', booking.id] }); setShowCancel(false); toast({ title: 'Booking cancelled' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="flex flex-wrap gap-2">
      {booking.status === 'HOLD' && (
        <Button size="sm" onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>
          {confirmMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
          Confirm Booking
        </Button>
      )}
      {['HOLD', 'CONFIRMED'].includes(booking.status) && !showCancel && (
        <Button size="sm" variant="destructive" onClick={() => setShowCancel(true)}>Cancel</Button>
      )}
      {showCancel && (
        <div className="flex items-center gap-2 w-full">
          <Input
            placeholder="Cancellation reason…"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="h-8 text-xs flex-1"
          />
          <Button size="sm" variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
            Confirm Cancel
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowCancel(false)}>Back</Button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BookingDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { data: booking, isLoading, error } = useQuery<Booking>({
    queryKey: ['booking', id],
    queryFn: () => bookingsApi.get(id),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (error || !booking) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <AlertCircle className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Booking not found.</p>
      <Button variant="outline" size="sm" onClick={() => router.back()}>Go back</Button>
    </div>
  );

  const snap = booking.priceSnapshot as Record<string, unknown> | null;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-foreground">{booking.bookingNumber}</h1>
            <Badge variant={STATUS_VARIANT[booking.status]}>{STATUS_LABEL[booking.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Created {fmt(booking.createdAt)}
            {booking.createdBy && ` by ${booking.createdBy.fullName}`}
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <QuickActions booking={booking} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Car */}
        <Section title="Vehicle" icon={Car}>
          <Row label="Make & Model" value={`${booking.car.make} ${booking.car.model} ${booking.car.year}`} />
          <Row label="License Plate" value={<span className="font-mono">{booking.car.licensePlate}</span>} />
          <Row label="Category" value={booking.car.category.name} />
        </Section>

        {/* Customer */}
        <Section title="Customer" icon={User}>
          <Row label="Name" value={booking.customer.fullName} />
          <Row label="Email" value={booking.customer.email} />
          <Row label="Phone" value={booking.customer.phone} />
          {booking.customer.flag && <Row label="Flag" value={<Badge variant="secondary">{booking.customer.flag}</Badge>} />}
          {booking.corporateAccount && <Row label="Corporate" value={booking.corporateAccount.name} />}
        </Section>

        {/* Dates & branches */}
        <Section title="Dates & Locations" icon={Calendar}>
          <Row label="Pickup" value={`${fmt(booking.pickupAt)} — ${booking.pickupBranch.name}`} />
          <Row label="Return" value={`${fmt(booking.returnAt)} — ${booking.returnBranch.name}`} />
          {booking.actualReturnAt && <Row label="Actual Return" value={fmt(booking.actualReturnAt)} />}
          <Row label="Fuel Policy" value={booking.fuelPolicy.replace(/_/g, ' ')} />
          {booking.mileageAllowancePerDay && <Row label="Mileage/Day" value={`${booking.mileageAllowancePerDay} km`} />}
        </Section>

        {/* Financials */}
        <Section title="Financials" icon={CreditCard}>
          {booking.totalAmount && <Row label="Total" value={`${booking.currency} ${Number(booking.totalAmount).toFixed(2)}`} />}
          {snap && typeof snap.baseRate === 'string' && <Row label="Base Rate/Day" value={`${booking.currency} ${snap.baseRate}`} />}
          <Row label="Payments" value={booking._count.payments} />
          <Row label="Invoices" value={booking._count.invoices} />
          {booking.extras?.length > 0 && (
            <>
              <Separator className="my-2" />
              {booking.extras.map((e: { extraId?: string; extra?: { code: string; name: string }; quantity: number }) => (
                <Row key={e.extraId} label={e.extra?.name ?? e.extraId ?? ''} value={`× ${e.quantity}`} />
              ))}
            </>
          )}
        </Section>

        {/* Modifications */}
        {booking.modifications?.length > 0 && (
          <Section title="Modifications" icon={FileText}>
            {booking.modifications.map((m) => (
              <div key={m.id} className="flex justify-between py-1.5 border-b border-border last:border-0">
                <span className="text-xs text-muted-foreground">{fmt(m.createdAt)}</span>
                <span className="text-xs">{m.kind}</span>
                {m.newTotal && <span className="text-xs font-mono">{Number(m.newTotal).toFixed(2)}</span>}
              </div>
            ))}
          </Section>
        )}

        {/* Inspections */}
        {booking.inspections?.length > 0 && (
          <Section title="Inspections" icon={Wrench}>
            {booking.inspections.map((i) => (
              <div key={i.id} className="py-2 border-b border-border last:border-0">
                <div className="flex justify-between">
                  <Badge variant={i.kind === 'PICKUP' ? 'default' : 'secondary'} className="text-[10px]">{i.kind}</Badge>
                  <span className="text-xs text-muted-foreground">{fmt(i.performedAt)}</span>
                </div>
                <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                  {i.mileage != null && <span>Mileage: {i.mileage} km</span>}
                  {i.fuelLevel != null && <span>Fuel: {i.fuelLevel}%</span>}
                </div>
                {i.notes && <p className="mt-1 text-xs text-muted-foreground">{i.notes}</p>}
              </div>
            ))}
          </Section>
        )}

        {/* Notes */}
        {(booking.visibleNotes || booking.internalNotes) && (
          <Section title="Notes" icon={FileText}>
            {booking.visibleNotes && <Row label="Customer-visible" value={booking.visibleNotes} />}
            {booking.internalNotes && <Row label="Internal" value={booking.internalNotes} />}
          </Section>
        )}
      </div>

      {/* Additional drivers */}
      <DriversPanel booking={booking} />
    </div>
  );
}
