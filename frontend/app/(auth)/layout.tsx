import { Logo } from '@/components/shared/site-header';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-glow" />
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <Logo className="relative mb-8 text-lg" />
      <div className="relative w-full max-w-sm rounded-2xl border bg-card/80 p-6 shadow-2xl shadow-black/10 backdrop-blur sm:p-8">
        {children}
      </div>
    </div>
  );
}
