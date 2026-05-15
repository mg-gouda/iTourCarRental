'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Plus, Check, X, Car, ArrowRight, Clock, AlertCircle } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO, differenceInDays } from 'date-fns';

import {
  bookingsApi, lookupApi,
  Booking, BookingStatus, FuelPolicy,
  CreateBookingDto, QuoteDto, PriceBreakdown,
} from '@/lib/api';
import { DataTable } from '@/components/ui/data-table/data-table';
import { AsyncCombobox } from '@/components/ui/combobox/async-combobox';
import { Combobox } from '@/components/ui/combobox/combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/lib/hooks/use-toast';

// ─── Status badge helpers ─────────────────────────────────────────────────────

const STATUS_VARIANT: Record<BookingStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  HOLD: 'outline',
  CONFIRMED: 'default',
  ACTIVE: 'secondary',
  COMPLETED: 'secondary',
  CANCELLED: 'destructive',
  NO_SHOW: 'destructive',
  OVERDUE: 'destructive',
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  HOLD: 'Hold',
  CONFIRMED: 'Confirmed',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
  OVERDUE: 'Overdue',
};

const STATUS_CLASS: Record<BookingStatus, string> = {
  HOLD: 'text-yellow-700 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-950 dark:border-yellow-800',
  CONFIRMED: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800',
  ACTIVE: 'text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800',
  COMPLETED: 'text-muted-foreground bg-muted border-border',
  CANCELLED: 'text-destructive bg-destructive/10 border-destructive/30',
  NO_SHOW: 'text-destructive bg-destructive/10 border-destructive/30',
  OVERDUE: 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-800',
};

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const bookingStep1Schema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  customerLabel: z.string().optional(),
  carId: z.string().min(1, 'Car is required'),
  carLabel: z.string().optional(),
  pickupBranchId: z.string().min(1, 'Pickup branch is required'),
  pickupBranchLabel: z.string().optional(),
  returnBranchId: z.string().min(1, 'Return branch is required'),
  returnBranchLabel: z.string().optional(),
  pickupAt: z.string().min(1, 'Pickup date is required'),
  returnAt: z.string().min(1, 'Return date is required'),
  driverAge: z.coerce.number().int().min(18).max(99),
});

const bookingStep2Schema = z.object({
  fuelPolicy: z.enum(['FULL_TO_FULL', 'PREPAID_FULL', 'RETURN_AS_RECEIVED']),
  mileageAllowancePerDay: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().optional(),
});

type Step1Values = z.infer<typeof bookingStep1Schema>;
type Step2Values = z.infer<typeof bookingStep2Schema>;

// ─── Quote preview ────────────────────────────────────────────────────────────

