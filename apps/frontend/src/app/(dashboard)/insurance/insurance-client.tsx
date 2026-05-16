'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { insuranceApi, InsurancePolicy, lookupApi } from '@/lib/api';
import { DataTable } from '@/components/ui/data-table/data-table';
import { AsyncCombobox } from '@/components/ui/combobox/async-combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/lib/hooks/use-toast';

// ── Status helpers ─────────────────────────────────────────────────────────────

function policyStatus(expiryAt: string): 'active' | 'expiring' | 'expired' {
  const now = Date.now();
  const expiry = new Date(expiryAt).getTime();
  if (expiry < now) return 'expired';
  if (expiry - now < 30 * 24 * 60 * 60 * 1000) return 'expiring';
  return 'active';
}

function StatusBadge({ expiryAt }: { expiryAt: string }) {
  const s = policyStatus(expiryAt);
  if (s === 'expired') return <Badge variant="destructive">Expired</Badge>;
  if (s === 'expiring') return <Badge variant="outline" className="border-warning text-warning">Expiring soon</Badge>;
  return <Badge variant="default" className="bg-success text-success-foreground">Active</Badge>;
}

// ── Form schema ────────────────────────────────────────────────────────────────

const policySchema = z.object({
  carId: z.string().min(1, 'Required'),
  provider: z.string().min(1, 'Required'),
  policyNumber: z.string().min(1, 'Required'),
  coverage: z.string().min(1, 'Required'),
  startAt: z.string().min(1, 'Required'),
  expiryAt: z.string().min(1, 'Required'),
  premium: z.string().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
});

type PolicyFormValues = z.infer<typeof policySchema>;

// ── Columns ────────────────────────────────────────────────────────────────────

