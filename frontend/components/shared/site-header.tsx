'use client';

import { Bell, Gavel, LayoutDashboard, LogOut, Menu, Shield, User as UserIcon, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useLogout } from '@/features/auth/api';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/features/me/api';
import { cn, formatRelative, initials } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useUiStore } from '@/store/ui-store';
import { ThemeToggle } from './theme-toggle';

const NAV = [
  { href: '/auctions/live', label: 'Live' },
  { href: '/auctions/upcoming', label: 'Upcoming' },
  { href: '/auctions', label: 'All auctions' },
];

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/30">
        <Gavel className="size-4" />
      </span>
      AuctionRide
    </Link>
  );
}

function NotificationBell() {
  const { data } = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();
  const router = useRouter();
  const unread = data?.unreadCount ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Bell />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <button className="text-xs text-primary hover:underline" onClick={() => markAll.mutate()}>
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-96 overflow-y-auto">
          {!data?.items.length && <p className="px-2 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>}
          {data?.items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex-col items-start gap-0.5 py-2"
              onSelect={() => {
                if (!n.readAt) markOne.mutate(n.id);
                if (n.auctionId) router.push(`/auctions/${n.auctionId}`);
              }}
            >
              <span className="flex w-full items-center gap-2 text-sm font-medium">
                {!n.readAt && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                {n.title}
              </span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
              <span className="text-[11px] text-muted-foreground/70">{formatRelative(n.createdAt)}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const user = useAuthStore((s) => s.user)!;
  const logout = useLogout();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-xs font-semibold text-primary-foreground ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none" aria-label="Account menu">
          {initials(user.name)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <p className="font-medium">{user.name}</p>
          <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.role === 'ADMIN' ? (
          <DropdownMenuItem onSelect={() => router.push('/admin')}>
            <Shield /> Admin console
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => router.push('/dashboard')}>
            <LayoutDashboard /> Dashboard
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => router.push('/profile')}>
          <UserIcon /> Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await logout.mutateAsync();
            router.push('/');
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const status = useAuthStore((s) => s.status);
  const { mobileNavOpen, setMobileNavOpen } = useUiStore();

  useEffect(() => setMobileNavOpen(false), [pathname, setMobileNavOpen]);

  const isActive = (href: string) => (href === '/auctions' ? pathname === '/auctions' : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                isActive(item.href) ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {status === 'loading' && <Skeleton className="size-8 rounded-full" />}
          {status === 'authenticated' && (
            <>
              <NotificationBell />
              <UserMenu />
            </>
          )}
          {status === 'unauthenticated' && (
            <div className="hidden items-center gap-2 sm:flex">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Get started</Link>
              </Button>
            </div>
          )}
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(!mobileNavOpen)}>
            {mobileNavOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {mobileNavOpen && (
        <nav className="border-t px-4 py-3 md:hidden" aria-label="Mobile">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="block rounded-md px-3 py-2 text-sm hover:bg-accent">
              {item.label}
            </Link>
          ))}
          {status === 'unauthenticated' && (
            <Link href="/login" className="block rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-accent">
              Sign in
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
