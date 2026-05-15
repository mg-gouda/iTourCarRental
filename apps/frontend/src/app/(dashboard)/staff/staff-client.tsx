'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Plus, MoreHorizontal, Pencil, Trash2, KeyRound, ToggleLeft, ToggleRight } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usersApi, branchesApi, User, CreateUserDto } from '@/lib/api';
import { DataTable } from '@/components/ui/data-table/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Combobox } from '@/components/ui/combobox';
import { AsyncCombobox } from '@/components/ui/combobox/async-combobox';
import { lookupApi } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', description: 'Full system access' },
  { value: 'BRANCH_MANAGER', label: 'Branch Manager', description: 'Manages a branch' },
  { value: 'STAFF', label: 'Staff / Agent', description: 'Day-to-day operations' },
  { value: 'ACCOUNTANT', label: 'Accountant', description: 'Finance access' },
  { value: 'MECHANIC', label: 'Mechanic', description: 'Maintenance access' },
];

const ROLE_BADGE: Record<string, 'default' | 'secondary' | 'info' | 'warning' | 'success'> = {
  SUPER_ADMIN: 'warning',
  BRANCH_MANAGER: 'info',
  STAFF: 'default',
  ACCOUNTANT: 'success',
  MECHANIC: 'secondary',
};

const staffSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  role: z.string().min(1, 'Role is required'),
  branchId: z.string().optional(),
});

