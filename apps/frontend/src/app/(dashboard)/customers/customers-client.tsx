'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { customersApi, Customer, CustomerFlag, CustomerSource, CreateCustomerDto, UpdateCustomerDto, lookupApi } from '@/lib/api';
import { DataTable } from '@/components/ui/data-table/data-table';
import { AsyncCombobox } from '@/components/ui/combobox/async-combobox';
import { Combobox } from '@/components/ui/combobox/combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/lib/hooks/use-toast';

const FLAG_VARIANT: Record<CustomerFlag, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  VIP: 'default',
  WATCHLIST: 'outline',
  BLACKLISTED: 'destructive',
};

const customerSchema = z.object({
  fullName: z.string().min(1, 'Required'),
  phone: z.string().min(1, 'Required'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  nationality: z.string().optional(),
  dateOfBirth: z.string().optional(),
  source: z.enum(['ADMIN_CREATED', 'SELF_REGISTERED', 'WALK_IN']),
  flag: z.enum(['BLACKLISTED', 'WATCHLIST', 'VIP']).optional().or(z.literal('')),
  flagReason: z.string().optional(),
  corporateAccountId: z.string().optional(),
  internalNotes: z.string().optional(),
  visibleNotes: z.string().optional(),
  licenseNumber: z.string().optional(),
  issuingCountry: z.string().optional(),
  licenseType: z.enum(['NATIONAL', 'INTERNATIONAL']).optional(),
  licenseExpiry: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

function useColumns(onEdit: (c: Customer) => void, onDelete: (c: Customer) => void) {
  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: 'fullName',
      header: 'Name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium flex items-center gap-2">
            {row.original.fullName}
            {row.original.flag && (
              <Badge variant={FLAG_VARIANT[row.original.flag]} className="text-[10px] px-1 py-0">
                {row.original.flag}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{row.original.phone}</div>
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      accessorKey: 'nationality',
      header: 'Nationality',
      cell: ({ getValue }) => getValue() ?? '—',
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
      },
    },
    {
      accessorKey: 'corporateAccount',
      header: 'Company',
      cell: ({ row }) => row.original.corporateAccount?.name ?? '—',
    },
    {
      accessorKey: '_count',
      header: 'Bookings',
      cell: ({ row }) => row.original._count.bookings,
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

export function CustomersClient() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [flagFilter, setFlagFilter] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search, flagFilter],
    queryFn: () => customersApi.list({ page, limit: 20, search: search || undefined, flag: flagFilter || undefined }),
    placeholderData: (prev) => prev,
  });

  const form = useForm<CustomerFormValues>({ resolver: zodResolver(customerSchema) });

  const createMutation = useMutation({
    mutationFn: (dto: CreateCustomerDto) => customersApi.create(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setSheetOpen(false); toast({ title: 'Customer added' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCustomerDto }) => customersApi.update(id, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setSheetOpen(false); toast({ title: 'Customer updated' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setDeleteTarget(null); toast({ title: 'Customer removed' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  function openCreate() {
    setEditCustomer(null);
    form.reset({ source: 'ADMIN_CREATED', licenseType: 'NATIONAL' });
    setSheetOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditCustomer(customer);
    form.reset({
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email ?? '',
      address: customer.address ?? '',
      nationality: customer.nationality ?? '',
      dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.split('T')[0] : '',
      source: customer.source,
      flag: customer.flag ?? undefined,
      flagReason: customer.flagReason ?? '',
      corporateAccountId: customer.corporateAccount?.id ?? '',
      internalNotes: customer.internalNotes ?? '',
      visibleNotes: customer.visibleNotes ?? '',
    });
    setSheetOpen(true);
  }

  function onSubmit(values: CustomerFormValues) {
    const { licenseNumber, issuingCountry, licenseType, licenseExpiry, flag, email, ...rest } = values;
    const dto = {
      ...rest,
      email: email || undefined,
      flag: (flag || undefined) as CustomerFlag | undefined,
      primaryLicense: licenseNumber && issuingCountry && licenseType && licenseExpiry
        ? { licenseNumber, issuingCountry, licenseType, expiryDate: licenseExpiry }
        : undefined,
    };
    if (editCustomer) {
      const { primaryLicense, ...updateDto } = dto as any;
      updateMutation.mutate({ id: editCustomer.id, dto: updateDto });
    } else {
      createMutation.mutate(dto as CreateCustomerDto);
    }
  }

  const columns = useColumns(openEdit, (c) => setDeleteTarget(c));
  const sourceOptions = [
    { value: 'ADMIN_CREATED', label: 'Admin Created' },
    { value: 'SELF_REGISTERED', label: 'Self Registered' },
    { value: 'WALK_IN', label: 'Walk In' },
  ];
  const flagOptions = [
    { value: '', label: 'All customers' },
    { value: 'VIP', label: 'VIP' },
    { value: 'WATCHLIST', label: 'Watchlist' },
    { value: 'BLACKLISTED', label: 'Blacklisted' },
  ];
  const licenseTypeOptions = [
    { value: 'NATIONAL', label: 'National' },
    { value: 'INTERNATIONAL', label: 'International' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">Manage customer profiles and driver licenses</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add Customer
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Search name, email, phone…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
        <Combobox
          options={flagOptions}
          value={flagFilter}
          onChange={(v) => { setFlagFilter(v); setPage(1); }}
          placeholder="Filter by flag"
          className="w-44"
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        pagination={{ page, pageCount: data?.pages ?? 1, onPageChange: setPage }}
        emptyMessage="No customers found"
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editCustomer ? 'Edit Customer' : 'Add Customer'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="py-4">
            <Tabs defaultValue="info">
              <TabsList className="mb-4">
                <TabsTrigger value="info">Info</TabsTrigger>
                {!editCustomer && <TabsTrigger value="license">License</TabsTrigger>}
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label>Full Name *</Label>
                    <Input {...form.register('fullName')} placeholder="Ahmed Hassan" />
                    {form.formState.errors.fullName && <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>Phone *</Label>
                    <Input {...form.register('phone')} placeholder="+20 100 000 0000" />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input {...form.register('email')} type="email" placeholder="ahmed@example.com" />
                  </div>
                  <div className="space-y-1">
                    <Label>Nationality</Label>
                    <Input {...form.register('nationality')} placeholder="EG" />
                  </div>
                  <div className="space-y-1">
                    <Label>Date of Birth</Label>
                    <Input {...form.register('dateOfBirth')} type="date" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label>Address</Label>
                    <Input {...form.register('address')} placeholder="123 Main St, Cairo" />
                  </div>
                  <div className="space-y-1">
                    <Label>Source *</Label>
                    <Controller
                      control={form.control}
                      name="source"
                      render={({ field }) => (
                        <Combobox options={sourceOptions} value={field.value ?? ''} onChange={field.onChange} placeholder="Select" />
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Flag</Label>
                    <Controller
                      control={form.control}
                      name="flag"
                      render={({ field }) => (
                        <Combobox
                          options={[{ value: '', label: 'None' }, { value: 'VIP', label: 'VIP' }, { value: 'WATCHLIST', label: 'Watchlist' }, { value: 'BLACKLISTED', label: 'Blacklisted' }]}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          placeholder="No flag"
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label>Corporate Account</Label>
                    <Controller
                      control={form.control}
                      name="corporateAccountId"
                      render={({ field }) => (
                        <AsyncCombobox
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          loadOptions={async (q) => {
                            const res = await lookupApi.corporateAccounts(q);
                            return res.map((a) => ({ value: a.id, label: a.name, description: a.taxNumber ?? undefined }));
                          }}
                          placeholder="Search company…"
                        />
                      )}
                    />
                  </div>
                </div>
              </TabsContent>

              {!editCustomer && (
                <TabsContent value="license" className="space-y-3">
                  <p className="text-xs text-muted-foreground">Optional — add primary driver license now or later.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-2">
                      <Label>License Number</Label>
                      <Input {...form.register('licenseNumber')} placeholder="EG-123456" />
                    </div>
                    <div className="space-y-1">
                      <Label>Issuing Country</Label>
                      <Input {...form.register('issuingCountry')} placeholder="EG" />
                    </div>
                    <div className="space-y-1">
                      <Label>Type</Label>
                      <Controller
                        control={form.control}
                        name="licenseType"
                        render={({ field }) => (
                          <Combobox options={licenseTypeOptions} value={field.value ?? ''} onChange={field.onChange} placeholder="Type" />
                        )}
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label>Expiry Date</Label>
                      <Input {...form.register('licenseExpiry')} type="date" />
                    </div>
                  </div>
                </TabsContent>
              )}

              <TabsContent value="notes" className="space-y-3">
                <div className="space-y-1">
                  <Label>Visible Notes (shown on contract)</Label>
                  <textarea
                    {...form.register('visibleNotes')}
                    className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] bg-background"
                    placeholder="e.g. Requires child seat"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Internal Notes (staff only)</Label>
                  <textarea
                    {...form.register('internalNotes')}
                    className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] bg-background"
                    placeholder="e.g. Pays late, always follow up"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <SheetFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editCustomer ? 'Save Changes' : 'Add Customer'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove Customer</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{deleteTarget?.fullName}</strong>? This soft-deletes the record.
            Customers with active bookings cannot be removed.
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
