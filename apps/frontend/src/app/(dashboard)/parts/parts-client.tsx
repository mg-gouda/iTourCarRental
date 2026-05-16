'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Plus, Pencil, Trash2, AlertTriangle, Package } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { partsApi, Part, CreatePartDto, lookupApi } from '@/lib/api';
import { DataTable } from '@/components/ui/data-table/data-table';
import { AsyncCombobox } from '@/components/ui/combobox/async-combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/lib/hooks/use-toast';
import { useCallback } from 'react';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const partSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  unitCost: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valid amount required'),
  currency: z.string().min(3).max(3),
  lowStockThreshold: z.coerce.number().min(0).optional(),
});

const stockSchema = z.object({
  branchId: z.string().min(1, 'Branch is required'),
  quantity: z.coerce.number(),
});

type PartFormValues = z.infer<typeof partSchema>;
type StockFormValues = z.infer<typeof stockSchema>;

// ─── Columns ──────────────────────────────────────────────────────────────────

function useColumns(
  onEdit: (p: Part) => void,
  onAdjust: (p: Part) => void,
  onDelete: (p: Part) => void,
): ColumnDef<Part>[] {
  return [
    {
      accessorKey: 'sku',
      header: 'SKU',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.sku}</span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-sm">{row.original.name}</div>
          {row.original.description && (
            <div className="text-xs text-muted-foreground line-clamp-1">{row.original.description}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'unitCost',
      header: 'Unit Cost',
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.currency} {parseFloat(row.original.unitCost).toFixed(2)}
        </span>
      ),
    },
    {
      id: 'stock',
      header: 'Total Stock',
      cell: ({ row }) => {
        const low = row.original.isLowStock;
        return (
          <span className={`inline-flex items-center gap-1 text-sm font-medium ${low ? 'text-amber-600 dark:text-amber-400' : ''}`}>
            {low && <AlertTriangle className="h-3.5 w-3.5" />}
            {row.original.totalStock}
          </span>
        );
      },
    },
    {
      accessorKey: 'lowStockThreshold',
      header: 'Low Stock At',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.lowStockThreshold}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onAdjust(row.original)} title="Adjust stock">
            <Package className="h-4 w-4" />
          </Button>
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

export function PartsClient() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Part | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<Part | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Part | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['parts', pagination, search, lowStockOnly],
    queryFn: () => partsApi.list({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      search: search || undefined,
      lowStock: lowStockOnly || undefined,
    }),
  });

  const { mutate: savePart, isPending: saving } = useMutation({
    mutationFn: (dto: CreatePartDto) =>
      editTarget ? partsApi.update(editTarget.id, dto) : partsApi.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parts'] });
      setSheetOpen(false);
      setEditTarget(null);
      partForm.reset();
      toast({ title: editTarget ? 'Part updated' : 'Part created' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const { mutate: adjustStock, isPending: adjusting } = useMutation({
    mutationFn: (dto: StockFormValues) =>
      partsApi.adjustStock(adjustTarget!.id, dto.branchId, dto.quantity),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parts'] });
      setAdjustTarget(null);
      stockForm.reset();
      toast({ title: 'Stock adjusted' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const { mutate: deletePart, isPending: deleting } = useMutation({
    mutationFn: () => partsApi.delete(deleteTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parts'] });
      setDeleteTarget(null);
      toast({ title: 'Part deleted' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const partForm = useForm<PartFormValues>({
    resolver: zodResolver(partSchema),
    defaultValues: { currency: 'AED', lowStockThreshold: 5 },
  });

  const stockForm = useForm<StockFormValues>({ resolver: zodResolver(stockSchema), defaultValues: { quantity: 0 } });

  const fetchBranches = useCallback(async (q: string) => {
    const res = await lookupApi.branches(q);
    return res.map((b) => ({ value: b.id, label: b.name, description: b.code }));
  }, []);

  const openCreate = () => {
    setEditTarget(null);
    partForm.reset({ currency: 'AED', lowStockThreshold: 5 });
    setSheetOpen(true);
  };

  const openEdit = (p: Part) => {
    setEditTarget(p);
    partForm.reset({
      sku: p.sku,
      name: p.name,
      description: p.description ?? undefined,
      unitCost: p.unitCost,
      currency: p.currency,
      lowStockThreshold: p.lowStockThreshold,
    });
    setSheetOpen(true);
  };

  const columns = useColumns(openEdit, setAdjustTarget, setDeleteTarget);

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        totalCount={data?.total}
        pagination={pagination}
        onPaginationChange={setPagination}
        loading={isLoading}
        emptyMessage="No parts found."
        toolbar={
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search parts…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPagination((p) => ({ ...p, pageIndex: 0 })); }}
              className="w-56"
            />
            <Button
              variant={lowStockOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLowStockOnly((v) => !v)}
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              Low Stock
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Add Part
            </Button>
          </div>
        }
      />

      {/* Create / Edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) setEditTarget(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editTarget ? 'Edit Part' : 'Add Part'}</SheetTitle>
          </SheetHeader>

          <form className="mt-6 space-y-4" onSubmit={partForm.handleSubmit((d) => savePart(d))}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SKU <span className="text-destructive">*</span></Label>
                <Input {...partForm.register('sku')} placeholder="PART-001" className="font-mono" />
                {partForm.formState.errors.sku && (
                  <p className="text-xs text-destructive">{partForm.formState.errors.sku.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input {...partForm.register('currency')} placeholder="AED" maxLength={3} className="uppercase" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input {...partForm.register('name')} placeholder="Part name" />
              {partForm.formState.errors.name && (
                <p className="text-xs text-destructive">{partForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea {...partForm.register('description')} placeholder="Optional description" rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit Cost <span className="text-destructive">*</span></Label>
                <Input {...partForm.register('unitCost')} placeholder="0.00" className="font-mono" />
                {partForm.formState.errors.unitCost && (
                  <p className="text-xs text-destructive">{partForm.formState.errors.unitCost.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Low Stock Threshold</Label>
                <Input {...partForm.register('lowStockThreshold')} type="number" min={0} placeholder="5" />
              </div>
            </div>

            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editTarget ? 'Update' : 'Create'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Adjust stock dialog */}
      <Dialog open={!!adjustTarget} onOpenChange={(o) => { if (!o) { setAdjustTarget(null); stockForm.reset(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock — {adjustTarget?.name}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4 py-2" onSubmit={stockForm.handleSubmit((d) => adjustStock(d))}>
            <div className="space-y-2">
              <Label>Branch <span className="text-destructive">*</span></Label>
              <AsyncCombobox
                fetchOptions={fetchBranches}
                value={stockForm.watch('branchId') ?? ''}
                onValueChange={(v) => stockForm.setValue('branchId', v)}
                placeholder="Select branch…"
              />
              {stockForm.formState.errors.branchId && (
                <p className="text-xs text-destructive">{stockForm.formState.errors.branchId.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Quantity Adjustment</Label>
              <Input {...stockForm.register('quantity')} type="number" placeholder="e.g. 10 or -5" />
              <p className="text-xs text-muted-foreground">Positive to add, negative to remove.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setAdjustTarget(null); stockForm.reset(); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={adjusting}>
                {adjusting ? 'Saving…' : 'Apply'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Part</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={() => deletePart()}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
