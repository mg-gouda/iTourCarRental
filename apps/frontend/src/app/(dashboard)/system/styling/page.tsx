import type { Metadata } from 'next';
import { StylingClient } from './styling-client';

export const metadata: Metadata = { title: 'Styling & Branding' };

export default function Page() {
  return <StylingClient />;
}
