import { SiteHeader } from '@/components/shared/site-header';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} AuctionRide · All prices in INR · Times shown in your local time zone
      </footer>
    </div>
  );
}
