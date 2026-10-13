import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-elements';
import { RequireAuth } from '@/features/auth/components/require-auth';
import { ProfileForm } from '@/features/me/components/profile-form';

export const metadata: Metadata = { title: 'Profile' };

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <RequireAuth>
        <PageHeader title="Profile" />
        <ProfileForm />
      </RequireAuth>
    </div>
  );
}
