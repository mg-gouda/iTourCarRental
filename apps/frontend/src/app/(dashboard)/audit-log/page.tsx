import type { Metadata } from 'next';
import { AuditLogClient } from './audit-log-client';

export const metadata: Metadata = { title: 'Audit Log' };

export default function Page() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every mutating action recorded automatically.</p>
      </div>
      <AuditLogClient />
    </div>
  );
}
