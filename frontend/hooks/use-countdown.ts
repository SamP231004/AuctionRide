import { useEffect, useState } from 'react';
import { serverNow } from '@/lib/server-time';

export interface Countdown {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isOver: boolean;
}

function compute(targetIso: string): Countdown {
  const totalMs = Math.max(0, new Date(targetIso).getTime() - serverNow());
  return {
    totalMs,
    days: Math.floor(totalMs / 86_400_000),
    hours: Math.floor((totalMs / 3_600_000) % 24),
    minutes: Math.floor((totalMs / 60_000) % 60),
    seconds: Math.floor((totalMs / 1_000) % 60),
    isOver: totalMs === 0,
  };
}

/** Ticks every second against server-corrected time. */
export function useCountdown(targetIso: string): Countdown {
  const [state, setState] = useState(() => compute(targetIso));

  useEffect(() => {
    setState(compute(targetIso));
    const timer = setInterval(() => setState(compute(targetIso)), 1_000);
    return () => clearInterval(timer);
  }, [targetIso]);

  return state;
}
