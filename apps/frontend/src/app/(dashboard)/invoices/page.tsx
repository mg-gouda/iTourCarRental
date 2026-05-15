import type { Metadata } from 'next';
import { InvoicesClient } from './invoices-client';

export const metadata: Metadata = { title: 'Invoices' };

export default function Page() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
      </div>
      <InvoicesClient />
    </div>
  );
}
