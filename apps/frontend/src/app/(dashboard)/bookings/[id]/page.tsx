import type { Metadata } from 'next';
import { BookingDetailClient } from './booking-detail-client';

export const metadata: Metadata = { title: 'Booking Detail' };

export default function Page({ params }: { params: { id: string } }) {
  return <BookingDetailClient id={params.id} />;
}
