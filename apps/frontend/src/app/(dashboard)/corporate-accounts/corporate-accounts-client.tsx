'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { corporateAccountsApi, CorporateAccount, CreateCorporateAccountDto, UpdateCorporateAccountDto } from '@/lib/api';
import { DataTable } from '@/components/ui/data-table/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/lib/hooks/use-toast';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  taxNumber: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  billingAddress: z.string().optional(),
  creditLimit: z.string().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function useColumns(onEdit: (a: CorporateAccount) => void, onDelete: (a: CorporateAccount) => void) {
  const columns: ColumnDef<CorporateAccount>[] = [
    {
      accessorKey: 'name',
      header: 'Company Name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          {row.original.taxNumber && <div className="text-xs text-muted-foreground">TRN: {row.original.taxNumber}</div>}
        </div>
      ),
    },
    {
      accessorKey: 'contactName',
      header: 'Contact',
      cell: ({ row }) => (
        <div>
          <div>{row.original.contactName ?? '—'}</div>
          {row.original.contactEmail && <div className="text-xs text-muted-foreground">{row.original.contactEmail}</div>}
        </div>
      ),
    },
    {
      accessorKey: 'creditLimit',
      header: 'Credit Limit',
      cell: ({ row }) =>
        row.original.creditLimit
          ? `${row.original.currency ?? ''} ${Number(row.original.creditLimit).toLocaleString()}`
          : '—',
    },
    {
      accessorKey: '_count',
      header: 'Customers',
      cell: ({ row }) => row.original._count.customers,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-1 justify-end">
          <Button size="icon" variant="ghost" onClick={() => onEdit(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(row.original)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];
  return columns;
}

export function CorporateAccountsClient() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<CorporateAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CorporateAccount | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['corporate-accounts', pagination, search],
    queryFn: () => corporateAccountsApi.list({ page: pagination.pageIndex + 1, limit: pagination.pageSize, search: search || undefined }),
    placeholderData: (prev) => prev,
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: (dto: CreateCorporateAccountDto) => corporateAccountsApi.create(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['corporate-accounts'] }); setSheetOpen(false); toast({ title: 'Account created' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCorporateAccountDto }) => corporateAccountsApi.update(id, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['corporate-accounts'] }); setSheetOpen(false); toast({ title: 'Account updated' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => corporateAccountsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['corporate-accounts'] }); setDeleteTarget(null); toast({ title: 'Account removed' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  function openCreate() {
    setEditAccount(null);
    form.reset({ currency: 'EGP' });
    setSheetOpen(true);
  }

  function openEdit(account: CorporateAccount) {
    setEditAccount(account);
    form.reset({
      name: account.name,
      taxNumber: account.taxNumber ?? '',
      contactName: account.contactName ?? '',
      contactEmail: account.contactEmail ?? '',
      contactPhone: account.contactPhone ?? '',
      billingAddress: account.billingAddress ?? '',
      creditLimit: account.creditLimit ?? '',
      currency: account.currency ?? 'EGP',
      notes: account.notes ?? '',
    });
    setSheetOpen(true);
  }

  function onSubmit(values: FormValues) {
    const dto = { ...values, contactEmail: values.contactEmail || undefined, creditLimit: values.creditLimit || undefined };
    if (editAccount) {
      updateMutation.mutate({ id: editAccount.id, dto });
    } else {
      createMutation.mutate(dto as CreateCorporateAccountDto);
    }
  }

  const columns = useColumns(openEdit, (a) => setDeleteTarget(a));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Corporate Accounts</h1>
          <p className="text-sm text-muted-foreground">Manage B2B clients and credit limits</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add Account
        </Button>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Search company, contact, TRN…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPagination((p) => ({ ...p, pageIndex: 0 })); }}
          className="max-w-xs"
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        totalCount={data?.total}
        pagination={pagination}
        onPaginationChange={setPagination}
        emptyMessage="No corporate accounts found"
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[460px] sm:max-w-[460px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editAccount ? 'Edit Account' : 'Add Corporate Account'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Company Name *</Label>
              <Input {...form.register('name')} placeholder="Acme Corp" />
              {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Tax / Registration Number</Label>
              <Input {...form.register('taxNumber')} placeholder="EG-123456789" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Contact Name</Label>
                <Input {...form.register('contactName')} placeholder="John Smith" />
              </div>
              <div className="space-y-1">
                <Label>Contact Phone</Label>
                <Input {...form.register('contactPhone')} placeholder="+20 100 000 0000" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Contact Email</Label>
              <Input {...form.register('contactEmail')} type="email" placeholder="billing@acme.com" />
            </div>

            <div className="space-y-1">
              <Label>Billing Address</Label>
              <Input {...form.register('billingAddress')} placeholder="123 Business District, Cairo" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Credit Limit</Label>
                <Input {...form.register('creditLimit')} placeholder="50000.00" />
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Input {...form.register('currency')} placeholder="EGP" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <textarea
                {...form.register('notes')}
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] bg-background"
                placeholder="Internal notes…"
              />
            </div>

            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editAccount ? 'Save Changes' : 'Create Account'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove Corporate Account</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{deleteTarget?.name}</strong>? This soft-deletes the account.
            Associated customers will remain but lose their corporate link.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
