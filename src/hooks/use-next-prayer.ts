// use-next-prayer.ts - Combine today's and tomorrow's schedules to find
// the next upcoming prayer slot, the current "active" prayer (the most
// recent one before now), and progress through the current interval.

import { useMemo } from 'react';
import type { PrayerSlot } from './use-prayer-times';

export interface NextPrayerInfo {
  next: PrayerSlot | null;
  previous: PrayerSlot | null;
  // Progress 0..1 of the way from `previous` to `next`.
  progress: number;
  // ms until next prayer fires.
  msUntilNext: number;
}

export function computeNextPrayer(
  today: PrayerSlot[],
  tomorrow: PrayerSlot[],
  now: number,
): NextPrayerInfo {
  // Build a merged timeline. We exclude sunrise/midnight from the
  // "active prayer" highlight because they are not salat, but we still
  // show them in the schedule.
  const timeline: PrayerSlot[] = [...today, ...tomorrow].filter(
    (s) => s.timestamp > 0,
  );

  let previous: PrayerSlot | null = null;
  let next: PrayerSlot | null = null;

  for (const slot of timeline) {
    if (slot.timestamp <= now) {
      previous = slot;
    } else if (!next) {
      next = slot;
      break;
    }
  }

  // Wrap-around: if next is null (shouldn't happen with tomorrow), fall
  // back to the first slot of tomorrow.
  if (!next && tomorrow.length) next = tomorrow[0];

  let progress = 0;
  let msUntilNext = 0;
  if (next) {
    msUntilNext = Math.max(0, next.timestamp - now);
    const start = previous ? previous.timestamp : next.timestamp - 6 * 3600 * 1000;
    const end = next.timestamp;
    const span = Math.max(1, end - start);
    progress = Math.min(1, Math.max(0, (now - start) / span));
  }

  return { next, previous, progress, msUntilNext };
}

export function useNextPrayerMemo(
  today: PrayerSlot[],
  tomorrow: PrayerSlot[],
  now: number,
): NextPrayerInfo {
  return useMemo(
    () => computeNextPrayer(today, tomorrow, now),
    [today, tomorrow, now],
  );
}
