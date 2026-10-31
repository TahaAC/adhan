// use-countdown.ts - A small tick hook that re-renders the consumer
// every `intervalMs`. Used to keep the "next prayer in HH:MM:SS" display
// and the current-prayer highlight live.

import { useEffect, useState } from 'react';

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export interface Countdown {
  totalMs: number;
  ms: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

export function computeCountdown(target: number, now: number): Countdown {
  const ms = Math.max(0, target - now);
  const totalSec = Math.floor(ms / 1000);
  return {
    totalMs: ms,
    ms,
    hours: Math.floor(totalSec / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    done: ms <= 0,
  };
}
