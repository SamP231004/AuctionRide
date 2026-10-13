import type { Metadata } from 'next';
import { RegisterForm } from '@/features/auth/components/auth-forms';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Join in seconds and start bidding on live auctions.</p>
      <RegisterForm />
    </>
  );
}
