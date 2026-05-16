import type { Metadata } from 'next';
import { PartsClient } from './parts-client';

export const metadata: Metadata = { title: 'Parts Inventory' };

export default function Page() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Parts Inventory</h1>
      </div>
      <PartsClient />
    </div>
  );
}
