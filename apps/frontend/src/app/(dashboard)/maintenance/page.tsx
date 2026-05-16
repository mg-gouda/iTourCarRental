import type { Metadata } from 'next';
import { MaintenanceClient } from './maintenance-client';

export const metadata: Metadata = { title: 'Maintenance' };

export default function Page() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Maintenance</h1>
      </div>
      <MaintenanceClient />
    </div>
  );
}
