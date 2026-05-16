'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Plus, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { vendorsApi, Vendor, CreateVendorDto } from '@/lib/api';
import { DataTable } from '@/components/ui/data-table/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/lib/hooks/use-toast';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact: z.string().optional(),
  phone: z.string().optional(),
  specialty: z.string().optional(),
  warrantyTerms: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Columns ──────────────────────────────────────────────────────────────────

function useColumns(onEdit: (v: Vendor) => void, onDelete: (v: Vendor) => void): ColumnDef<Vendor>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.name}</span>,
    },
    {
      accessorKey: 'specialty',
      header: 'Specialty',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.specialty ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'contact',
      header: 'Contact',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.contact ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => (
        <span className="text-sm font-mono text-muted-foreground">{row.original.phone ?? '—'}</span>
      ),
    },
    {
      id: 'usage',
      header: 'Jobs',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original._count.maintenance}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.isActive ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
            <CheckCircle className="h-3 w-3" /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <XCircle className="h-3 w-3" /> Inactive
          </span>
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

export function VendorsClient() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Vendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', pagination, search],
    queryFn: () => vendorsApi.list({ page: pagination.pageIndex + 1, limit: pagination.pageSize, search: search || undefined }),
  });

  const { mutate: saveVendor, isPending: saving } = useMutation({
    mutationFn: (dto: CreateVendorDto) =>
      editTarget ? vendorsApi.update(editTarget.id, dto) : vendorsApi.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setSheetOpen(false);
      setEditTarget(null);
      form.reset();
      toast({ title: editTarget ? 'Vendor updated' : 'Vendor created' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const { mutate: deleteVendor, isPending: deleting } = useMutation({
    mutationFn: () => vendorsApi.delete(deleteTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setDeleteTarget(null);
      toast({ title: 'Vendor deleted' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const openCreate = () => {
    setEditTarget(null);
    form.reset({});
    setSheetOpen(true);
  };

  const openEdit = (v: Vendor) => {
    setEditTarget(v);
    form.reset({
      name: v.name,
      contact: v.contact ?? undefined,
      phone: v.phone ?? undefined,
      specialty: v.specialty ?? undefined,
      warrantyTerms: v.warrantyTerms ?? undefined,
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
        emptyMessage="No vendors found."
        toolbar={
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search vendors…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPagination((p) => ({ ...p, pageIndex: 0 })); }}
              className="w-56"
            />
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Add Vendor
            </Button>
          </div>
        }
      />

      {/* Create / Edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) setEditTarget(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editTarget ? 'Edit Vendor' : 'Add Vendor'}</SheetTitle>
          </SheetHeader>

          <form className="mt-6 space-y-4" onSubmit={form.handleSubmit((d) => saveVendor(d))}>
            <div className="space-y-2">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input {...form.register('name')} placeholder="Workshop name" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Specialty</Label>
              <Input {...form.register('specialty')} placeholder="e.g. Engine, AC, Bodywork" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input {...form.register('contact')} placeholder="Name" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input {...form.register('phone')} placeholder="+971…" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Warranty Terms</Label>
              <Textarea {...form.register('warrantyTerms')} placeholder="e.g. 3 months on parts and labor" rows={3} />
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

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Vendor</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={() => deleteVendor()}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
