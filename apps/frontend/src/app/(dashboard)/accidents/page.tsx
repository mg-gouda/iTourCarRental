import type { Metadata } from 'next';
import { AccidentsClient } from './accidents-client';

export const metadata: Metadata = { title: 'Accidents' };

export default function Page() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Accidents</h1>
      </div>
      <AccidentsClient />
    </div>
  );
}
