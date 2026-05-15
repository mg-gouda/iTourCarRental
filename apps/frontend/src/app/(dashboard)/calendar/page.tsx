import type { Metadata } from 'next';
import CalendarClient from './calendar-client';

export const metadata: Metadata = { title: 'Calendar' };

export default function Page() {
  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-semibold text-foreground">Booking Calendar</h1>
      <CalendarClient />
    </div>
  );
}
