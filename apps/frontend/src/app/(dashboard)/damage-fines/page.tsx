import type { Metadata } from 'next';
import { DamageFinesClient } from './damage-fines-client';

export const metadata: Metadata = { title: 'Damage & Fines' };

export default function Page() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Damage & Fines</h1>
      </div>
      <DamageFinesClient />
    </div>
  );
}
