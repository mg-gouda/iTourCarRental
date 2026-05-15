'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Plus, Ban, CreditCard, Banknote, ArrowLeftRight } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import {
  paymentsApi, lookupApi,
  Payment, PaymentKind, PaymentMethod,
} from '@/lib/api';
import { DataTable } from '@/components/ui/data-table/data-table';
import { AsyncCombobox } from '@/components/ui/combobox/async-combobox';
import { Combobox } from '@/components/ui/combobox/combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/lib/hooks/use-toast';

// ─── Badge helpers ────────────────────────────────────────────────────────────

const KIND_CLASS: Record<PaymentKind, string> = {
  RENTAL: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800',
  DEPOSIT: 'text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950 dark:border-purple-800',
  ADDENDUM: 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-800',
};

function KindBadge({ kind }: { kind: PaymentKind }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${KIND_CLASS[kind]}`}>
      {kind.charAt(0) + kind.slice(1).toLowerCase()}
    </span>
  );
}

const METHOD_ICON: Record<PaymentMethod, React.ReactNode> = {
  CASH: <Banknote className="h-3 w-3" />,
  CARD: <CreditCard className="h-3 w-3" />,
  BANK_TRANSFER: <ArrowLeftRight className="h-3 w-3" />,
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank Transfer',
};

// ─── Zod schema ───────────────────────────────────────────────────────────────

const recordSchema = z.object({
  bookingId: z.string().min(1, 'Booking is required'),
  bookingLabel: z.string().optional(),
  kind: z.enum(['RENTAL', 'DEPOSIT', 'ADDENDUM'] as const),
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER'] as const),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valid amount required'),
  currency: z.string().min(3).max(3),
  reference: z.string().optional(),
});

type RecordForm = z.infer<typeof recordSchema>;

// ─── Columns ──────────────────────────────────────────────────────────────────

const columns: ColumnDef<Payment>[] = [
  {
    accessorKey: 'booking',
    header: 'Booking',
    cell: ({ row }) => {
      const b = row.original.booking;
      return (
        <div>
          <div className="font-medium text-sm">{b?.bookingNumber ?? '—'}</div>
          <div className="text-xs text-muted-foreground">{b?.customer?.fullName ?? '—'}</div>
        </div>
      );
    },
  },
  {
    accessorKey: 'kind',
    header: 'Kind',
    cell: ({ row }) => <KindBadge kind={row.original.kind} />,
  },
  {
    accessorKey: 'method',
    header: 'Method',
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-sm">
        {METHOD_ICON[row.original.method]}
        {METHOD_LABEL[row.original.method]}
      </span>
    ),
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => (
      <span className="font-mono text-sm font-medium">
        {row.original.currency} {parseFloat(row.original.amount).toFixed(2)}
      </span>
    ),
  },
  {
    accessorKey: 'reference',
    header: 'Reference',
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.reference ?? '—'}</span>,
  },
  {
    accessorKey: 'recordedAt',
    header: 'Recorded',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.recordedAt ? format(parseISO(row.original.recordedAt), 'dd MMM yyyy HH:mm') : '—'}
      </span>
    ),
  },
  {
    accessorKey: 'voidedAt',
    header: 'Status',
    cell: ({ row }) =>
      row.original.voidedAt ? (
        <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-destructive bg-destructive/10 border-destructive/30">
          <Ban className="h-3 w-3" /> Voided
        </span>
      ) : (
        <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800">
          Active
        </span>
      ),
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function PaymentsClient() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [kindFilter, setKindFilter] = useState<string>('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['payments', pagination, kindFilter],
    queryFn: () =>
      paymentsApi.list({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        kind: kindFilter || undefined,
      }),
  });

  const { mutate: createPayment, isPending: creating } = useMutation({
    mutationFn: (dto: RecordForm) =>
      paymentsApi.create({
        bookingId: dto.bookingId,
        kind: dto.kind,
        method: dto.method,
        amount: dto.amount,
        currency: dto.currency,
        reference: dto.reference,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      setSheetOpen(false);
      form.reset();
      toast({ title: 'Payment recorded' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const { mutate: voidPayment, isPending: voiding } = useMutation({
    mutationFn: () => paymentsApi.void(voidTarget!.id, voidReason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      setVoidTarget(null);
      setVoidReason('');
      toast({ title: 'Payment voided' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const form = useForm<RecordForm>({
    resolver: zodResolver(recordSchema),
    defaultValues: { kind: 'RENTAL', method: 'CASH', currency: 'AED' },
  });

  const fetchBookings = useCallback(async (q: string) => {
    const res = await lookupApi.bookings(q);
    return res.map((b) => ({ value: b.id, label: b.bookingNumber, description: b.customer.fullName }));
  }, []);

  const kindOptions = [
    { value: '', label: 'All Kinds' },
    { value: 'RENTAL', label: 'Rental' },
    { value: 'DEPOSIT', label: 'Deposit' },
    { value: 'ADDENDUM', label: 'Addendum' },
  ];

  const kindFormOptions = [
    { value: 'RENTAL', label: 'Rental' },
    { value: 'DEPOSIT', label: 'Deposit' },
    { value: 'ADDENDUM', label: 'Addendum' },
  ];

  const methodOptions = [
    { value: 'CASH', label: 'Cash' },
    { value: 'CARD', label: 'Card' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  ];

  const columnsWithActions: ColumnDef<Payment>[] = [
    ...columns,
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        if (row.original.voidedAt) return null;
        return (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setVoidTarget(row.original)}
          >
            <Ban className="h-4 w-4 mr-1" />
            Void
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        columns={columnsWithActions}
        data={data?.items ?? []}
        totalCount={data?.total}
        pagination={pagination}
        onPaginationChange={setPagination}
        loading={isLoading}
        emptyMessage="No payments found."
        toolbar={
          <div className="flex items-center gap-2">
            <Combobox
              options={kindOptions}
              value={kindFilter}
              onValueChange={setKindFilter}
              placeholder="Filter by kind"
              className="w-44"
            />
            <Button size="sm" onClick={() => setSheetOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Record Payment
            </Button>
          </div>
        }
      />

      {/* Record payment sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Record Payment</SheetTitle>
          </SheetHeader>

          <form
            className="mt-6 space-y-5"
            onSubmit={form.handleSubmit((d) => createPayment(d))}
          >
            <div className="space-y-2">
              <Label>Booking <span className="text-destructive">*</span></Label>
              <Controller
                control={form.control}
                name="bookingId"
                render={({ field }) => (
                  <AsyncCombobox
                    fetchOptions={fetchBookings}
                    value={field.value}
                    onValueChange={(v, label) => {
                      field.onChange(v);
                      form.setValue('bookingLabel', label ?? '');
                    }}
                    placeholder="Search booking…"
                  />
                )}
              />
              {form.formState.errors.bookingId && (
                <p className="text-xs text-destructive">{form.formState.errors.bookingId.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kind <span className="text-destructive">*</span></Label>
                <Controller
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <Combobox
                      options={kindFormOptions}
                      value={field.value}
                      onValueChange={(v) => field.onChange(v)}
                      placeholder="Kind"
                    />
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Method <span className="text-destructive">*</span></Label>
                <Controller
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <Combobox
                      options={methodOptions}
                      value={field.value}
                      onValueChange={(v) => field.onChange(v)}
                      placeholder="Method"
                    />
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount <span className="text-destructive">*</span></Label>
                <Input
                  {...form.register('amount')}
                  placeholder="0.00"
                  className="font-mono"
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Currency <span className="text-destructive">*</span></Label>
                <Input
                  {...form.register('currency')}
                  placeholder="AED"
                  maxLength={3}
                  className="uppercase"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reference</Label>
              <Input {...form.register('reference')} placeholder="Cheque #, transfer ref, POS ID…" />
            </div>

            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Recording…' : 'Record Payment'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Void confirm dialog */}
      <Dialog open={!!voidTarget} onOpenChange={(o) => { if (!o) { setVoidTarget(null); setVoidReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              This will permanently void the payment of{' '}
              <strong>{voidTarget?.currency} {voidTarget ? parseFloat(voidTarget.amount).toFixed(2) : ''}</strong>.
              This action cannot be undone.
            </p>
            <div className="space-y-2">
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Input
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Reason for voiding…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVoidTarget(null); setVoidReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!voidReason.trim() || voiding}
              onClick={() => voidPayment()}
            >
              {voiding ? 'Voiding…' : 'Void Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
