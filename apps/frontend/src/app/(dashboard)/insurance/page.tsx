import type { Metadata } from 'next';
import { InsuranceClient } from './insurance-client';

export const metadata: Metadata = { title: 'Insurance' };

export default function Page() {
  return <InsuranceClient />;
}
