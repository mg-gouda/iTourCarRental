'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Plus, Ban, Eye, FilePlus, ChevronRight, Receipt } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';

import {
  invoicesApi, lookupApi,
  Invoice, CreditNote,
} from '@/lib/api';
import { DataTable } from '@/components/ui/data-table/data-table';
import { AsyncCombobox } from '@/components/ui/combobox/async-combobox';
import { Combobox } from '@/components/ui/combobox/combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/lib/hooks/use-toast';

// ─── Status helpers ───────────────────────────────────────────────────────────

function InvoiceStatusBadge({ invoice }: { invoice: Invoice }) {
  if (invoice.voidedAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-destructive bg-destructive/10 border-destructive/30">
        <Ban className="h-3 w-3" /> Voided
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800">
      Active
    </span>
  );
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const generateSchema = z.object({
  bookingId: z.string().min(1, 'Booking is required'),
  language: z.enum(['en', 'ar'] as const).default('en'),
});

const creditNoteSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valid amount required'),
  reason: z.string().min(1, 'Reason is required'),
  language: z.enum(['en', 'ar'] as const).default('en'),
});

type GenerateForm = z.infer<typeof generateSchema>;
type CreditNoteForm = z.infer<typeof creditNoteSchema>;

// ─── Invoice Detail Panel ─────────────────────────────────────────────────────

