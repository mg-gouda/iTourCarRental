import type { Metadata } from 'next';
import { PermissionsClient } from './permissions-client';

export const metadata: Metadata = { title: 'Permissions' };

export default function Page() {
  return <PermissionsClient />;
}
