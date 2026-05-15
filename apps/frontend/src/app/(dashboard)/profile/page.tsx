import type { Metadata } from 'next';
import { ProfileClient } from './profile-client';

export const metadata: Metadata = { title: 'Profile' };

export default function Page() {
  return <ProfileClient />;
}
