'use client';

import { useMemo } from 'react';
import { Clock, Volume2, VolumeX, Play, MapPin, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useNow, computeCountdown } from '@/hooks/use-countdown';
import { computeNextPrayer } from '@/hooks/use-next-prayer';
import type { PrayerSlot } from '@/hooks/use-prayer-times';
import {
  playAzan,
  unlockAudio,
  getReciter,
  getReciterAudioElement,
} from '@/lib/azan';
import { useSettings } from '@/hooks/use-settings';
import { useActiveAzan } from '@/hooks/use-active-azan';
import { toast } from 'sonner';

interface NextPrayerHeroProps {
  today: PrayerSlot[];
  tomorrow: PrayerSlot[];
  locationName: string;
  timezone: string;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
}

const PRAYER_ARABIC: Record<string, string> = {
  Fajr: 'الفجر',
  Sunrise: 'الشروق',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
  Midnight: 'منتصف الليل',
};

const PRAYER_DESC: Record<string, string> = {
  Fajr: 'Dawn prayer — pre-sunrise',
  Sunrise: 'Sun rises — no adhan',
  Dhuhr: 'Noon prayer — sun past zenith',
  Asr: 'Afternoon prayer',
  Maghrib: 'Sunset prayer — break fast',
  Isha: 'Night prayer',
  Midnight: 'Midpoint of the night (Jafari)',
};

export function NextPrayerHero({
  today,
  tomorrow,
  locationName,
  timezone,
  notificationsEnabled,
  onToggleNotifications,
}: NextPrayerHeroProps) {
  const now = useNow(1000);
  const { next, previous, progress } = useMemo(
    () => computeNextPrayer(today, tomorrow, now),
    [today, tomorrow, now],
  );

  const cd = computeCountdown(next?.timestamp ?? now, now);

  const pad = (n: number) => String(n).padStart(2, '0');
  const countdownStr = next
    ? `${pad(cd.hours)}:${pad(cd.minutes)}:${pad(cd.seconds)}`
    : '--:--:--';

  const reciterId = useSettings((s) => s.reciterId);
  const azanVolume = useSettings((s) => s.azanVolume);
  const activeAzan = useActiveAzan((s) => s.active);
  const stopActiveAzan = useActiveAzan((s) => s.stop);
  const startActiveAzan = useActiveAzan((s) => s.start);

  const handleTestAzan = async () => {
    unlockAudio();
    const reciter = getReciter(reciterId);
    toast.info(`Playing adhan — ${reciter.name}`, {
      description: 'A full-screen message will appear. Tap Stop to end early.',
    });
    try {
      const handle = playAzan({ reciterId, volume: azanVolume });
      // Use the next prayer slot as the "active" placeholder so the
      // overlay renders, or a synthetic one if there's no next prayer.
      const slot = next ?? {
        key: 'fajr' as const,
        label: 'Fajr',
        arabicLabel: 'الفجر',
        time: '—',
        timestamp: 0,
        isAzan: true,
      };
      startActiveAzan(slot, handle.durationMs);
      // Once metadata loads, update the overlay's duration for an
      // accurate progress bar.
      void handle.ready.then((realMs) => {
        useActiveAzan.setState((s) =>
          s.active
            ? { active: { ...s.active, durationMs: realMs } }
            : s,
        );
      });
      // Stop the overlay when the adhan finishes naturally.
      const el = getReciterAudioElement(reciterId);
      if (el) {
        const stopOverlay = () => stopActiveAzan();
        el.addEventListener('ended', stopOverlay, { once: true });
      }
    } catch {
      toast.error('Audio playback failed', {
        description:
          'Your browser may have blocked audio. Tap the page first.',
      });
    }
  };

  const handleStopAzan = () => {
    const el = getReciterAudioElement(reciterId);
    if (el) {
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        // ignore
      }
    }
    stopActiveAzan();
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-emerald-deep via-emerald-mid to-emerald-deep text-white shadow-lg">
      {/* Decorative geometric layer */}
      <div className="bg-geometric pointer-events-none absolute inset-0 opacity-30" aria-hidden />
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-emerald-soft/20 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 px-5 py-7 sm:px-8 sm:py-10 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-gold-soft">
              <span className="inline-block h-1.5 w-1.5 animate-soft-pulse rounded-full bg-gold" />
              Next Prayer
            </p>
            <p className="mt-1 text-sm text-white/70">
              {previous ? (
                <>
                  Now in <span className="font-semibold text-white">{previous.label}</span> time
                </>
              ) : (
                'Loading schedule…'
              )}
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleNotifications}
            className="border border-white/15 bg-white/5 text-white hover:bg-white/15 hover:text-white"
          >
            {notificationsEnabled ? (
              <>
                <Volume2 className="mr-1.5 h-4 w-4" /> Azan On
              </>
            ) : (
              <>
                <VolumeX className="mr-1.5 h-4 w-4" /> Azan Off
              </>
            )}
          </Button>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex items-baseline gap-3">
              <h2 className="font-kufi text-4xl font-bold leading-none tracking-tight sm:text-5xl">
                {next?.label ?? '—'}
              </h2>
              <span className="text-arabic text-2xl text-gold-soft sm:text-3xl">
                {next ? PRAYER_ARABIC[next.label] ?? '' : ''}
              </span>
            </div>
            <p className="mt-1 text-sm text-white/70">
              {next ? PRAYER_DESC[next.label] ?? '' : ''}
            </p>

            <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/55">
                  Current time
                </p>
                <p className="font-mono text-2xl font-semibold tabular-nums text-white sm:text-3xl">
                  {new Intl.DateTimeFormat('en-US', {
                    timeZone: timezone,
                    hour12: true,
                    hour: 'numeric',
                    minute: '2-digit',
                  }).format(new Date(now))}
                </p>
                <p className="text-[10px] text-white/45">{timezone}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/55">
                  Countdown
                </p>
                <p className="font-mono text-3xl font-semibold tabular-nums text-white sm:text-4xl">
                  {countdownStr}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/55">
                  Adhan at
                </p>
                <p className="font-mono text-2xl font-semibold tabular-nums text-gold-soft sm:text-3xl">
                  {next?.time ?? '--:--'}
                </p>
              </div>
            </div>

            <div className="mt-5 max-w-md">
              <Progress
                value={progress * 100}
                className="h-1.5 bg-white/15 [&>div]:bg-gold"
              />
              <p className="mt-1.5 text-[11px] text-white/55">
                {Math.round(progress * 100)}% through this interval
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:items-end">
            <div className="flex items-center gap-1.5 text-xs text-white/75">
              <MapPin className="h-3.5 w-3.5" />
              <span className="max-w-[220px] truncate">{locationName}</span>
            </div>
            {activeAzan ? (
              <Button
                onClick={handleStopAzan}
                variant="secondary"
                className="border border-rose-300/30 bg-rose-500/20 text-white hover:bg-rose-500/30 hover:text-white"
              >
                <Square className="mr-2 h-4 w-4" />
                Stop Adhan
              </Button>
            ) : (
              <Button
                onClick={handleTestAzan}
                variant="secondary"
                className="border border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Play className="mr-2 h-4 w-4" />
                Test Azan
              </Button>
            )}
            <p className="flex items-center gap-1 text-[10px] text-white/55">
              <Clock className="h-3 w-3" />
              Computed via Tehran (Jafari) method
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
