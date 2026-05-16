'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Plus, Pencil, Trash2, ArrowLeftRight, Upload } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { carsApi, Car, CarStatus, CreateCarDto, UpdateCarDto, tagsApi, Tag } from '@/lib/api';
import { DataTable, BulkAction } from '@/components/ui/data-table/data-table';
import { AsyncCombobox } from '@/components/ui/combobox/async-combobox';
import { Combobox } from '@/components/ui/combobox/combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/lib/hooks/use-toast';
import { lookupApi } from '@/lib/api';

// ── Tags panel ────────────────────────────────────────────────────────────────

function TagsPanel({ entityId, assignedTags, onAssign, onRemove }: {
  entityId: string;
  assignedTags: { tag: { id: string; name: string; color: string | null } }[];
  onAssign: (tagId: string) => void;
  onRemove: (tagId: string) => void;
}) {
  const qc = useQueryClient();
  const { data: allTags = [] } = useQuery({ queryKey: ['tags'], queryFn: tagsApi.list });
  const assigned = assignedTags.map((t) => t.tag);
  const assignedIds = new Set(assigned.map((t) => t.id));
  const available = (allTags as Tag[]).filter((t) => !assignedIds.has(t.id));

  return (
    <div className="space-y-2">
      <Label>Tags</Label>
      <div className="flex flex-wrap gap-1 min-h-[28px]">
        {assigned.map((tag) => (
          <Badge key={tag.id} variant="secondary" className="gap-1 pl-2 pr-1">
            {tag.name}
            <button type="button" className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5" onClick={() => onRemove(tag.id)}>
              ×
            </button>
          </Badge>
        ))}
        {assigned.length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
      </div>
      {available.length > 0 && (
        <Combobox
          options={available.map((t) => ({ value: t.id, label: t.name }))}
          value=""
          onValueChange={(id) => { if (id) onAssign(id); }}
          placeholder="Add tag…"
          className="h-8 text-sm"
        />
      )}
    </div>
  );
}
import { CsvImportDialog } from '@/components/shared/csv-import/csv-import-dialog';
import { SavedViewsToolbar } from '@/components/shared/saved-views/saved-views-toolbar';

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<CarStatus, string> = {
  AVAILABLE: 'Available',
  RENTED: 'Rented',
  IN_MAINTENANCE: 'In Maintenance',
  OUT_OF_SERVICE: 'Out of Service',
};

const STATUS_VARIANT: Record<CarStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  AVAILABLE: 'default',
  RENTED: 'secondary',
  IN_MAINTENANCE: 'outline',
  OUT_OF_SERVICE: 'destructive',
};

// ── Form schema ───────────────────────────────────────────────────────────────

const carSchema = z.object({
  make: z.string().min(1, 'Required'),
  model: z.string().min(1, 'Required'),
  year: z.coerce.number().min(1900).max(new Date().getFullYear() + 2),
  licensePlate: z.string().min(1, 'Required'),
  vin: z.string().min(1, 'Required'),
  categoryId: z.string().min(1, 'Required'),
  transmission: z.enum(['MANUAL', 'AUTOMATIC']),
  fuelType: z.enum(['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC', 'LPG']),
  seats: z.coerce.number().min(1).max(50),
  homeBranchId: z.string().min(1, 'Required'),
  currentMileage: z.coerce.number().min(0).optional(),
  purchaseCost: z.string().optional(),
  registrationExpiry: z.string().optional(),
  status: z.enum(['AVAILABLE', 'RENTED', 'IN_MAINTENANCE', 'OUT_OF_SERVICE']).optional(),
});

type CarFormValues = z.infer<typeof carSchema>;

// ── Table columns ─────────────────────────────────────────────────────────────

function useColumns(onEdit: (car: Car) => void, onDelete: (car: Car) => void, onTransfer: (car: Car) => void) {
  const columns: ColumnDef<Car>[] = [
    {
      accessorFn: (r) => `${r.make} ${r.model}`,
      header: 'Vehicle',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.make} {row.original.model}</div>
          <div className="text-xs text-muted-foreground">{row.original.year} · {row.original.licensePlate}</div>
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => row.original.category.name,
    },
    {
      accessorKey: 'transmission',
      header: 'Trans.',
      cell: ({ getValue }) => (getValue() as string).charAt(0) + (getValue() as string).slice(1).toLowerCase(),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const s = getValue() as CarStatus;
        return <Badge variant={STATUS_VARIANT[s]}>{STATUS_LABELS[s]}</Badge>;
      },
    },
    {
      accessorKey: 'homeBranch',
      header: 'Branch',
      cell: ({ row }) => row.original.homeBranch.name,
    },
    {
      accessorKey: 'currentMileage',
      header: 'Mileage',
      cell: ({ getValue }) => `${(getValue() as number).toLocaleString()} km`,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-1 justify-end">
          <Button size="icon" variant="ghost" title="Transfer branch" onClick={(e) => { e.stopPropagation(); onTransfer(row.original); }}>
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onEdit(row.original); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onDelete(row.original); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];
  return columns;
}

