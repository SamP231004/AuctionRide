'use client';

import { Activity, Gavel, IndianRupee, Percent } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { StatCard } from '@/components/shared/page-elements';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatINR, formatINRCompact, formatNumber } from '@/lib/utils';
import { useAdminAnalytics } from '../api';

const axisProps = {
  stroke: 'var(--muted-foreground)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const formatDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function ChartTooltip({ active, payload, label, format }: { active?: boolean; payload?: { value: number }[]; label?: string; format: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{label ? formatDay(label) : ''}</p>
      <p className="mt-0.5 font-semibold tabular">{format(payload[0]!.value)}</p>
    </div>
  );
}

export function Analytics() {
  const [days, setDays] = useState(30);
  const { data, isPending } = useAdminAnalytics(days);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Analytics</h2>
        <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <TabsList>
            <TabsTrigger value="7">7 days</TabsTrigger>
            <TabsTrigger value="30">30 days</TabsTrigger>
            <TabsTrigger value="90">90 days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isPending || !data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Gross sales value" value={formatINRCompact(data.totals.grossValue)} icon={IndianRupee} hint="All-time, sold auctions" />
            <StatCard label="Sell-through rate" value={`${Math.round(data.totals.sellThroughRate * 100)}%`} icon={Percent} hint={`${data.outcomes.sold} sold · ${data.outcomes.reserveNotMet} reserve not met · ${data.outcomes.noBids} no bids`} />
            <StatCard label="Avg. sale price" value={formatINRCompact(data.totals.averageSalePrice)} icon={Gavel} />
            <StatCard label="Avg. bids / auction" value={data.totals.averageBidsPerAuction} icon={Activity} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bids per day</CardTitle>
                <CardDescription>{formatNumber(data.bidsPerDay.reduce((sum, d) => sum + d.bids, 0))} bids in the last {days} days</CardDescription>
              </CardHeader>
              <CardContent className="h-60">
                {data.bidsPerDay.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No bids in this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.bidsPerDay} margin={{ left: -20, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="bidsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="day" tickFormatter={formatDay} {...axisProps} minTickGap={24} />
                      <YAxis allowDecimals={false} {...axisProps} />
                      <Tooltip cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: 3 }} content={<ChartTooltip format={(v) => `${v} bids`} />} />
                      <Area type="monotone" dataKey="bids" stroke="var(--chart-1)" strokeWidth={2} fill="url(#bidsFill)" activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sales value per day</CardTitle>
                <CardDescription>Winning bids of sold auctions</CardDescription>
              </CardHeader>
              <CardContent className="h-60">
                {data.salesPerDay.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No sales in this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.salesPerDay} margin={{ left: -4, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="day" tickFormatter={formatDay} {...axisProps} minTickGap={24} />
                      <YAxis tickFormatter={(v: number) => formatINRCompact(v)} {...axisProps} />
                      <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<ChartTooltip format={formatINR} />} />
                      <Bar dataKey="revenue" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {data.topAuctions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Most contested auctions</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="pb-2 font-medium">Bike</th>
                      <th className="pb-2 text-right font-medium">Bids</th>
                      <th className="pb-2 text-right font-medium">Top bid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topAuctions.map((a) => (
                      <tr key={a.id} className="border-t">
                        <td className="py-2">
                          <Link href={`/admin/auctions/${a.id}`} className="hover:underline">
                            {a.title}
                          </Link>
                        </td>
                        <td className="py-2 text-right tabular">{a.bidCount}</td>
                        <td className="py-2 text-right tabular">{a.currentPrice ? formatINR(a.currentPrice) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
