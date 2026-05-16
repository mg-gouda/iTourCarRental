import type { Metadata } from 'next';
import { VendorsClient } from './vendors-client';

export const metadata: Metadata = { title: 'Maintenance Vendors' };

export default function Page() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Maintenance Vendors</h1>
      </div>
      <VendorsClient />
    </div>
  );
}
