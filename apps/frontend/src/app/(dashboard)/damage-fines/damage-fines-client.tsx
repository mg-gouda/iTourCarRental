'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Plus, Trash2, AlertTriangle, FileWarning } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';

import {
  damageFinesApi, lookupApi,
  DamageRecord, Fine,
} from '@/lib/api';
import { DataTable } from '@/components/ui/data-table/data-table';
import { AsyncCombobox } from '@/components/ui/combobox/async-combobox';
import { Combobox } from '@/components/ui/combobox/combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/lib/hooks/use-toast';

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type ActiveTab = 'damage' | 'fines';

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const damageSchema = z.object({
  bookingId: z.string().min(1, 'Booking is required'),
  description: z.string().min(1, 'Description is required'),
  estimatedCost: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valid amount required'),
  currency: z.string().min(3).max(3),
});

const fineSchema = z.object({
  bookingId: z.string().min(1, 'Booking is required'),
  kind: z.string().min(1, 'Kind is required'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valid amount required'),
  currency: z.string().min(3).max(3),
  occurredAt: z.string().min(1, 'Date is required'),
  externalRef: z.string().optional(),
  serviceFee: z.string().optional(),
  notes: z.string().optional(),
});

type DamageForm = z.infer<typeof damageSchema>;
type FineForm = z.infer<typeof fineSchema>;

// ─── Damage columns ───────────────────────────────────────────────────────────

function useDamageColumns(onDelete: (r: DamageRecord) => void): ColumnDef<DamageRecord>[] {
  return [
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
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => (
        <span className="text-sm line-clamp-2">{row.original.description}</span>
      ),
    },
    {
      accessorKey: 'estimatedCost',
      header: 'Estimated Cost',
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.original.currency} {parseFloat(row.original.estimatedCost).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Recorded',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.createdAt ? format(parseISO(row.original.createdAt), 'dd MMM yyyy') : '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(row.original)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];
}

// ─── Fines columns ────────────────────────────────────────────────────────────

function useFineColumns(onDelete: (f: Fine) => void): ColumnDef<Fine>[] {
  return [
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
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground bg-muted border-border">
          {row.original.kind}
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
      accessorKey: 'serviceFee',
      header: 'Service Fee',
      cell: ({ row }) =>
        row.original.serviceFee ? (
          <span className="font-mono text-sm text-muted-foreground">
            {row.original.currency} {parseFloat(row.original.serviceFee).toFixed(2)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: 'externalRef',
      header: 'Ref',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.externalRef ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'occurredAt',
      header: 'Occurred',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.occurredAt ? format(parseISO(row.original.occurredAt), 'dd MMM yyyy') : '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(row.original)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DamageFinesClient() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<ActiveTab>('damage');
  const [damagePagination, setDamagePagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [finePagination, setFinePagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });

  const [damageSheetOpen, setDamageSheetOpen] = useState(false);
  const [fineSheetOpen, setFineSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'damage' | 'fine'; item: DamageRecord | Fine } | null>(null);

  const { data: damageData, isLoading: damageLoading } = useQuery({
    queryKey: ['damage', damagePagination],
    queryFn: () => damageFinesApi.listDamage({ page: damagePagination.pageIndex + 1, limit: damagePagination.pageSize }),
  });

  const { data: fineData, isLoading: fineLoading } = useQuery({
    queryKey: ['fines', finePagination],
    queryFn: () => damageFinesApi.listFines({ page: finePagination.pageIndex + 1, limit: finePagination.pageSize }),
  });

  const { mutate: createDamage, isPending: creatingDamage } = useMutation({
    mutationFn: (dto: DamageForm) => damageFinesApi.createDamage(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['damage'] });
      setDamageSheetOpen(false);
      damageForm.reset();
      toast({ title: 'Damage record created' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const { mutate: createFine, isPending: creatingFine } = useMutation({
    mutationFn: (dto: FineForm) => damageFinesApi.createFine({
      ...dto,
      serviceFee: dto.serviceFee || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fines'] });
      setFineSheetOpen(false);
      fineForm.reset();
      toast({ title: 'Fine recorded' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const { mutate: deleteItem, isPending: deleting } = useMutation({
    mutationFn: () => {
      if (!deleteTarget) throw new Error('No target');
      if (deleteTarget.type === 'damage') {
        return damageFinesApi.deleteDamage(deleteTarget.item.id);
      }
      return damageFinesApi.deleteFine(deleteTarget.item.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['damage'] });
      qc.invalidateQueries({ queryKey: ['fines'] });
      setDeleteTarget(null);
      toast({ title: 'Deleted' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const damageForm = useForm<DamageForm>({
    resolver: zodResolver(damageSchema),
    defaultValues: { currency: 'AED' },
  });

  const fineForm = useForm<FineForm>({
    resolver: zodResolver(fineSchema),
    defaultValues: { currency: 'AED' },
  });

  const fetchBookings = useCallback(async (q: string) => {
    const res = await lookupApi.bookings(q);
    return res.map((b) => ({ value: b.id, label: b.bookingNumber, description: b.customer.fullName }));
  }, []);

  const fineKindOptions = [
    { value: 'TRAFFIC', label: 'Traffic Violation' },
    { value: 'PARKING', label: 'Parking' },
    { value: 'TOLL', label: 'Toll' },
    { value: 'OTHER', label: 'Other' },
  ];

  const damageColumns = useDamageColumns((r) => setDeleteTarget({ type: 'damage', item: r }));
  const fineColumns = useFineColumns((f) => setDeleteTarget({ type: 'fine', item: f }));

  return (
    <>
      {/* Tab switcher */}
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          onClick={() => setActiveTab('damage')}
          className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'damage'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Damage Records
          {(damageData?.total ?? 0) > 0 && (
            <span className="rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs">
              {damageData?.total}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('fines')}
          className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'fines'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileWarning className="h-4 w-4" />
          Fines
          {(fineData?.total ?? 0) > 0 && (
            <span className="rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs">
              {fineData?.total}
            </span>
          )}
        </button>
      </div>

      {/* Damage tab */}
      {activeTab === 'damage' && (
        <DataTable
          columns={damageColumns}
          data={damageData?.items ?? []}
          totalCount={damageData?.total}
          pagination={damagePagination}
          onPaginationChange={setDamagePagination}
          loading={damageLoading}
          emptyMessage="No damage records found."
          toolbar={
            <Button size="sm" onClick={() => setDamageSheetOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Record Damage
            </Button>
          }
        />
      )}

      {/* Fines tab */}
      {activeTab === 'fines' && (
        <DataTable
          columns={fineColumns}
          data={fineData?.items ?? []}
          totalCount={fineData?.total}
          pagination={finePagination}
          onPaginationChange={setFinePagination}
          loading={fineLoading}
          emptyMessage="No fines found."
          toolbar={
            <Button size="sm" onClick={() => setFineSheetOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Record Fine
            </Button>
          }
        />
      )}

      {/* Record damage sheet */}
      <Sheet open={damageSheetOpen} onOpenChange={setDamageSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Record Damage</SheetTitle>
          </SheetHeader>

          <form
            className="mt-6 space-y-5"
            onSubmit={damageForm.handleSubmit((d) => createDamage(d))}
          >
            <div className="space-y-2">
              <Label>Booking <span className="text-destructive">*</span></Label>
              <AsyncCombobox
                fetchOptions={fetchBookings}
                value={damageForm.watch('bookingId')}
                onValueChange={(v) => damageForm.setValue('bookingId', v)}
                placeholder="Search booking…"
              />
              {damageForm.formState.errors.bookingId && (
                <p className="text-xs text-destructive">{damageForm.formState.errors.bookingId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Description <span className="text-destructive">*</span></Label>
              <Textarea
                {...damageForm.register('description')}
                placeholder="Describe the damage…"
                rows={3}
              />
              {damageForm.formState.errors.description && (
                <p className="text-xs text-destructive">{damageForm.formState.errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estimated Cost <span className="text-destructive">*</span></Label>
                <Input
                  {...damageForm.register('estimatedCost')}
                  placeholder="0.00"
                  className="font-mono"
                />
                {damageForm.formState.errors.estimatedCost && (
                  <p className="text-xs text-destructive">{damageForm.formState.errors.estimatedCost.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input
                  {...damageForm.register('currency')}
                  placeholder="AED"
                  maxLength={3}
                  className="uppercase"
                />
              </div>
            </div>

            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setDamageSheetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingDamage}>
                {creatingDamage ? 'Saving…' : 'Save Record'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Record fine sheet */}
      <Sheet open={fineSheetOpen} onOpenChange={setFineSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Record Fine</SheetTitle>
          </SheetHeader>

          <form
            className="mt-6 space-y-5"
            onSubmit={fineForm.handleSubmit((d) => createFine(d))}
          >
            <div className="space-y-2">
              <Label>Booking <span className="text-destructive">*</span></Label>
              <AsyncCombobox
                fetchOptions={fetchBookings}
                value={fineForm.watch('bookingId')}
                onValueChange={(v) => fineForm.setValue('bookingId', v)}
                placeholder="Search booking…"
              />
              {fineForm.formState.errors.bookingId && (
                <p className="text-xs text-destructive">{fineForm.formState.errors.bookingId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Kind <span className="text-destructive">*</span></Label>
              <Combobox
                options={fineKindOptions}
                value={fineForm.watch('kind')}
                onValueChange={(v) => fineForm.setValue('kind', v)}
                placeholder="Select fine type…"
              />
              {fineForm.formState.errors.kind && (
                <p className="text-xs text-destructive">{fineForm.formState.errors.kind.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount <span className="text-destructive">*</span></Label>
                <Input
                  {...fineForm.register('amount')}
                  placeholder="0.00"
                  className="font-mono"
                />
                {fineForm.formState.errors.amount && (
                  <p className="text-xs text-destructive">{fineForm.formState.errors.amount.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Service Fee</Label>
                <Input
                  {...fineForm.register('serviceFee')}
                  placeholder="0.00"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input
                  {...fineForm.register('currency')}
                  placeholder="AED"
                  maxLength={3}
                  className="uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label>Occurred Date <span className="text-destructive">*</span></Label>
                <Input {...fineForm.register('occurredAt')} type="date" />
                {fineForm.formState.errors.occurredAt && (
                  <p className="text-xs text-destructive">{fineForm.formState.errors.occurredAt.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>External Reference</Label>
              <Input {...fineForm.register('externalRef')} placeholder="Ticket number, authority ref…" />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea {...fineForm.register('notes')} placeholder="Additional notes…" rows={2} />
            </div>

            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setFineSheetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingFine}>
                {creatingFine ? 'Saving…' : 'Save Fine'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {deleteTarget?.type === 'damage' ? 'Damage Record' : 'Fine'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete this record? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => deleteItem()}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
