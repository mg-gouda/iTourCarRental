import type { Metadata } from 'next';
import { CorporateAccountsClient } from './corporate-accounts-client';

export const metadata: Metadata = { title: 'Corporate Accounts' };

export default function Page() {
  return <CorporateAccountsClient />;
}
