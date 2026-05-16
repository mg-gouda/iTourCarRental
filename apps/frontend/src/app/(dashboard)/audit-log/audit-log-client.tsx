'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { auditLogApi, AuditLogEntry } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ─── Action badge colour ──────────────────────────────────────────────────────

function actionVariant(action: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const a = action.toLowerCase();
  if (a.includes('delete') || a.includes('void') || a.includes('revoke')) return 'destructive';
  if (a.includes('create') || a.includes('generate') || a.includes('import')) return 'default';
  if (a.includes('update') || a.includes('patch') || a.includes('complete')) return 'secondary';
  return 'outline';
}

// ─── Diff viewer ─────────────────────────────────────────────────────────────

function DiffRow({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false);
  const hasDiff = entry.before !== null || entry.after !== null;

  return (
    <>
      <tr
        className="border-b border-border hover:bg-muted/20 transition-colors cursor-pointer"
        onClick={() => hasDiff && setOpen((v) => !v)}
      >
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
          {format(parseISO(entry.occurredAt), 'dd MMM yyyy HH:mm:ss')}
        </td>
        <td className="px-4 py-3 text-xs">
          {entry.actor ? (
            <div>
              <p className="font-medium text-foreground">{entry.actor.fullName}</p>
              <p className="text-muted-foreground">{entry.actor.email}</p>
            </div>
          ) : (
            <span className="text-muted-foreground">System</span>
          )}
        </td>
        <td className="px-4 py-3">
          <Badge variant={actionVariant(entry.action)} className="font-mono text-[10px]">
            {entry.action}
          </Badge>
        </td>
        <td className="px-4 py-3 text-xs">
          <span className="font-medium text-foreground">{entry.entityType}</span>
          {entry.entityId && (
            <span className="ml-1 font-mono text-muted-foreground text-[10px]">
              {entry.entityId.slice(0, 8)}…
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">{entry.ip ?? '—'}</td>
        <td className="px-4 py-3 text-xs text-right">
          {hasDiff && (
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </td>
      </tr>
      {open && hasDiff && (
        <tr className="border-b border-border bg-muted/10">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <p className="text-muted-foreground mb-1 font-sans font-medium">Before</p>
                <pre className="rounded bg-muted p-2 overflow-auto max-h-48 text-[10px] leading-relaxed">
                  {entry.before !== null ? JSON.stringify(entry.before, null, 2) : 'null'}
                </pre>
              </div>
              <div>
                <p className="text-muted-foreground mb-1 font-sans font-medium">After</p>
                <pre className="rounded bg-muted p-2 overflow-auto max-h-48 text-[10px] leading-relaxed">
                  {entry.after !== null ? JSON.stringify(entry.after, null, 2) : 'null'}
                </pre>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AuditLogClient() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', page, action, entityType, from, to],
    queryFn: () =>
      auditLogApi.list({
        page,
        limit,
        action: action || undefined,
        entityType: entityType || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  function reset() {
    setPage(1);
    setAction('');
    setEntityType('');
    setFrom('');
    setTo('');
  }

  const hasFilters = action || entityType || from || to;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter by action…"
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            className="pl-8 h-8 text-xs w-44"
          />
        </div>
        <Input
          placeholder="Entity type…"
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
          className="h-8 text-xs w-36"
        />
        <Input
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(1); }}
          className="h-8 text-xs w-36"
          title="From date"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(1); }}
          className="h-8 text-xs w-36"
          title="To date"
        />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={reset} className="h-8 text-xs text-muted-foreground">
            Clear
          </Button>
        )}
        {data && (
          <span className="ml-auto text-xs text-muted-foreground">
            {data.total.toLocaleString()} entries
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">Time</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Actor</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Action</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Entity</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">IP</th>
              <th className="px-4 py-2.5 w-8" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!data?.items.length) && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  No audit entries found.
                </td>
              </tr>
            )}
            {data?.items.map((entry) => (
              <DiffRow key={entry.id} entry={entry} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