// ── Main component ────────────────────────────────────────────────────────────

export function CarsClient() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editCar, setEditCar] = useState<Car | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Car | null>(null);
  const [transferTarget, setTransferTarget] = useState<Car | null>(null);
  const [transferBranchId, setTransferBranchId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['cars', pagination, search, statusFilter],
    queryFn: () => carsApi.list({ page: pagination.pageIndex + 1, limit: pagination.pageSize, search: search || undefined, status: statusFilter || undefined }),
    placeholderData: (prev) => prev,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['car-categories'],
    queryFn: () => carsApi.listCategories(),
  });

  const form = useForm<CarFormValues>({ resolver: zodResolver(carSchema) });

  const createMutation = useMutation({
    mutationFn: (dto: CreateCarDto) => carsApi.create(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cars'] }); setSheetOpen(false); toast({ title: 'Car added' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCarDto }) => carsApi.update(id, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cars'] }); setSheetOpen(false); toast({ title: 'Car updated' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => carsApi.delete(id))),
    onSuccess: (_, ids) => { qc.invalidateQueries({ queryKey: ['cars'] }); toast({ title: `${ids.length} car(s) deleted` }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: CarStatus }) =>
      Promise.all(ids.map((id) => carsApi.update(id, { status }))),
    onSuccess: (_, { ids }) => { qc.invalidateQueries({ queryKey: ['cars'] }); toast({ title: `${ids.length} car(s) updated` }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const bulkActions: BulkAction[] = [
    {
      label: 'Set Available',
      variant: 'outline',
      onClick: (ids) => bulkStatusMutation.mutate({ ids, status: 'AVAILABLE' }),
    },
    {
      label: 'Set Out of Service',
      variant: 'outline',
      onClick: (ids) => bulkStatusMutation.mutate({ ids, status: 'OUT_OF_SERVICE' }),
    },
    {
      label: 'Delete Selected',
      variant: 'destructive',
      onClick: (ids) => { if (confirm(`Delete ${ids.length} car(s)?`)) bulkDeleteMutation.mutate(ids); },
    },
  ];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => carsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cars'] }); setDeleteTarget(null); toast({ title: 'Car removed' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const transferMutation = useMutation({
    mutationFn: ({ id, toBranchId, notes }: { id: string; toBranchId: string; notes: string }) =>
      carsApi.transfer(id, { toBranchId, notes: notes || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cars'] });
      setTransferTarget(null);
      setTransferBranchId('');
      setTransferNotes('');
      toast({ title: 'Car transferred' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const assignTagMutation = useMutation({
    mutationFn: ({ carId, tagId }: { carId: string; tagId: string }) => tagsApi.assignToCar(carId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cars'] }),
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const removeTagMutation = useMutation({
    mutationFn: ({ carId, tagId }: { carId: string; tagId: string }) => tagsApi.removeFromCar(carId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cars'] }),
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  function openCreate() {
    setEditCar(null);
    form.reset({ transmission: 'AUTOMATIC', fuelType: 'PETROL', seats: 5, currentMileage: 0 });
    setSheetOpen(true);
  }

  function openEdit(car: Car) {
    setEditCar(car);
    form.reset({
      make: car.make, model: car.model, year: car.year,
      licensePlate: car.licensePlate, vin: car.vin,
      categoryId: car.category.id,
      transmission: car.transmission, fuelType: car.fuelType,
      seats: car.seats, homeBranchId: car.homeBranch.id,
      currentMileage: car.currentMileage,
      status: car.status,
      purchaseCost: car.purchaseCost ?? undefined,
      registrationExpiry: car.registrationExpiry ? car.registrationExpiry.split('T')[0] : undefined,
    });
    setSheetOpen(true);
  }

  function onSubmit(values: CarFormValues) {
    if (editCar) {
      updateMutation.mutate({ id: editCar.id, dto: values as UpdateCarDto });
    } else {
      createMutation.mutate(values as CreateCarDto);
    }
  }

  const columns = useColumns(openEdit, (car) => setDeleteTarget(car), (car) => { setTransferTarget(car); setTransferBranchId(''); setTransferNotes(''); });

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));
  const transmissionOptions = [{ value: 'AUTOMATIC', label: 'Automatic' }, { value: 'MANUAL', label: 'Manual' }];
  const fuelOptions = [
    { value: 'PETROL', label: 'Petrol' }, { value: 'DIESEL', label: 'Diesel' },
    { value: 'HYBRID', label: 'Hybrid' }, { value: 'ELECTRIC', label: 'Electric' }, { value: 'LPG', label: 'LPG' },
  ];
  const statusOptions = [
    { value: '', label: 'All statuses' },
    ...Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fleet</h1>
          <p className="text-sm text-muted-foreground">Manage vehicles, categories, and transfers</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> Import CSV
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Add Car
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <Input
          placeholder="Search make, model, plate, VIN…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPagination((p) => ({ ...p, pageIndex: 0 })); }}
          className="max-w-xs"
        />
        <Combobox
          options={statusOptions}
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v); setPagination((p) => ({ ...p, pageIndex: 0 })); }}
          placeholder="Filter by status"
          className="w-48"
        />
        <div className="ml-auto">
          <SavedViewsToolbar
            page="cars"
            currentFilters={{ search, statusFilter }}
            onLoadView={(f) => {
              const filters = f as { search?: string; statusFilter?: string };
              if (filters.search !== undefined) setSearch(filters.search);
              if (filters.statusFilter !== undefined) setStatusFilter(filters.statusFilter);
            }}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        totalCount={data?.total}
        pagination={pagination}
        onPaginationChange={setPagination}
        emptyMessage="No cars found"
        enableRowSelection
        bulkActions={bulkActions}
      />

      {/* Add / Edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editCar ? 'Edit Car' : 'Add Car'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Make *</Label>
                <Input {...form.register('make')} placeholder="Toyota" />
                {form.formState.errors.make && <p className="text-xs text-destructive">{form.formState.errors.make.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Model *</Label>
                <Input {...form.register('model')} placeholder="Camry" />
                {form.formState.errors.model && <p className="text-xs text-destructive">{form.formState.errors.model.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Year *</Label>
                <Input {...form.register('year')} type="number" placeholder="2024" />
              </div>
              <div className="space-y-1">
                <Label>Seats *</Label>
                <Input {...form.register('seats')} type="number" placeholder="5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>License Plate *</Label>
                <Input {...form.register('licensePlate')} placeholder="ABC-1234" />
                {form.formState.errors.licensePlate && <p className="text-xs text-destructive">{form.formState.errors.licensePlate.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>VIN *</Label>
                <Input {...form.register('vin')} placeholder="1HGBH41JXMN109186" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Category *</Label>
              <Controller
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <Combobox
                    options={categoryOptions}
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    placeholder="Select category"
                  />
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Transmission *</Label>
                <Controller
                  control={form.control}
                  name="transmission"
                  render={({ field }) => (
                    <Combobox options={transmissionOptions} value={field.value ?? ''} onValueChange={field.onChange} placeholder="Select" />
                  )}
                />
              </div>
              <div className="space-y-1">
                <Label>Fuel Type *</Label>
                <Controller
                  control={form.control}
                  name="fuelType"
                  render={({ field }) => (
                    <Combobox options={fuelOptions} value={field.value ?? ''} onValueChange={field.onChange} placeholder="Select" />
                  )}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Home Branch *</Label>
              <Controller
                control={form.control}
                name="homeBranchId"
                render={({ field }) => (
                  <AsyncCombobox
                    value={field.value ?? ''}
                    onValueChange={(v) => field.onChange(v)}
                    fetchOptions={async (q) => {
                      const res = await lookupApi.branches(q);
                      return res.map((b) => ({ value: b.id, label: b.name, description: b.city }));
                    }}
                    placeholder="Search branch…"
                  />
                )}
              />
            </div>

            {editCar && (
              <div className="space-y-1">
                <Label>Status</Label>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Combobox
                      options={Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                      placeholder="Select status"
                    />
                  )}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Mileage (km)</Label>
                <Input {...form.register('currentMileage')} type="number" placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label>Purchase Cost</Label>
                <Input {...form.register('purchaseCost')} placeholder="0.00" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Registration Expiry</Label>
              <Input {...form.register('registrationExpiry')} type="date" />
            </div>

            {editCar && (
              <TagsPanel
                entityId={editCar.id}
                assignedTags={editCar.tags}
                onAssign={(tagId) => assignTagMutation.mutate({ carId: editCar.id, tagId })}
                onRemove={(tagId) => removeTagMutation.mutate({ carId: editCar.id, tagId })}
              />
            )}

            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editCar ? 'Save Changes' : 'Add Car'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} kind="cars" invalidateKey="cars" />

      {/* Transfer dialog */}
      <Dialog open={!!transferTarget} onOpenChange={() => setTransferTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Car</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Transfer <strong>{transferTarget?.make} {transferTarget?.model}</strong> ({transferTarget?.licensePlate}) to a new home branch.
          </p>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Destination Branch *</Label>
              <AsyncCombobox
                value={transferBranchId}
                onValueChange={setTransferBranchId}
                fetchOptions={async (q) => {
                  const res = await lookupApi.branches(q);
                  return res.map((b) => ({ value: b.id, label: b.name, description: b.city }));
                }}
                placeholder="Search branch…"
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                placeholder="Reason for transfer (optional)"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setTransferTarget(null)}>Cancel</Button>
            <Button
              disabled={!transferBranchId || transferMutation.isPending}
              onClick={() => transferTarget && transferMutation.mutate({ id: transferTarget.id, toBranchId: transferBranchId, notes: transferNotes })}
            >
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Car</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{deleteTarget?.make} {deleteTarget?.model}</strong> ({deleteTarget?.licensePlate})?
            This action soft-deletes the car.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
