import type { Metadata } from 'next';
import { PaymentsClient } from './payments-client';

export const metadata: Metadata = { title: 'Payments' };

export default function Page() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Payments</h1>
      </div>
      <PaymentsClient />
    </div>
  );
}
