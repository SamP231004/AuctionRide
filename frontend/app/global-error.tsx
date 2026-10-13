'use client';

/** Last-resort boundary for errors in the root layout itself (renders its own <html>). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#121216', color: '#eee' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 20 }}>AuctionRide is temporarily unavailable</h1>
          <p style={{ opacity: 0.7 }}>Please try again in a moment.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: 0, background: '#f97316', color: '#111', cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