type StaffFormValues = z.infer<typeof staffSchema>;

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function RowActions({
  user,
  onEdit,
  onToggleStatus,
  onResetPassword,
  onDelete,
}: {
  user: User;
  onEdit: (u: User) => void;
  onToggleStatus: (u: User) => void;
  onResetPassword: (u: User) => void;
  onDelete: (u: User) => void;
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
        <DropdownMenuItem onClick={() => onEdit(user)}>
          <Pencil className="me-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggleStatus(user)}>
          {user.isActive ? (
            <><ToggleLeft className="me-2 h-4 w-4" />Deactivate</>
          ) : (
            <><ToggleRight className="me-2 h-4 w-4" />Activate</>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onResetPassword(user)}>
          <KeyRound className="me-2 h-4 w-4" />
          Reset Password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(user)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="me-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StaffForm({
  defaultValues,
  isEdit,
  onSubmit,
  isPending,
}: {
  defaultValues?: Partial<StaffFormValues & { branchLabel?: string }>;
  isEdit: boolean;
  onSubmit: (v: StaffFormValues) => void;
  isPending: boolean;
}) {
  const { register, handleSubmit, control, formState: { errors } } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: { role: '', branchId: '', password: '', ...defaultValues },
  });

  const fetchBranches = React.useCallback(
    (q: string) => lookupApi.branches(q),
    [],
  );

  return (
    <form id="staff-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full Name *</Label>
        <Input id="fullName" {...register('fullName')} placeholder="Jane Smith" />
        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email *</Label>
        <Input id="email" type="email" {...register('email')} placeholder="jane@company.com" readOnly={isEdit} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      {!isEdit && (
        <div className="space-y-1.5">
          <Label htmlFor="password">Password *</Label>
          <Input id="password" type="password" {...register('password')} placeholder="Min 8 characters" />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Role *</Label>
        <Controller
          name="role"
          control={control}
          render={({ field }) => (
            <Combobox
              options={ROLES}
              value={field.value}
              onValueChange={field.onChange}
              placeholder="Select role…"
            />
          )}
        />
        {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label>Branch Scope</Label>
        <Controller
          name="branchId"
          control={control}
          render={({ field }) => (
            <AsyncCombobox
              fetchOptions={fetchBranches}
              value={field.value ?? ''}
              displayValue={defaultValues?.branchLabel}
              onValueChange={(val) => field.onChange(val)}
              placeholder="All branches (Super Admin) or select one…"
            />
          )}
        />
        <p className="text-xs text-muted-foreground">Leave blank for Super Admin (all branches).</p>
      </div>
    </form>
  );
}

function ResetPasswordDialog({
  user,
  onClose,
  onConfirm,
  isPending,
}: {
  user: User;
  onClose: () => void;
  onConfirm: (password: string) => void;
  isPending: boolean;
}) {
  const [password, setPassword] = React.useState('');
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>Set a new password for <strong>{user.fullName}</strong>.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New Password</Label>
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={() => onConfirm(password)} disabled={isPending || password.length < 8}>
            {isPending ? 'Saving…' : 'Reset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StaffClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<User | null>(null);
  const [resetTarget, setResetTarget] = React.useState<User | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', pagination],
    queryFn: () => usersApi.list({ page: pagination.pageIndex + 1, limit: pagination.pageSize }),
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateUserDto) => usersApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSheetOpen(false);
      toast({ title: 'Staff member created' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Parameters<typeof usersApi.update>[1] }) =>
      usersApi.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSheetOpen(false);
      setEditTarget(null);
      toast({ title: 'Staff member updated' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteTarget(null);
      toast({ title: 'Staff member removed' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      usersApi.resetPassword(id, password),
    onSuccess: () => {
      setResetTarget(null);
      toast({ title: 'Password reset successfully' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  function handleFormSubmit(values: StaffFormValues) {
    if (editTarget) {
      updateMutation.mutate({
        id: editTarget.id,
        dto: {
          fullName: values.fullName,
          role: values.role,
          branchScope: values.branchId ? [values.branchId] : [],
        },
      });
    } else {
      createMutation.mutate({
        email: values.email,
        fullName: values.fullName,
        password: values.password!,
        role: values.role,
        branchScope: values.branchId ? [values.branchId] : [],
      });
    }
  }

  function handleToggleStatus(user: User) {
    updateMutation.mutate({ id: user.id, dto: { isActive: !user.isActive } });
  }

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'fullName',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={row.original.avatarUrl} />
            <AvatarFallback className="text-xs">{initials(row.original.fullName)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground">{row.original.fullName}</p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => (
        <Badge variant={ROLE_BADGE[row.original.role] ?? 'secondary'}>
          {ROLES.find((r) => r.value === row.original.role)?.label ?? row.original.role}
        </Badge>
      ),
    },
    {
      accessorKey: 'branchScope',
      header: 'Branch Scope',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.branchScope.length === 0 ? 'All branches' : `${row.original.branchScope.length} branch(es)`}
        </span>
      ),
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
      accessorKey: 'twoFactorEnabled',
      header: '2FA',
      cell: ({ row }) => (
        <Badge variant={row.original.twoFactorEnabled ? 'success' : 'outline'}>
          {row.original.twoFactorEnabled ? 'On' : 'Off'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      size: 60,
      cell: ({ row }) => (
        <RowActions
          user={row.original}
          onEdit={(u) => { setEditTarget(u); setSheetOpen(true); }}
          onToggleStatus={handleToggleStatus}
          onResetPassword={setResetTarget}
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
          <h1 className="text-2xl font-semibold text-foreground">Staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage system users and their roles.</p>
        </div>
        <Button onClick={() => { setEditTarget(null); setSheetOpen(true); }} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Staff
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        totalCount={data?.total}
        pagination={pagination}
        onPaginationChange={setPagination}
        loading={isLoading}
        emptyMessage="No staff members found."
        searchColumn="fullName"
        searchPlaceholder="Filter by name…"
      />

      <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) setEditTarget(null); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editTarget ? 'Edit Staff Member' : 'Add Staff Member'}</SheetTitle>
            <SheetDescription>
              {editTarget ? 'Update this user\'s details and role.' : 'Create a new admin user.'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <StaffForm
              defaultValues={editTarget ? {
                fullName: editTarget.fullName,
                email: editTarget.email,
                role: editTarget.role,
                branchId: editTarget.branchScope[0],
              } : undefined}
              isEdit={!!editTarget}
              onSubmit={handleFormSubmit}
              isPending={isPending}
            />
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={isPending}>Cancel</Button>
            <Button form="staff-form" type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : editTarget ? 'Save Changes' : 'Create'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Staff Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{deleteTarget?.fullName}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {resetTarget && (
        <ResetPasswordDialog
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onConfirm={(password) => resetPasswordMutation.mutate({ id: resetTarget.id, password })}
          isPending={resetPasswordMutation.isPending}
        />
      )}
    </div>
  );
}
