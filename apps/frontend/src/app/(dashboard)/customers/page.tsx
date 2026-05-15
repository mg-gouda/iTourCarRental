import type { Metadata } from 'next';
import { CustomersClient } from './customers-client';

export const metadata: Metadata = { title: 'Customers' };

export default function Page() {
  return <CustomersClient />;
}
