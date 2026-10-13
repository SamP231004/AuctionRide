'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useUpdateProfile } from '@/features/auth/api';
import { profileSchema, type ProfileInput } from '@/features/auth/schemas';
import { formatDateTime } from '@/lib/utils';
import { ApiError } from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';

export function ProfileForm() {
  const user = useAuthStore((s) => s.user)!;
  const update = useUpdateProfile();
  const form = useForm<ProfileInput>({ resolver: zodResolver(profileSchema), values: { name: user.name } });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
      toast.success('Profile updated');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not update profile');
    }
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>Your name is shown (partially masked) to other bidders.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid max-w-md gap-4" noValidate>
            <FormField id="name" label="Full name" error={form.formState.errors.name?.message}>
              <Input id="name" aria-describedby="name-message" aria-invalid={!!form.formState.errors.name} {...form.register('name')} />
            </FormField>
            <FormField id="email" label="Email" hint="Contact support to change your email.">
              <Input id="email" value={user.email} disabled aria-describedby="email-message" />
            </FormField>
            <Button type="submit" className="w-fit" loading={update.isPending} disabled={!form.formState.isDirty}>
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium capitalize">{user.role.toLowerCase()}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-muted-foreground">Member since</span>
            <span>{formatDateTime(user.createdAt)}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
