import type { Metadata } from 'next';
import { CarsClient } from './cars-client';

export const metadata: Metadata = { title: 'Fleet' };

export default function Page() {
  return <CarsClient />;
}
