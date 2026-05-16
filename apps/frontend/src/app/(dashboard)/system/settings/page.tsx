import type { Metadata } from 'next';
import { SettingsClient } from './settings-client';

export const metadata: Metadata = { title: 'Settings' };

export default function Page() {
  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
      <SettingsClient />
    </div>
  );
}
