'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const login = useLogin();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const session = await login.mutateAsync(values);
      toast.success(`Welcome back, ${session.user.name.split(' ')[0]}`);
      router.replace(safeNext(next, session.user));
    } catch (error) {
      applyServerError(error, form.setError);
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
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
