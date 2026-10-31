'use client';

import { Moon, Sun, Monitor, Settings2, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettings } from '@/hooks/use-settings';
import { getHijriDate, formatGregorian } from '@/lib/hijri';
import { useEffect, useState } from 'react';
import { useMounted } from '@/hooks/use-mounted';

interface HeaderProps {
  onOpenSettings: () => void;
  /** The location currently used for prayer calculations (may be a
   *  timezone-based default when the user hasn't picked one). */
  displayLocation?: { name: string };
}

/**
 * Format a Date as a time string in the given timezone using the user's
 * preferred 12h/24h format. Used for the live clock.
 */
function formatClockTime(
  date: Date,
  timezone: string,
  format: '12h' | '24h',
): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: format === '12h',
      hour: format === '12h' ? 'numeric' : '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hour12: format === '12h',
      hour: format === '12h' ? 'numeric' : '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  }
}

export function Header({ onOpenSettings, displayLocation }: HeaderProps) {
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const savedLocation = useSettings((s) => s.location);
  const timeFormat = useSettings((s) => s.timeFormat);
  const mounted = useMounted();

  // The location to display: the user-saved one, else the timezone-based
  // default passed in from the page. This always shows something useful
  // instead of "Detecting…" or an error.
  const location = savedLocation ?? displayLocation ?? null;

  // Render empty placeholders during SSR and the first client render to
  // avoid hydration mismatches caused by locale/timezone differences.
  // The Header is only mounted by the parent after the useMounted() gate
  // has flipped to true, so these initializers run on the client.
  const [hijri, setHijri] = useState(() => (mounted ? getHijriDate() : null));
  const [gregorian, setGregorian] = useState(() =>
    mounted ? formatGregorian() : '',
  );
  const [clock, setClock] = useState(() =>
    mounted
      ? formatClockTime(
          new Date(),
          location?.timezone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone,
          timeFormat === '24h' ? '24h' : '12h',
        )
      : '',
  );

  // Live clock — update every second so the user can verify it matches
  // their system clock.
  useEffect(() => {
    if (!mounted) return;
    const tz =
      location?.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone;
    const fmt: '12h' | '24h' = timeFormat === '24h' ? '24h' : '12h';
    const id = setInterval(() => {
      setClock(formatClockTime(new Date(), tz, fmt));
    }, 1000);
    return () => clearInterval(id);
  }, [mounted, location?.timezone, timeFormat]);

  // Refresh the displayed date once per minute so it stays correct around
  // midnight. The setState calls happen inside the interval callback (an
  // async context) which is allowed by the react-hooks lint rule.
  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => {
      setHijri(getHijriDate());
      setGregorian(formatGregorian());
    }, 60000);
    return () => clearInterval(id);
  }, [mounted]);

  // Build the location label. We always have something useful to show:
  // either the user's saved location or the timezone-based default.
  const locationLabel = location?.name || 'Set location';
  const locationIcon = location ? (
    <MapPin className="h-3.5 w-3.5 text-primary" />
  ) : (
    <MapPin className="h-3.5 w-3.5 text-amber-600" />
  );
  const locationTint = location ? 'text-primary' : 'text-amber-600';

  const displayTimezone =
    savedLocation?.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              <circle cx="17" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div className="leading-tight">
            <h1 className="font-kufi text-lg font-bold tracking-tight text-primary sm:text-xl">
              Shia Azan
            </h1>
            <p className="text-[11px] text-muted-foreground sm:text-xs">
              {gregorian}
            </p>
          </div>

          {/* Live clock — matches the user's system clock */}
          <div className="ml-2 hidden flex-col items-end leading-tight sm:flex">
            <span className="flex items-center gap-1 font-mono text-base font-semibold tabular-nums text-primary sm:text-lg">
              <Clock className="h-3.5 w-3.5 text-gold" />
              {clock || '--:--:--'}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {displayTimezone}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="hidden items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs text-foreground/80 sm:flex">
            <span className="text-amber-600 dark:text-amber-300" aria-hidden>
              ✦
            </span>
            {hijri ? (
              <>
                <span className="text-arabic text-sm">
                  {hijri.formattedArabic}
                </span>
                <span className="text-muted-foreground">·</span>
                <span>{hijri.formatted}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Loading date…</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs">
            {locationIcon}
            <span className={`max-w-[180px] truncate ${locationTint}`}>
              {locationLabel}
            </span>
          </div>

          <Select
            value={theme}
            onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}
          >
            <SelectTrigger
              size="sm"
              className="h-9 w-[44px] gap-0 rounded-full border-border bg-card/70 px-0 [&_svg]:hidden"
              aria-label="Theme"
            >
              <SelectValue>
                {theme === 'dark' ? (
                  <Moon className="h-4 w-4" />
                ) : theme === 'light' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Monitor className="h-4 w-4" />
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="light">
                <span className="flex items-center gap-2">
                  <Sun className="h-4 w-4" /> Light
                </span>
              </SelectItem>
              <SelectItem value="dark">
                <span className="flex items-center gap-2">
                  <Moon className="h-4 w-4" /> Dark
                </span>
              </SelectItem>
              <SelectItem value="system">
                <span className="flex items-center gap-2">
                  <Monitor className="h-4 w-4" /> System
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="default"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={onOpenSettings}
            aria-label="Open settings"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
