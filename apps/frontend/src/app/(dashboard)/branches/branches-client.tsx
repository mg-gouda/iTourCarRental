'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Plus, MoreHorizontal, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { branchesApi, Branch, CreateBranchDto, UpdateBranchDto } from '@/lib/api';
import { DataTable } from '@/components/ui/data-table/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/lib/hooks/use-toast';

// ─── Zod schema ──────────────────────────────────────────────────────────────

const branchSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be 2–10 characters').max(10).toUpperCase(),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  currency: z.string().default('USD'),
  timezone: z.string().default('UTC'),
});

type BranchFormValues = z.infer<typeof branchSchema>;

// ─── Row actions dropdown ────────────────────────────────────────────────────

function RowActions({
  branch,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  branch: Branch;
  onEdit: (b: Branch) => void;
  onToggleStatus: (b: Branch) => void;
  onDelete: (b: Branch) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(branch)}>
          <Pencil className="me-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggleStatus(branch)}>
          {branch.isActive ? (
            <><ToggleLeft className="me-2 h-4 w-4" />Deactivate</>
          ) : (
            <><ToggleRight className="me-2 h-4 w-4" />Activate</>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(branch)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="me-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Branch form (used in create + edit sheet) ───────────────────────────────

function BranchForm({
  defaultValues,
  onSubmit,
  isPending,
}: {
  defaultValues?: Partial<BranchFormValues>;
  onSubmit: (values: BranchFormValues) => void;
  isPending: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      currency: 'USD',
      timezone: 'UTC',
      ...defaultValues,
    },
  });

  return (
    <form id="branch-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="name">Branch Name *</Label>
          <Input id="name" {...register('name')} placeholder="Cairo HQ" />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="code">Branch Code *</Label>
          <Input id="code" {...register('code')} placeholder="CAI" className="uppercase" />
          {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" {...register('currency')} placeholder="USD" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">City *</Label>
          <Input id="city" {...register('city')} placeholder="Cairo" />
          {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Country *</Label>
          <Input id="country" {...register('country')} placeholder="Egypt" />
          {errors.country && <p className="text-xs text-destructive">{errors.country.message}</p>}
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="address">Address</Label>
          <Input id="address" {...register('address')} placeholder="123 Tahrir Square" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...register('phone')} placeholder="+20 2 1234 5678" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register('email')} placeholder="cairo@company.com" />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Input id="timezone" {...register('timezone')} placeholder="Africa/Cairo" />
        </div>
      </div>
    </form>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function BranchesClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Branch | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['branches', pagination],
    queryFn: () => branchesApi.list({ page: pagination.pageIndex + 1, limit: pagination.pageSize }),
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateBranchDto) => branchesApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setSheetOpen(false);
      toast({ title: 'Branch created', variant: 'default' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateBranchDto }) => branchesApi.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setSheetOpen(false);
      setEditTarget(null);
      toast({ title: 'Branch updated', variant: 'default' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => branchesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setDeleteTarget(null);
      toast({ title: 'Branch deleted', variant: 'default' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  function handleFormSubmit(values: BranchFormValues) {
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, dto: values });
    } else {
      createMutation.mutate(values);
    }
  }

  function handleEdit(branch: Branch) {
    setEditTarget(branch);
    setSheetOpen(true);
  }

  function handleToggleStatus(branch: Branch) {
    updateMutation.mutate({ id: branch.id, dto: { isActive: !branch.isActive } });
  }

  const columns: ColumnDef<Branch>[] = [
    {
      accessorKey: 'name',
      header: 'Branch',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.code}</p>
        </div>
      ),
    },
    {
      accessorKey: 'city',
      header: 'Location',
      cell: ({ row }) => (
        <span>{row.original.city}, {row.original.country}</span>
      ),
    },
    {
      accessorKey: 'currency',
      header: 'Currency',
    },
    {
      accessorKey: 'timezone',
      header: 'Timezone',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.timezone}</span>,
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'success' : 'secondary'}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      size: 60,
      cell: ({ row }) => (
        <RowActions
          branch={row.original}
          onEdit={handleEdit}
          onToggleStatus={handleToggleStatus}
          onDelete={setDeleteTarget}
        />
      ),
    },
  ];

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Branches</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your rental branch locations.
          </p>
        </div>
        <Button
          onClick={() => { setEditTarget(null); setSheetOpen(true); }}
          size="sm"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New Branch
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        totalCount={data?.total}
        pagination={pagination}
        onPaginationChange={setPagination}
        loading={isLoading}
        emptyMessage="No branches found."
        searchColumn="name"
        searchPlaceholder="Filter branches…"
      />

      {/* Create / Edit sheet */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditTarget(null);
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editTarget ? 'Edit Branch' : 'New Branch'}</SheetTitle>
            <SheetDescription>
              {editTarget ? 'Update branch information.' : 'Add a new branch location.'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <BranchForm
              defaultValues={editTarget ? {
                name: editTarget.name,
                code: editTarget.code,
                city: editTarget.city,
                country: editTarget.country,
                address: editTarget.address ?? undefined,
                phone: editTarget.phone ?? undefined,
                email: editTarget.email ?? undefined,
                currency: editTarget.currency,
                timezone: editTarget.timezone,
              } : undefined}
              onSubmit={handleFormSubmit}
              isPending={isPending}
            />
          </div>
          <SheetFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setSheetOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button form="branch-form" type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Branch'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Branch</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
