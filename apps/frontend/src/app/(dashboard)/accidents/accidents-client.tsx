'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Plus, Pencil, Trash2, Car, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';

import { accidentsApi, AccidentReport, CreateAccidentDto, lookupApi } from '@/lib/api';
import { DataTable } from '@/components/ui/data-table/data-table';
import { AsyncCombobox } from '@/components/ui/combobox/async-combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/lib/hooks/use-toast';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  carId: z.string().min(1, 'Car is required'),
  bookingId: z.string().optional(),
  occurredAt: z.string().min(1, 'Date is required'),
  location: z.string().optional(),
  policeReportRef: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  insuranceClaimId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Columns ──────────────────────────────────────────────────────────────────

function useColumns(onEdit: (r: AccidentReport) => void, onDelete: (r: AccidentReport) => void): ColumnDef<AccidentReport>[] {
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
      accessorKey: 'occurredAt',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(parseISO(row.original.occurredAt), 'dd MMM yyyy')}
        </span>
      ),
    },
    {
      accessorKey: 'location',
      header: 'Location',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.location ?? '—'}</span>
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
      id: 'booking',
      header: 'Booking',
      cell: ({ row }) => {
        const b = row.original.booking;
        return b ? (
          <div>
            <div className="text-xs font-mono text-foreground">{b.bookingNumber}</div>
            <div className="text-xs text-muted-foreground">{b.customer.fullName}</div>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorKey: 'policeReportRef',
      header: 'Police Ref',
      cell: ({ row }) => (
        <span className="text-xs font-mono text-muted-foreground">{row.original.policeReportRef ?? '—'}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(row.original)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AccidentsClient() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AccidentReport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccidentReport | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['accidents', pagination],
    queryFn: () => accidentsApi.list({ page: pagination.pageIndex + 1, limit: pagination.pageSize }),
  });

  const { mutate: saveAccident, isPending: saving } = useMutation({
    mutationFn: (dto: CreateAccidentDto) => {
      if (editTarget) {
        const { carId: _unused, ...updateDto } = dto;
        void _unused;
        return accidentsApi.update(editTarget.id, updateDto);
      }
      return accidentsApi.create(dto);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accidents'] });
      setSheetOpen(false);
      setEditTarget(null);
      form.reset();
      toast({ title: editTarget ? 'Report updated' : 'Accident reported' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const { mutate: deleteAccident, isPending: deleting } = useMutation({
    mutationFn: () => accidentsApi.delete(deleteTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accidents'] });
      setDeleteTarget(null);
      toast({ title: 'Report deleted' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const fetchCars = useCallback(async (q: string) => {
    const res = await lookupApi.cars(q);
    return res.map((c) => ({ value: c.id, label: `${c.make} ${c.model} (${c.year})`, description: c.licensePlate }));
  }, []);

  const fetchBookings = useCallback(async (q: string) => {
    const res = await lookupApi.bookings(q);
    return res.map((b) => ({ value: b.id, label: b.bookingNumber, description: b.customer.fullName }));
  }, []);

  const openCreate = () => {
    setEditTarget(null);
    form.reset({});
    setSheetOpen(true);
  };

  const openEdit = (r: AccidentReport) => {
    setEditTarget(r);
    form.reset({
      carId: r.car.id,
      bookingId: r.booking?.id ?? undefined,
      occurredAt: r.occurredAt.slice(0, 16),
      location: r.location ?? undefined,
      policeReportRef: r.policeReportRef ?? undefined,
      description: r.description,
      insuranceClaimId: r.insuranceClaimId ?? undefined,
    });
    setSheetOpen(true);
  };

  const columns = useColumns(openEdit, setDeleteTarget);

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        totalCount={data?.total}
        pagination={pagination}
        onPaginationChange={setPagination}
        loading={isLoading}
        emptyMessage="No accident reports."
        toolbar={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Report Accident
            </Button>
          </div>
        }
      />

      {/* Create / Edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) setEditTarget(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              <span className="inline-flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                {editTarget ? 'Edit Accident Report' : 'Report Accident'}
              </span>
            </SheetTitle>
          </SheetHeader>

          <form
            className="mt-6 space-y-5"
            onSubmit={form.handleSubmit((d) => saveAccident(d as CreateAccidentDto))}
          >
            <div className="space-y-2">
              <Label>Car <span className="text-destructive">*</span></Label>
              <AsyncCombobox
                fetchOptions={fetchCars}
                value={form.watch('carId') ?? ''}
                onValueChange={(v) => form.setValue('carId', v)}
                placeholder="Search car…"
                disabled={!!editTarget}
              />
              {form.formState.errors.carId && (
                <p className="text-xs text-destructive">{form.formState.errors.carId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Related Booking (optional)</Label>
              <AsyncCombobox
                fetchOptions={fetchBookings}
                value={form.watch('bookingId') ?? ''}
                onValueChange={(v) => form.setValue('bookingId', v || undefined)}
                placeholder="Search booking…"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date & Time <span className="text-destructive">*</span></Label>
                <Input {...form.register('occurredAt')} type="datetime-local" />
                {form.formState.errors.occurredAt && (
                  <p className="text-xs text-destructive">{form.formState.errors.occurredAt.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input {...form.register('location')} placeholder="e.g. Sheikh Zayed Rd" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description <span className="text-destructive">*</span></Label>
              <Textarea {...form.register('description')} placeholder="What happened…" rows={3} />
              {form.formState.errors.description && (
                <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Police Report Ref</Label>
                <Input {...form.register('policeReportRef')} placeholder="MOI-2025-XXXXX" className="font-mono text-sm" />
              </div>
              <div className="space-y-2">
                <Label>Insurance Claim ID</Label>
                <Input {...form.register('insuranceClaimId')} placeholder="Claim reference" className="font-mono text-sm" />
              </div>
            </div>

            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                <Car className="h-4 w-4 mr-1" />
                {saving ? 'Saving…' : editTarget ? 'Update Report' : 'Submit Report'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Report</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Delete the accident report for <strong>{deleteTarget?.car.make} {deleteTarget?.car.model}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={() => deleteAccident()}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
