import type { Metadata } from 'next';
import { ReportsClient } from './reports-client';

export const metadata: Metadata = { title: 'Reports' };

export default function Page() {
  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
      <ReportsClient />
    </div>
  );
}