function useColumns(onEdit: (p: InsurancePolicy) => void, onDelete: (p: InsurancePolicy) => void) {
  const columns: ColumnDef<InsurancePolicy>[] = [
    {
      accessorKey: 'car',
      header: 'Vehicle',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.car.make} {row.original.car.model}</div>
          <div className="text-xs text-muted-foreground">{row.original.car.licensePlate}</div>
        </div>
      ),
    },
    {
      accessorKey: 'provider',
      header: 'Provider',
    },
    {
      accessorKey: 'policyNumber',
      header: 'Policy #',
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: 'coverage',
      header: 'Coverage',
    },
    {
      accessorKey: 'startAt',
      header: 'Start',
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
    },
    {
      accessorKey: 'expiryAt',
      header: 'Expiry',
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge expiryAt={row.original.expiryAt} />,
    },
    {
      accessorKey: 'premium',
      header: 'Premium',
      cell: ({ row }) =>
        row.original.premium
          ? `${row.original.currency ?? ''} ${Number(row.original.premium).toLocaleString()}`
          : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      accessorKey: 'claims',
      header: 'Claims',
      cell: ({ row }) => {
        const claims = row.original.claims ?? [];
        return claims.length > 0 ? (
          <Badge variant="secondary">{claims.length}</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-1 justify-end">
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

// ── Main component ─────────────────────────────────────────────────────────────

export function InsuranceClient() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [carFilter, setCarFilter] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<InsurancePolicy | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InsurancePolicy | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['insurance-policies', carFilter],
    queryFn: () => insuranceApi.listAll(carFilter || undefined),
    placeholderData: (prev) => prev,
  });

  const form = useForm<PolicyFormValues>({ resolver: zodResolver(policySchema) });

  const createMutation = useMutation({
    mutationFn: (dto: PolicyFormValues) => insuranceApi.createPolicy({
      ...dto,
      premium: dto.premium || undefined,
      currency: dto.currency || undefined,
      notes: dto.notes || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-policies'] }); setSheetOpen(false); toast({ title: 'Policy created' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<PolicyFormValues> }) =>
      insuranceApi.updatePolicy(id, {
        provider: dto.provider,
        policyNumber: dto.policyNumber,
        coverage: dto.coverage,
        startAt: dto.startAt,
        expiryAt: dto.expiryAt,
        premium: dto.premium || undefined,
        currency: dto.currency || undefined,
        notes: dto.notes || undefined,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-policies'] }); setSheetOpen(false); toast({ title: 'Policy updated' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => insuranceApi.deletePolicy(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-policies'] }); setDeleteTarget(null); toast({ title: 'Policy removed' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  function openCreate() {
    setEditPolicy(null);
    form.reset({ currency: 'USD' });
    setSheetOpen(true);
  }

  function openEdit(policy: InsurancePolicy) {
    setEditPolicy(policy);
    form.reset({
      carId: policy.carId,
      provider: policy.provider,
      policyNumber: policy.policyNumber,
      coverage: policy.coverage,
      startAt: policy.startAt.split('T')[0],
      expiryAt: policy.expiryAt.split('T')[0],
      premium: policy.premium ?? '',
      currency: policy.currency ?? 'USD',
      notes: policy.notes ?? '',
    });
    setSheetOpen(true);
  }

  function onSubmit(values: PolicyFormValues) {
    if (editPolicy) {
      updateMutation.mutate({ id: editPolicy.id, dto: values });
    } else {
      createMutation.mutate(values);
    }
  }

  const columns = useColumns(openEdit, (p) => setDeleteTarget(p));

  // Summary stats
  const now = Date.now();
  const active = data.filter((p) => policyStatus(p.expiryAt) === 'active').length;
  const expiring = data.filter((p) => policyStatus(p.expiryAt) === 'expiring').length;
  const expired = data.filter((p) => policyStatus(p.expiryAt) === 'expired').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Insurance</h1>
          <p className="text-sm text-muted-foreground">Fleet insurance policies and claims</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add Policy
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active', value: active, color: 'text-success' },
          { label: 'Expiring (30d)', value: expiring, color: 'text-warning' },
          { label: 'Expired', value: expired, color: 'text-destructive' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border bg-card p-4 flex items-center gap-3">
            <ShieldCheck className={`h-5 w-5 ${color}`} />
            <div>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Car filter */}
      <div className="flex items-center gap-2 max-w-sm">
        <AsyncCombobox
          value={carFilter}
          onValueChange={(v) => setCarFilter(v)}
          fetchOptions={async (q) => {
            const res = await lookupApi.cars(q);
            return res.map((c) => ({ value: c.id, label: `${c.make} ${c.model}`, description: c.licensePlate }));
          }}
          placeholder="Filter by vehicle…"
        />
        {carFilter && (
          <Button variant="ghost" size="sm" onClick={() => setCarFilter('')}>Clear</Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={isLoading}
        totalCount={data.length}
        emptyMessage="No insurance policies found"
      />

      {/* Create / Edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[460px] sm:max-w-[460px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editPolicy ? 'Edit Policy' : 'Add Policy'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Vehicle *</Label>
              <Controller
                control={form.control}
                name="carId"
                render={({ field }) => (
                  <AsyncCombobox
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    fetchOptions={async (q) => {
                      const res = await lookupApi.cars(q);
                      return res.map((c) => ({ value: c.id, label: `${c.make} ${c.model}`, description: c.licensePlate }));
                    }}
                    placeholder="Search vehicle…"
                    disabled={!!editPolicy}
                  />
                )}
              />
              {form.formState.errors.carId && <p className="text-xs text-destructive">{form.formState.errors.carId.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Provider *</Label>
                <Input {...form.register('provider')} placeholder="e.g. AXA" />
                {form.formState.errors.provider && <p className="text-xs text-destructive">{form.formState.errors.provider.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Policy Number *</Label>
                <Input {...form.register('policyNumber')} placeholder="POL-2024-001" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Coverage *</Label>
              <Input {...form.register('coverage')} placeholder="e.g. Comprehensive" />
              {form.formState.errors.coverage && <p className="text-xs text-destructive">{form.formState.errors.coverage.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start Date *</Label>
                <Input {...form.register('startAt')} type="date" />
              </div>
              <div className="space-y-1">
                <Label>Expiry Date *</Label>
                <Input {...form.register('expiryAt')} type="date" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Annual Premium</Label>
                <Input {...form.register('premium')} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Input {...form.register('currency')} placeholder="USD" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <textarea
                {...form.register('notes')}
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[72px] bg-background"
                placeholder="Internal notes…"
              />
            </div>

            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editPolicy ? 'Save Changes' : 'Add Policy'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove Policy</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove policy <strong>{deleteTarget?.policyNumber}</strong> ({deleteTarget?.provider}) from{' '}
            <strong>{deleteTarget?.car.make} {deleteTarget?.car.model}</strong>? This soft-deletes the record.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
