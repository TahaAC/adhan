'use client';

import { useMemo } from 'react';
import { Sunrise, Sun, Sunset, Moon, CloudMoon, Clock3, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PrayerSlot } from '@/hooks/use-prayer-times';
import { computeNextPrayer } from '@/hooks/use-next-prayer';
import { useNow } from '@/hooks/use-countdown';
import { useSettings } from '@/hooks/use-settings';

interface PrayerScheduleProps {
  today: PrayerSlot[];
  tomorrow: PrayerSlot[];
}

interface IconEntry {
  icon: React.ComponentType<{ className?: string }>;
  tint: string; // tailwind text color class
}

const ICONS: Record<string, IconEntry> = {
  Fajr: { icon: Star, tint: 'text-indigo-300' },
  Sunrise: { icon: Sunrise, tint: 'text-amber-400' },
  Dhuhr: { icon: Sun, tint: 'text-amber-500' },
  Asr: { icon: Clock3, tint: 'text-emerald-400' },
  Maghrib: { icon: Sunset, tint: 'text-orange-400' },
  Isha: { icon: Moon, tint: 'text-blue-200' },
  Midnight: { icon: CloudMoon, tint: 'text-violet-300' },
};

export function PrayerSchedule({ today, tomorrow }: PrayerScheduleProps) {
  const now = useNow(5000);
  const { next, previous } = useMemo(
    () => computeNextPrayer(today, tomorrow, now),
    [today, tomorrow, now],
  );
  const azanEnabled = useSettings((s) => s.azanEnabled);
  const notificationsEnabled = useSettings((s) => s.notificationsEnabled);

  const upcomingKey = next?.key;
  const currentKey = previous?.key;

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-kufi text-lg font-bold tracking-tight">
            Today&apos;s Schedule
          </h2>
          <p className="text-xs text-muted-foreground">
            Times for your current location. Tap a card to toggle its azan.
          </p>
        </div>
        <span className="hidden rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground sm:inline">
          7 daily markers
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {today.map((slot) => {
          const Icon = ICONS[slot.label]?.icon ?? Sun;
          const tint = ICONS[slot.label]?.tint ?? 'text-amber-400';
          const isUpcoming = slot.key === upcomingKey;
          const isCurrent = slot.key === currentKey;
          const isAzanOn =
            notificationsEnabled &&
            !!azanEnabled[slot.key];

          return (
            <PrayerCard
              key={slot.key}
              slot={slot}
              icon={<Icon className={cn('h-5 w-5', tint)} />}
              isUpcoming={isUpcoming}
              isCurrent={isCurrent}
              azanOn={isAzanOn}
            />
          );
        })}
      </div>
    </section>
  );
}

interface PrayerCardProps {
  slot: PrayerSlot;
  icon: React.ReactNode;
  isUpcoming: boolean;
  isCurrent: boolean;
  azanOn: boolean;
}

function PrayerCard({
  slot,
  icon,
  isUpcoming,
  isCurrent,
  azanOn,
}: PrayerCardProps) {
  return (
    <article
      className={cn(
        'group relative flex flex-col gap-2 overflow-hidden rounded-xl border p-3 transition-all',
        'bg-background hover:shadow-md',
        isUpcoming
          ? 'border-primary/60 shadow-sm ring-1 ring-primary/30'
          : isCurrent
            ? 'border-gold/60 bg-gold/5'
            : 'border-border',
      )}
    >
      {isUpcoming && (
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary">
          <span className="h-1 w-1 animate-soft-pulse rounded-full bg-primary" />
          Next
        </span>
      )}
      {isCurrent && !isUpcoming && (
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
          Now
        </span>
      )}

      <div className="flex items-center gap-2">
        <span
          className={cn(
            'grid h-9 w-9 place-items-center rounded-lg',
            isUpcoming
              ? 'bg-primary/10'
              : isCurrent
                ? 'bg-gold/15'
                : 'bg-muted/60',
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold">{slot.label}</p>
          <p className="text-arabic text-xs text-muted-foreground">
            {slot.arabicLabel}
          </p>
        </div>
      </div>

      <div className="mt-1 flex items-end justify-between">
        <p className="font-mono text-xl font-semibold tabular-nums">
          {slot.time}
        </p>
        <div className="flex items-center gap-1">
          {slot.isAzan ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase',
                azanOn
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {azanOn ? 'Azan' : 'Mute'}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
              Reminder
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
