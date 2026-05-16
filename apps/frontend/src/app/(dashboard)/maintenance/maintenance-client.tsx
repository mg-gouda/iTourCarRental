'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Plus, CheckCircle, Wrench, Clock } from 'lucide-react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';

import {
  maintenanceApi, lookupApi,
  MaintenanceRecord, MaintenanceKind, CreateMaintenanceDto,
} from '@/lib/api';
import { DataTable } from '@/components/ui/data-table/data-table';
import { AsyncCombobox } from '@/components/ui/combobox/async-combobox';
import { Combobox } from '@/components/ui/combobox/combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/lib/hooks/use-toast';

// ─── Status helpers ───────────────────────────────────────────────────────────

function StatusBadge({ record }: { record: MaintenanceRecord }) {
  if (record.completedAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800">
        <CheckCircle className="h-3 w-3" /> Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-800">
      <Clock className="h-3 w-3" /> In Progress
    </span>
  );
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  carId: z.string().min(1, 'Car is required'),
  kind: z.enum(['SCHEDULED', 'UNSCHEDULED'] as const),
  startedAt: z.string().min(1, 'Start date is required'),
  completedAt: z.string().optional(),
  mileageAt: z.coerce.number().min(0),
  cost: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valid amount required'),
  currency: z.string().min(3).max(3),
  description: z.string().min(1, 'Description is required'),
  vendorId: z.string().optional(),
  partsUsed: z.array(z.object({
    partId: z.string().min(1),
    quantity: z.coerce.number().min(1),
    unitCost: z.string().regex(/^\d+(\.\d{1,2})?$/),
  })).optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Columns ──────────────────────────────────────────────────────────────────

function useColumns(onComplete: (r: MaintenanceRecord) => void): ColumnDef<MaintenanceRecord>[] {
  return [
    {
      accessorKey: 'car',
      header: 'Car',
      cell: ({ row }) => {
        const c = row.original.car;
        return (
          <div>
            <div className="font-medium text-sm">{c.make} {c.model} ({c.year})</div>
            <div className="text-xs text-muted-foreground font-mono">{c.licensePlate}</div>
          </div>
        );
      },
    },
    {
      accessorKey: 'kind',
      header: 'Kind',
      cell: ({ row }) => (
        <span className="text-sm capitalize">{row.original.kind.toLowerCase()}</span>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => (
        <span className="text-sm line-clamp-1 max-w-[200px]">{row.original.description}</span>
      ),
    },
    {
      accessorKey: 'vendor',
      header: 'Vendor',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.vendor?.name ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'cost',
      header: 'Cost',
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.original.currency} {parseFloat(row.original.cost).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: 'startedAt',
      header: 'Started',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(parseISO(row.original.startedAt), 'dd MMM yyyy')}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge record={row.original} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        if (row.original.completedAt) return null;
        return (
          <Button variant="ghost" size="sm" onClick={() => onComplete(row.original)}>
            <CheckCircle className="h-4 w-4 mr-1" /> Complete
          </Button>
        );
      },
    },
  ];
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MaintenanceClient() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [kindFilter, setKindFilter] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<MaintenanceRecord | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['maintenance', pagination, kindFilter],
    queryFn: () => maintenanceApi.list({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      kind: kindFilter || undefined,
    }),
  });

  const { mutate: createRecord, isPending: creating } = useMutation({
    mutationFn: (dto: CreateMaintenanceDto) => maintenanceApi.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      setSheetOpen(false);
      form.reset();
      toast({ title: 'Maintenance record created' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const { mutate: completeRecord, isPending: completing } = useMutation({
    mutationFn: () => maintenanceApi.complete(completeTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      setCompleteTarget(null);
      toast({ title: 'Marked as completed' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { kind: 'SCHEDULED', currency: 'AED', mileageAt: 0, partsUsed: [] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'partsUsed' });

  const fetchCars = useCallback(async (q: string) => {
    const res = await lookupApi.cars(q);
    return res.map((c) => ({ value: c.id, label: `${c.make} ${c.model} (${c.year})`, description: c.licensePlate }));
  }, []);

  const fetchVendors = useCallback(async (q: string) => {
    const res = await lookupApi.vendors(q);
    return res.map((v) => ({ value: v.id, label: v.name, description: v.specialty ?? undefined }));
  }, []);

  const fetchParts = useCallback(async (q: string) => {
    const res = await lookupApi.parts(q);
    return res.map((p) => ({ value: p.id, label: p.name, description: `${p.sku} · ${p.currency} ${parseFloat(p.unitCost).toFixed(2)}` }));
  }, []);

  const kindOptions = [
    { value: '', label: 'All' },
    { value: 'SCHEDULED', label: 'Scheduled' },
    { value: 'UNSCHEDULED', label: 'Unscheduled' },
  ];

  const kindFormOptions = [
    { value: 'SCHEDULED', label: 'Scheduled' },
    { value: 'UNSCHEDULED', label: 'Unscheduled' },
  ];

  const columns = useColumns(setCompleteTarget);

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        totalCount={data?.total}
        pagination={pagination}
        onPaginationChange={setPagination}
        loading={isLoading}
        emptyMessage="No maintenance records."
        toolbar={
          <div className="flex items-center gap-2">
            <Combobox
              options={kindOptions}
              value={kindFilter}
              onValueChange={setKindFilter}
              placeholder="Filter by kind"
              className="w-40"
            />
            <Button size="sm" onClick={() => setSheetOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Record
            </Button>
          </div>
        }
      />

      {/* Create sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Maintenance Record</SheetTitle>
          </SheetHeader>

          <form className="mt-6 space-y-5" onSubmit={form.handleSubmit((d) => createRecord(d as CreateMaintenanceDto))}>
            <div className="space-y-2">
              <Label>Car <span className="text-destructive">*</span></Label>
              <AsyncCombobox fetchOptions={fetchCars} value={form.watch('carId')} onValueChange={(v) => form.setValue('carId', v)} placeholder="Search car…" />
              {form.formState.errors.carId && <p className="text-xs text-destructive">{form.formState.errors.carId.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kind <span className="text-destructive">*</span></Label>
                <Controller control={form.control} name="kind" render={({ field }) => (
                  <Combobox options={kindFormOptions} value={field.value} onValueChange={(v) => field.onChange(v)} placeholder="Kind" />
                )} />
              </div>
              <div className="space-y-2">
                <Label>Odometer (km) <span className="text-destructive">*</span></Label>
                <Input {...form.register('mileageAt')} type="number" min={0} placeholder="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Started <span className="text-destructive">*</span></Label>
                <Input {...form.register('startedAt')} type="datetime-local" />
                {form.formState.errors.startedAt && <p className="text-xs text-destructive">{form.formState.errors.startedAt.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Completed (optional)</Label>
                <Input {...form.register('completedAt')} type="datetime-local" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description <span className="text-destructive">*</span></Label>
              <Textarea {...form.register('description')} placeholder="Work performed…" rows={3} />
              {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cost <span className="text-destructive">*</span></Label>
                <Input {...form.register('cost')} placeholder="0.00" className="font-mono" />
                {form.formState.errors.cost && <p className="text-xs text-destructive">{form.formState.errors.cost.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input {...form.register('currency')} placeholder="AED" maxLength={3} className="uppercase" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Vendor (optional)</Label>
              <AsyncCombobox fetchOptions={fetchVendors} value={form.watch('vendorId') ?? ''} onValueChange={(v) => form.setValue('vendorId', v || undefined)} placeholder="Search vendor…" />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Parts Used</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ partId: '', quantity: 1, unitCost: '0.00' })}>
                  <Plus className="h-3 w-3 mr-1" /> Add Part
                </Button>
              </div>
              {fields.map((field, i) => (
                <div key={field.id} className="flex items-end gap-2 rounded-md border border-border p-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Part</Label>
                    <AsyncCombobox
                      fetchOptions={fetchParts}
                      value={form.watch(`partsUsed.${i}.partId`)}
                      onValueChange={(v, label) => {
                        form.setValue(`partsUsed.${i}.partId`, v);
                        // Auto-fill unit cost from lookup description
                        const res = lookupApi.parts(label ?? '');
                        res.then((parts) => {
                          const match = parts.find((p) => p.id === v);
                          if (match) form.setValue(`partsUsed.${i}.unitCost`, match.unitCost);
                        }).catch(() => {});
                      }}
                      placeholder="Search part…"
                    />
                  </div>
                  <div className="w-20 space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input {...form.register(`partsUsed.${i}.quantity`)} type="number" min={1} />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">Unit cost</Label>
                    <Input {...form.register(`partsUsed.${i}.unitCost`)} className="font-mono text-xs" />
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => remove(i)}>×</Button>
                </div>
              ))}
            </div>

            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>
                <Wrench className="h-4 w-4 mr-1" />
                {creating ? 'Saving…' : 'Save Record'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Complete confirm */}
      <Dialog open={!!completeTarget} onOpenChange={(o) => { if (!o) setCompleteTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark as Completed</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Mark the maintenance on <strong>{completeTarget?.car.make} {completeTarget?.car.model}</strong> as completed? The car will return to <strong>Available</strong> status.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteTarget(null)}>Cancel</Button>
            <Button disabled={completing} onClick={() => completeRecord()}>
              <CheckCircle className="h-4 w-4 mr-1" />
              {completing ? 'Completing…' : 'Mark Completed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
