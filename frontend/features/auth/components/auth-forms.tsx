'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Loader2, Shield, Sparkles, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/services/api-client';
import type { User } from '@/types/api';
import { useLogin, useRegister } from '../api';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '../schemas';

/** Only same-origin relative paths are allowed as post-login redirects (no open redirects). */
function safeNext(next: string | null, user: User): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return user.role === 'ADMIN' ? '/admin' : '/dashboard';
}

/** Maps server-side field errors onto the form, falling back to a toast. */
function applyServerError<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>) {
  if (error instanceof ApiError) {
    const fields = Object.entries(error.fieldErrors);
    if (fields.length > 0) {
      for (const [path, message] of fields) setError(path as Path<T>, { message });
      return;
    }
    toast.error(error.message);
    return;
  }
  toast.error('Unable to reach the server. Check your connection and try again.');
}

/**
 * Seeded demo accounts, shown on the login page so reviewers can explore every role in one click.
 * Hide them in a real deployment with NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=false.
 */
const SHOW_DEMO_ACCOUNTS = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS !== 'false';

interface DemoAccount {
  label: string;
  description: string;
  email: string;
  password: string;
  icon: typeof Shield;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: 'Admin', description: 'Manage bikes & auctions', email: 'admin@auctionride.dev', password: 'Admin@12345', icon: Shield },
  { label: 'Aarav', description: 'Buyer', email: 'aarav@example.com', password: 'Buyer@12345', icon: UserRound },
  { label: 'Diya', description: 'Buyer · has a won auction', email: 'diya@example.com', password: 'Buyer@12345', icon: UserRound },
];

function DemoAccounts({ onSelect, pendingEmail }: { onSelect: (account: DemoAccount) => void; pendingEmail: string | null }) {
  return (
    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
        <Sparkles className="size-3.5" /> Demo accounts — sign in with one click
      </p>
      <div className="grid gap-1.5">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            disabled={pendingEmail !== null}
            onClick={() => onSelect(account)}
            className="group flex items-center gap-3 rounded-lg border bg-background/60 px-3 py-2 text-left transition hover:border-primary/40 hover:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary">
              {pendingEmail === account.email ? <Loader2 className="size-4 animate-spin" /> : <account.icon className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">
                {account.label} <span className="font-normal text-muted-foreground">· {account.description}</span>
              </span>
              <span className="block truncate font-mono text-xs text-muted-foreground">
                {account.email} / {account.password}
              </span>
            </span>
            <ArrowRight className="size-4 text-muted-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const login = useLogin();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const { errors } = form.formState;
  const [demoEmail, setDemoEmail] = useState<string | null>(null);

  const signIn = async (values: LoginInput) => {
    try {
      const session = await login.mutateAsync(values);
      toast.success(`Welcome back, ${session.user.name.split(' ')[0]}`);
      router.replace(safeNext(next, session.user));
    } catch (error) {
      applyServerError(error, form.setError);
    }
  };

  const onSubmit = form.handleSubmit(signIn);

  const signInAsDemo = async (account: DemoAccount) => {
    form.reset({ email: account.email, password: account.password });
    setDemoEmail(account.email);
    await signIn({ email: account.email, password: account.password });
    setDemoEmail(null);
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {SHOW_DEMO_ACCOUNTS && (
        <DemoAccounts onSelect={signInAsDemo} pendingEmail={login.isPending ? demoEmail : null} />
      )}
      <FormField id="email" label="Email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={!!errors.email} aria-describedby="email-message" {...form.register('email')} />
      </FormField>
      <FormField id="password" label="Password" error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} aria-describedby="password-message" {...form.register('password')} />
      </FormField>
      <Button type="submit" className="mt-2 w-full" loading={login.isPending}>
        Sign in
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New to AuctionRide?{' '}
        <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const register = useRegister();
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await register.mutateAsync(values);
      toast.success('Account created — happy bidding!');
      router.replace('/auctions/live');
    } catch (error) {
      applyServerError(error, form.setError);
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormField id="name" label="Full name" error={errors.name?.message}>
        <Input id="name" autoComplete="name" placeholder="Aarav Mehta" aria-invalid={!!errors.name} aria-describedby="name-message" {...form.register('name')} />
      </FormField>
      <FormField id="email" label="Email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={!!errors.email} aria-describedby="email-message" {...form.register('email')} />
      </FormField>
      <FormField id="password" label="Password" error={errors.password?.message} hint="At least 8 characters with a letter and a number.">
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} aria-describedby="password-message" {...form.register('password')} />
      </FormField>
      <Button type="submit" className="mt-2 w-full" loading={register.isPending}>
        Create account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