function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const lineItems = invoice.lineItems as Array<{
    description?: string;
    quantity?: number;
    unitPrice?: number;
    total?: number;
    currency?: string;
  }>;
  const taxLines = invoice.taxLines as Array<{
    label?: string;
    rate?: number;
    amount?: number;
    currency?: string;
  }>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <span className="text-muted-foreground">Invoice #</span>
          <p className="font-mono font-medium">{invoice.invoiceNumber}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Kind</span>
          <p className="capitalize">{invoice.kind}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Booking</span>
          <p>{invoice.booking?.bookingNumber ?? '—'}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Customer</span>
          <p>{invoice.booking?.customer?.fullName ?? '—'}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Issued</span>
          <p>{invoice.issuedAt ? format(parseISO(invoice.issuedAt), 'dd MMM yyyy') : '—'}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Currency</span>
          <p>{invoice.currency}</p>
        </div>
      </div>

      <Separator />

      {lineItems.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3">Line Items</h4>
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Unit</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2">{item.description ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{item.quantity ?? 1}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {invoice.currency} {(item.unitPrice ?? 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {invoice.currency} {(item.total ?? 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {taxLines.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Tax</h4>
          <div className="space-y-1">
            {taxLines.map((t, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t.label ?? 'Tax'} {t.rate ? `(${(t.rate * 100).toFixed(0)}%)` : ''}
                </span>
                <span className="font-mono">
                  {invoice.currency} {(t.amount ?? 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator />

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-mono">{invoice.currency} {parseFloat(invoice.subtotal).toFixed(2)}</span>
        </div>
        {parseFloat(invoice.discountTotal) > 0 && (
          <div className="flex justify-between text-green-700 dark:text-green-400">
            <span>Discount</span>
            <span className="font-mono">− {invoice.currency} {parseFloat(invoice.discountTotal).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tax</span>
          <span className="font-mono">{invoice.currency} {parseFloat(invoice.taxTotal).toFixed(2)}</span>
        </div>
        <Separator />
        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span className="font-mono">{invoice.currency} {parseFloat(invoice.total).toFixed(2)}</span>
        </div>
      </div>

      {invoice.creditNotes.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-2">Credit Notes</h4>
            <div className="space-y-2">
              {invoice.creditNotes.map((cn) => (
                <div key={cn.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <div>
                    <span className="font-mono text-xs">{cn.creditNoteNumber}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{cn.reason}</p>
                  </div>
                  <span className="font-mono font-medium text-green-700 dark:text-green-400">
                    − {cn.currency} {parseFloat(cn.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Columns ──────────────────────────────────────────────────────────────────

const columns: ColumnDef<Invoice>[] = [
  {
    accessorKey: 'invoiceNumber',
    header: 'Invoice #',
    cell: ({ row }) => (
      <span className="font-mono text-sm font-medium">{row.original.invoiceNumber}</span>
    ),
  },
  {
    accessorKey: 'booking',
    header: 'Booking',
    cell: ({ row }) => {
      const b = row.original.booking;
      return (
        <div>
          <div className="font-medium text-sm">{b?.bookingNumber ?? '—'}</div>
          <div className="text-xs text-muted-foreground">{b?.customer?.fullName ?? '—'}</div>
        </div>
      );
    },
  },
  {
    accessorKey: 'kind',
    header: 'Kind',
    cell: ({ row }) => (
      <span className="text-sm capitalize">{row.original.kind}</span>
    ),
  },
  {
    accessorKey: 'total',
    header: 'Total',
    cell: ({ row }) => (
      <span className="font-mono text-sm font-medium">
        {row.original.currency} {parseFloat(row.original.total).toFixed(2)}
      </span>
    ),
  },
  {
    accessorKey: 'issuedAt',
    header: 'Issued',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.issuedAt ? format(parseISO(row.original.issuedAt), 'dd MMM yyyy') : '—'}
      </span>
    ),
  },
  {
    accessorKey: 'creditNotes',
    header: 'Credits',
    cell: ({ row }) => {
      const count = row.original.creditNotes?.length ?? 0;
      return count > 0 ? (
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {count} CN
        </span>
      ) : null;
    },
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => <InvoiceStatusBadge invoice={row.original} />,
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function InvoicesClient() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [kindFilter, setKindFilter] = useState<string>('');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [voidTarget, setVoidTarget] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [creditNoteTarget, setCreditNoteTarget] = useState<Invoice | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', pagination, kindFilter],
    queryFn: () =>
      invoicesApi.list({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        kind: kindFilter || undefined,
      }),
  });

  const { mutate: generate, isPending: generating } = useMutation({
    mutationFn: (dto: GenerateForm) => invoicesApi.generate(dto.bookingId, dto.language),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setGenerateOpen(false);
      genForm.reset();
      toast({ title: 'Invoice generated' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const { mutate: voidInvoice, isPending: voiding } = useMutation({
    mutationFn: () => invoicesApi.void(voidTarget!.id, voidReason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setVoidTarget(null);
      setVoidReason('');
      toast({ title: 'Invoice voided' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const { mutate: issueCN, isPending: issuingCN } = useMutation({
    mutationFn: (dto: CreditNoteForm) =>
      invoicesApi.issueCreditNote(creditNoteTarget!.id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setCreditNoteTarget(null);
      cnForm.reset();
      toast({ title: 'Credit note issued' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const genForm = useForm<GenerateForm>({
    resolver: zodResolver(generateSchema),
    defaultValues: { language: 'en' },
  });

  const cnForm = useForm<CreditNoteForm>({
    resolver: zodResolver(creditNoteSchema),
    defaultValues: { language: 'en' },
  });

  const fetchBookings = useCallback(async (q: string) => {
    const res = await lookupApi.bookings(q);
    return res.map((b) => ({ value: b.id, label: b.bookingNumber, description: b.customer.fullName }));
  }, []);

  const kindOptions = [
    { value: '', label: 'All Kinds' },
    { value: 'rental', label: 'Rental' },
    { value: 'addendum', label: 'Addendum' },
  ];

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'ar', label: 'Arabic' },
  ];

  const columnsWithActions: ColumnDef<Invoice>[] = [
    ...columns,
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const inv = row.original;
        return (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setDetailInvoice(inv)}>
              <Eye className="h-4 w-4" />
            </Button>
            {!inv.voidedAt && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setCreditNoteTarget(inv)}>
                  <FilePlus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setVoidTarget(inv)}
                >
                  <Ban className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        columns={columnsWithActions}
        data={data?.items ?? []}
        totalCount={data?.total}
        pagination={pagination}
        onPaginationChange={setPagination}
        loading={isLoading}
        emptyMessage="No invoices found."
        toolbar={
          <div className="flex items-center gap-2">
            <Combobox
              options={kindOptions}
              value={kindFilter}
              onValueChange={setKindFilter}
              placeholder="Filter by kind"
              className="w-44"
            />
            <Button size="sm" onClick={() => setGenerateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Generate Invoice
            </Button>
          </div>
        }
      />

      {/* Generate invoice sheet */}
      <Sheet open={generateOpen} onOpenChange={setGenerateOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Generate Invoice</SheetTitle>
          </SheetHeader>

          <form
            className="mt-6 space-y-5"
            onSubmit={genForm.handleSubmit((d) => generate(d))}
          >
            <div className="space-y-2">
              <Label>Booking <span className="text-destructive">*</span></Label>
              <AsyncCombobox
                fetchOptions={fetchBookings}
                value={genForm.watch('bookingId')}
                onValueChange={(v) => genForm.setValue('bookingId', v)}
                placeholder="Search booking…"
              />
              {genForm.formState.errors.bookingId && (
                <p className="text-xs text-destructive">{genForm.formState.errors.bookingId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Language</Label>
              <Combobox
                options={languageOptions}
                value={genForm.watch('language')}
                onValueChange={(v) => genForm.setValue('language', v as 'en' | 'ar')}
                placeholder="Language"
              />
            </div>

            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setGenerateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={generating}>
                <Receipt className="h-4 w-4 mr-1" />
                {generating ? 'Generating…' : 'Generate'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Invoice detail sheet */}
      <Sheet open={!!detailInvoice} onOpenChange={(o) => { if (!o) setDetailInvoice(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-mono">{detailInvoice?.invoiceNumber}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {detailInvoice && <InvoiceDetail invoice={detailInvoice} />}
          </div>
        </SheetContent>
      </Sheet>

      {/* Void confirm dialog */}
      <Dialog open={!!voidTarget} onOpenChange={(o) => { if (!o) { setVoidTarget(null); setVoidReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Void invoice <strong>{voidTarget?.invoiceNumber}</strong>? This cannot be undone.
            </p>
            <div className="space-y-2">
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Input
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Reason for voiding…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVoidTarget(null); setVoidReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!voidReason.trim() || voiding}
              onClick={() => voidInvoice()}
            >
              {voiding ? 'Voiding…' : 'Void Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit note sheet */}
      <Sheet open={!!creditNoteTarget} onOpenChange={(o) => { if (!o) { setCreditNoteTarget(null); cnForm.reset(); } }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Issue Credit Note</SheetTitle>
          </SheetHeader>
          <p className="text-sm text-muted-foreground mt-2">
            Against invoice <strong>{creditNoteTarget?.invoiceNumber}</strong>
          </p>

          <form
            className="mt-6 space-y-5"
            onSubmit={cnForm.handleSubmit((d) => issueCN(d))}
          >
            <div className="space-y-2">
              <Label>Amount <span className="text-destructive">*</span></Label>
              <Input
                {...cnForm.register('amount')}
                placeholder="0.00"
                className="font-mono"
              />
              {cnForm.formState.errors.amount && (
                <p className="text-xs text-destructive">{cnForm.formState.errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Input {...cnForm.register('reason')} placeholder="Reason for credit note…" />
              {cnForm.formState.errors.reason && (
                <p className="text-xs text-destructive">{cnForm.formState.errors.reason.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Language</Label>
              <Combobox
                options={languageOptions}
                value={cnForm.watch('language')}
                onValueChange={(v) => cnForm.setValue('language', v as 'en' | 'ar')}
                placeholder="Language"
              />
            </div>

            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => { setCreditNoteTarget(null); cnForm.reset(); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={issuingCN}>
                {issuingCN ? 'Issuing…' : 'Issue Credit Note'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
