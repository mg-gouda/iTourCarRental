import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Parts Inventory' };

export default function Page() {
  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-semibold text-foreground">Parts Inventory</h1>
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
        This section is under construction — coming in Phase 1 implementation.
      </div>
    </div>
  );
}