function QuotePreview({ breakdown, currency }: { breakdown: PriceBreakdown; currency?: string }) {
  const fmt = (v: string) => {
    const n = parseFloat(v);
    return isNaN(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const cur = breakdown.currency ?? currency ?? 'EGP';

  const lineItems = [
    { label: `Base rental (${breakdown.days} day${breakdown.days !== 1 ? 's' : ''} × ${fmt(breakdown.dailyRate)} ${cur}/day)`, value: breakdown.baseRental, positive: true },
    ...(parseFloat(breakdown.extrasFee) > 0 ? [{ label: 'Extras', value: breakdown.extrasFee, positive: true }] : []),
    ...(parseFloat(breakdown.crossBranchFee) > 0 ? [{ label: 'Cross-branch fee', value: breakdown.crossBranchFee, positive: true }] : []),
    ...(parseFloat(breakdown.youngDriverSurcharge) > 0 ? [{ label: 'Young driver surcharge', value: breakdown.youngDriverSurcharge, positive: true }] : []),
    ...(parseFloat(breakdown.additionalDriverSurcharge) > 0 ? [{ label: 'Additional driver(s)', value: breakdown.additionalDriverSurcharge, positive: true }] : []),
    ...(parseFloat(breakdown.mileageOverage) > 0 ? [{ label: 'Mileage overage', value: breakdown.mileageOverage, positive: true }] : []),
    ...(parseFloat(breakdown.lateReturnFee) > 0 ? [{ label: 'Late return fee', value: breakdown.lateReturnFee, positive: true }] : []),
    ...(parseFloat(breakdown.fuelCharge) > 0 ? [{ label: 'Fuel charge', value: breakdown.fuelCharge, positive: true }] : []),
    ...(parseFloat(breakdown.discounts) > 0 ? [{ label: 'Discounts', value: breakdown.discounts, positive: false }] : []),
    { label: 'Tax', value: breakdown.taxAmount, positive: true },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Price Estimate</p>
      <div className="space-y-1.5">
        {lineItems.map((item, i) => (
          <div key={i} className="flex justify-between">
            <span className="text-muted-foreground">{item.label}</span>
            <span className={item.positive ? '' : 'text-green-600 dark:text-green-400'}>
              {item.positive ? '' : '-'}{fmt(item.value)} {cur}
            </span>
          </div>
        ))}
      </div>
      <Separator />
      <div className="flex justify-between font-semibold text-base">
        <span>Total</span>
        <span>{fmt(breakdown.total)} {cur}</span>
      </div>
    </div>
  );
}

// ─── Create booking sheet ─────────────────────────────────────────────────────

interface CreateBookingSheetProps {
  open: boolean;
  onClose: () => void;
}

function CreateBookingSheet({ open, onClose }: CreateBookingSheetProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [step1Data, setStep1Data] = useState<Step1Values | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Values | null>(null);
  const [quote, setQuote] = useState<PriceBreakdown | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const form1 = useForm<Step1Values>({ resolver: zodResolver(bookingStep1Schema), defaultValues: { driverAge: 25 } });
  const form2 = useForm<Step2Values>({ resolver: zodResolver(bookingStep2Schema), defaultValues: { fuelPolicy: 'FULL_TO_FULL' } });

  const createMutation = useMutation({
    mutationFn: (dto: CreateBookingDto) => bookingsApi.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      toast({ title: 'Booking created', description: `Booking is now on hold.` });
      handleClose();
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  function handleClose() {
    onClose();
    setTimeout(() => {
      setStep(1); setStep1Data(null); setStep2Data(null); setQuote(null);
      form1.reset({ driverAge: 25 }); form2.reset({ fuelPolicy: 'FULL_TO_FULL' });
    }, 300);
  }

  async function onStep1Submit(values: Step1Values) {
    setStep1Data(values);
    setStep(2);
  }

  async function onStep2Submit(values: Step2Values) {
    setStep2Data(values);
    if (!step1Data) return;
    setQuoteLoading(true);
    try {
      const dto: QuoteDto = {
        carId: step1Data.carId,
        pickupBranchId: step1Data.pickupBranchId,
        returnBranchId: step1Data.returnBranchId,
        pickupAt: step1Data.pickupAt,
        returnAt: step1Data.returnAt,
        driverAge: step1Data.driverAge,
        fuelPolicy: values.fuelPolicy as FuelPolicy,
        mileageAllowancePerDay: values.mileageAllowancePerDay ?? undefined,
      };
      const result = await bookingsApi.quote(dto);
      setQuote(result);
      setStep(3);
    } catch (err: any) {
      toast({ title: 'Quote failed', description: err.message, variant: 'destructive' });
    } finally {
      setQuoteLoading(false);
    }
  }

  async function onConfirm() {
    if (!step1Data || !step2Data) return;
    createMutation.mutate({
      customerId: step1Data.customerId,
      carId: step1Data.carId,
      pickupBranchId: step1Data.pickupBranchId,
      returnBranchId: step1Data.returnBranchId,
      pickupAt: step1Data.pickupAt,
      returnAt: step1Data.returnAt,
      driverAge: step1Data.driverAge,
      fuelPolicy: step2Data.fuelPolicy as FuelPolicy,
      mileageAllowancePerDay: step2Data.mileageAllowancePerDay ?? undefined,
      notes: step2Data.notes,
    });
  }

  // Compute days for display
  const pickupAt = form1.watch('pickupAt');
  const returnAt = form1.watch('returnAt');
  const days = pickupAt && returnAt ? Math.max(1, differenceInDays(new Date(returnAt), new Date(pickupAt))) : null;

  // Car lookup depends on dates
  const fetchAvailableCars = useCallback(async (q: string) => {
    const pickup = form1.getValues('pickupAt');
    const ret = form1.getValues('returnAt');
    const results = await lookupApi.availableCars({ q, pickupAt: pickup || undefined, returnAt: ret || undefined });
    return results.map((c) => ({
      value: c.id,
      label: `${c.make} ${c.model} (${c.year}) — ${c.licensePlate}`,
      description: c.category.name,
    }));
  }, [form1]);

  const fetchCustomers = useCallback(async (q: string) => {
    const results = await lookupApi.customers(q);
    return results.map((c) => ({ value: c.id, label: c.fullName, description: c.phone }));
  }, []);

  const fetchBranches = useCallback(async (q: string) => {
    const results = await lookupApi.branches(q);
    return results.map((b) => ({ value: b.id, label: b.name, description: b.city }));
  }, []);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>New Booking</SheetTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-1">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold border ${step >= s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>
                  {s}
                </span>
                <span className={step === s ? 'text-foreground font-medium' : ''}>
                  {s === 1 ? 'Details' : s === 2 ? 'Options' : 'Confirm'}
                </span>
                {s < 3 && <ArrowRight className="w-3 h-3" />}
              </div>
            ))}
          </div>
        </SheetHeader>

        {/* Step 1 — Customer, Car, Dates */}
        {step === 1 && (
          <form onSubmit={form1.handleSubmit(onStep1Submit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label>Customer *</Label>
              <Controller
                control={form1.control}
                name="customerId"
                render={({ field }) => (
                  <AsyncCombobox
                    fetchOptions={fetchCustomers}
                    value={field.value}
                    displayValue={form1.watch('customerLabel')}
                    onValueChange={(v, l) => { field.onChange(v); form1.setValue('customerLabel', l); }}
                    placeholder="Search customers…"
                  />
                )}
              />
              {form1.formState.errors.customerId && (
                <p className="text-xs text-destructive">{form1.formState.errors.customerId.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Pickup date &amp; time *</Label>
                <Input
                  type="datetime-local"
                  {...form1.register('pickupAt')}
                  className="text-sm"
                />
                {form1.formState.errors.pickupAt && (
                  <p className="text-xs text-destructive">{form1.formState.errors.pickupAt.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Return date &amp; time *</Label>
                <Input
                  type="datetime-local"
                  {...form1.register('returnAt')}
                  className="text-sm"
                />
                {form1.formState.errors.returnAt && (
                  <p className="text-xs text-destructive">{form1.formState.errors.returnAt.message}</p>
                )}
              </div>
            </div>

            {days !== null && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> {days} day{days !== 1 ? 's' : ''}
              </p>
            )}

            <div className="space-y-1.5">
              <Label>Car *</Label>
              <Controller
                control={form1.control}
                name="carId"
                render={({ field }) => (
                  <AsyncCombobox
                    fetchOptions={fetchAvailableCars}
                    value={field.value}
                    displayValue={form1.watch('carLabel')}
                    onValueChange={(v, l) => { field.onChange(v); form1.setValue('carLabel', l); }}
                    placeholder="Search available cars…"
                  />
                )}
              />
              {form1.formState.errors.carId && (
                <p className="text-xs text-destructive">{form1.formState.errors.carId.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Pickup branch *</Label>
                <Controller
                  control={form1.control}
                  name="pickupBranchId"
                  render={({ field }) => (
                    <AsyncCombobox
                      fetchOptions={fetchBranches}
                      value={field.value}
                      displayValue={form1.watch('pickupBranchLabel')}
                      onValueChange={(v, l) => { field.onChange(v); form1.setValue('pickupBranchLabel', l); }}
                      placeholder="Select branch…"
                    />
                  )}
                />
                {form1.formState.errors.pickupBranchId && (
                  <p className="text-xs text-destructive">{form1.formState.errors.pickupBranchId.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Return branch *</Label>
                <Controller
                  control={form1.control}
                  name="returnBranchId"
                  render={({ field }) => (
                    <AsyncCombobox
                      fetchOptions={fetchBranches}
                      value={field.value}
                      displayValue={form1.watch('returnBranchLabel')}
                      onValueChange={(v, l) => { field.onChange(v); form1.setValue('returnBranchLabel', l); }}
                      placeholder="Select branch…"
                    />
                  )}
                />
              </div>
            </div>

            <div className="space-y-1.5 w-32">
              <Label>Driver age *</Label>
              <Input type="number" min={18} max={99} {...form1.register('driverAge')} />
              {form1.formState.errors.driverAge && (
                <p className="text-xs text-destructive">{form1.formState.errors.driverAge.message}</p>
              )}
            </div>

            <SheetFooter className="pt-4">
              <Button variant="outline" type="button" onClick={handleClose}>Cancel</Button>
              <Button type="submit">Next</Button>
            </SheetFooter>
          </form>
        )}

        {/* Step 2 — Options */}
        {step === 2 && (
          <form onSubmit={form2.handleSubmit(onStep2Submit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label>Fuel policy *</Label>
              <Controller
                control={form2.control}
                name="fuelPolicy"
                render={({ field }) => (
                  <Combobox
                    options={[
                      { value: 'FULL_TO_FULL', label: 'Full to Full' },
                      { value: 'PREPAID_FULL', label: 'Prepaid Full Tank' },
                      { value: 'RETURN_AS_RECEIVED', label: 'Return as Received' },
                    ]}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Select fuel policy…"
                  />
                )}
              />
            </div>

            <div className="space-y-1.5 w-48">
              <Label>Mileage allowance / day (km)</Label>
              <Input
                type="number"
                min={0}
                placeholder="Unlimited if empty"
                {...form2.register('mileageAllowancePerDay')}
              />
              <p className="text-xs text-muted-foreground">Leave blank for unlimited mileage.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Internal notes (not shown to customer)"
                {...form2.register('notes')}
              />
            </div>

            <SheetFooter className="pt-4">
              <Button variant="outline" type="button" onClick={() => setStep(1)}>Back</Button>
              <Button type="submit" disabled={quoteLoading}>
                {quoteLoading ? 'Getting quote…' : 'Get Quote'}
              </Button>
            </SheetFooter>
          </form>
        )}

        {/* Step 3 — Quote confirmation */}
        {step === 3 && quote && (
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm space-y-1">
              <div className="flex gap-2">
                <Car className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">{step1Data?.carLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {step1Data?.pickupAt && format(new Date(step1Data.pickupAt), 'dd MMM yyyy HH:mm')}
                    {' → '}
                    {step1Data?.returnAt && format(new Date(step1Data.returnAt), 'dd MMM yyyy HH:mm')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {step1Data?.pickupBranchLabel} → {step1Data?.returnBranchLabel}
                  </p>
                </div>
              </div>
            </div>

            <QuotePreview breakdown={quote} />

            <div className="rounded-xl border border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800 p-3 flex gap-2 text-xs text-yellow-800 dark:text-yellow-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>This is an estimate. The final price is confirmed at checkout.</span>
            </div>

            <SheetFooter className="pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={onConfirm} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create Booking (Hold)'}
              </Button>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Cancel dialog ────────────────────────────────────────────────────────────

function CancelDialog({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reason, setReason] = useState('');

  const cancelMutation = useMutation({
    mutationFn: () => bookingsApi.cancel(booking!.id, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      toast({ title: 'Booking cancelled' });
      onClose();
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Booking {booking?.bookingNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>Cancellation reason *</Label>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for cancellation…"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Back</Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || cancelMutation.isPending}
            onClick={() => cancelMutation.mutate()}
          >
            {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Booking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main bookings client ─────────────────────────────────────────────────────

export default function BookingsClient() {
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', pagination, search, statusFilter],
    queryFn: () => bookingsApi.list({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      search: search || undefined,
      status: statusFilter || undefined,
    }),
    placeholderData: (prev) => prev,
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => bookingsApi.confirm(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); toast({ title: 'Booking confirmed' }); },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const columns: ColumnDef<Booking>[] = [
    {
      accessorKey: 'bookingNumber',
      header: 'Booking #',
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium">{row.original.bookingNumber}</span>
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-sm">{row.original.customer.fullName}</div>
          <div className="text-xs text-muted-foreground">{row.original.customer.phone}</div>
        </div>
      ),
    },
    {
      id: 'car',
      header: 'Car',
      cell: ({ row }) => {
        const car = row.original.car;
        return (
          <div>
            <div className="font-medium text-sm">{car.make} {car.model} {car.year}</div>
            <div className="font-mono text-xs text-muted-foreground">{car.licensePlate}</div>
          </div>
        );
      },
    },
    {
      id: 'dates',
      header: 'Dates',
      cell: ({ row }) => {
        const b = row.original;
        const d = Math.max(1, differenceInDays(new Date(b.returnAt), new Date(b.pickupAt)));
        return (
          <div className="text-xs">
            <div>{format(parseISO(b.pickupAt), 'dd MMM yyyy')}</div>
            <div className="text-muted-foreground">{format(parseISO(b.returnAt), 'dd MMM yyyy')} · {d}d</div>
          </div>
        );
      },
    },
    {
      id: 'branch',
      header: 'Branch',
      cell: ({ row }) => (
        <div className="text-xs">
          <div>{row.original.pickupBranch.name}</div>
          {row.original.returnBranch.id !== row.original.pickupBranch.id && (
            <div className="text-muted-foreground">→ {row.original.returnBranch.name}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'total',
      header: 'Total',
      cell: ({ row }) => {
        const snapshot = row.original.priceSnapshot;
        if (!snapshot) return <span className="text-muted-foreground text-xs">—</span>;
        const n = parseFloat(snapshot.total);
        return (
          <span className="font-medium text-sm">
            {isNaN(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 2 })} {snapshot.currency}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const b = row.original;
        return (
          <div className="flex items-center gap-1 justify-end">
            {b.status === 'HOLD' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={() => confirmMutation.mutate(b.id)}
                disabled={confirmMutation.isPending}
              >
                <Check className="w-3 h-3 mr-1" /> Confirm
              </Button>
            )}
            {['HOLD', 'CONFIRMED'].includes(b.status) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setCancelTarget(b)}
              >
                <X className="w-3 h-3 mr-1" /> Cancel
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search booking #, customer, plate…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPagination((p) => ({ ...p, pageIndex: 0 })); }}
        className="h-8 w-56 text-sm"
      />
      <Combobox
        options={[
          { value: '', label: 'All statuses' },
          { value: 'HOLD', label: 'Hold' },
          { value: 'CONFIRMED', label: 'Confirmed' },
          { value: 'ACTIVE', label: 'Active' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'CANCELLED', label: 'Cancelled' },
          { value: 'NO_SHOW', label: 'No Show' },
          { value: 'OVERDUE', label: 'Overdue' },
        ]}
        value={statusFilter}
        onValueChange={(v) => { setStatusFilter(v); setPagination((p) => ({ ...p, pageIndex: 0 })); }}
        placeholder="Filter by status…"
        className="h-8 w-44 text-sm"
      />
      <div className="ml-auto">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Booking
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        totalCount={data?.total}
        pagination={pagination}
        onPaginationChange={setPagination}
        loading={isLoading}
        emptyMessage="No bookings found."
        toolbar={toolbar}
      />
      <CreateBookingSheet open={createOpen} onClose={() => setCreateOpen(false)} />
      <CancelDialog booking={cancelTarget} onClose={() => setCancelTarget(null)} />
    </>
  );
}
