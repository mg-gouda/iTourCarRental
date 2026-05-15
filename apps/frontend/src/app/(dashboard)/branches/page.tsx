import type { Metadata } from 'next';
import { BranchesClient } from './branches-client';

export const metadata: Metadata = { title: 'Branches' };

export default function Page() {
  return <BranchesClient />;
}
