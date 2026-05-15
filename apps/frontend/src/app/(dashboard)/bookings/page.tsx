import type { Metadata } from 'next';
import BookingsClient from './bookings-client';

export const metadata: Metadata = { title: 'Bookings' };

export default function Page() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Bookings</h1>
      </div>
      <BookingsClient />
    </div>
  );
}
