import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AppProviders } from '@/providers/app-providers';
import '@/styles/globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'AuctionRide — Live motorcycle auctions', template: '%s · AuctionRide' },
  description: 'Bid in real time on verified pre-owned motorcycles across India. Transparent pricing, live bidding, no haggling.',
  applicationName: 'AuctionRide',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#121216' },
    { media: '(prefers-color-scheme: light)', color: '#fbfbfc' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // next-themes sets the class on <html> before hydration.
    <html lang="en-IN" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-dvh font-sans`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
