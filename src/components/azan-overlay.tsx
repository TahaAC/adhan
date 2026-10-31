'use client';

import { useEffect, useState } from 'react';
import { X, Volume2, VolumeX, Pause, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useActiveAzan } from '@/hooks/use-active-azan';
import { useNow, computeCountdown } from '@/hooks/use-countdown';
import { useSettings } from '@/hooks/use-settings';
import {
  getReciter,
  getReciterAudioElement,
  setReciterVolume,
} from '@/lib/azan';

const PRAYER_ARABIC: Record<string, string> = {
  Fajr: 'الفجر',
  Sunrise: 'الشروق',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
  Midnight: 'منتصف الليل',
  Preview: 'معاينة',
};

const PRAYER_DESC: Record<string, string> = {
  Fajr: 'Dawn prayer — pre-sunrise',
  Sunrise: 'The sun has risen',
  Dhuhr: 'Noon prayer — sun past zenith',
  Asr: 'Afternoon prayer',
  Maghrib: 'Sunset prayer — break fast',
  Isha: 'Night prayer',
  Midnight: 'Midpoint of the night (Jafari)',
  Preview: 'Adhan preview',
};

/**
 * Full-screen overlay that appears automatically when the adhan fires.
 * Shows the prayer name in English + Arabic, the reciter, a live progress
 * bar, and controls to pause/stop. Designed to be visually prominent so
 * the user always notices it even when the tab is in the background.
 */
export function AzanOverlay() {
  const active = useActiveAzan((s) => s.active);
  const stop = useActiveAzan((s) => s.stop);
  const reciterId = useSettings((s) => s.reciterId);
  const azanVolume = useSettings((s) => s.azanVolume);
  const setAzanVolume = useSettings((s) => s.setAzanVolume);
  const now = useNow(500);

  const [paused, setPaused] = useState(false);

  // Auto-dismiss after the adhan duration + a small buffer.
  useEffect(() => {
    if (!active) return;
    const ms = active.durationMs + 2000;
    const id = setTimeout(() => {
      stop();
    }, ms);
    return () => clearTimeout(id);
  }, [active, stop]);

  if (!active) return null;

  const { slot, startedAt, durationMs } = active;
  const elapsed = now - startedAt;
  const progress = Math.min(100, Math.max(0, (elapsed / durationMs) * 100));
  const remaining = computeCountdown(startedAt + durationMs, now);
  const pad = (n: number) => String(n).padStart(2, '0');
  const remainingStr = `${pad(remaining.minutes)}:${pad(remaining.seconds)}`;

  const reciter = getReciter(reciterId);

  const handleStop = () => {
    const el = getReciterAudioElement(reciterId);
    if (el) {
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        // ignore
      }
    }
    stop();
  };

  const handlePauseResume = () => {
    const el = getReciterAudioElement(reciterId);
    if (!el) return;
    if (paused) {
      void el.play().catch(() => {});
      setPaused(false);
    } else {
      el.pause();
      setPaused(true);
    }
  };

  const setVolume = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setAzanVolume(clamped);
    setReciterVolume(reciterId, clamped);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Adhan for ${slot.label}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-emerald-deep/80 backdrop-blur-md"
        onClick={handleStop}
        aria-hidden
      />
      {/* Decorative pattern */}
      <div
        className="bg-geometric pointer-events-none absolute inset-0 opacity-20"
        aria-hidden
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-emerald-deep via-emerald-mid to-emerald-deep text-white shadow-2xl">
        {/* Top stripe */}
        <div className="bg-gold/15 px-5 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-gold-soft">
          Adhan is playing
        </div>

        <div className="px-6 py-7 sm:px-8 sm:py-9">
          {/* Crescent ornament */}
          <div className="mb-4 flex justify-center" aria-hidden>
            <div className="relative grid h-16 w-16 place-items-center rounded-full bg-gold/15 ring-2 ring-gold/30">
              <svg
                viewBox="0 0 24 24"
                className="h-9 w-9 text-gold"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                <circle cx="17" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
              </svg>
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">
              Prayer time
            </p>
            <h2 className="mt-1 font-kufi text-4xl font-bold tracking-tight sm:text-5xl">
              {slot.label}
            </h2>
            <p className="text-arabic mt-1 text-3xl text-gold-soft sm:text-4xl">
              {PRAYER_ARABIC[slot.label] ?? ''}
            </p>
            <p className="mt-2 text-sm text-white/70">
              {PRAYER_DESC[slot.label] ?? ''}
            </p>
          </div>

          {/* Shahada */}
          <div className="my-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center">
            <p className="text-arabic text-lg leading-relaxed text-gold-soft">
              أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا ٱللَّٰهُ
            </p>
            <p className="text-arabic text-lg leading-relaxed text-gold-soft">
              وَأَشْهَدُ أَنَّ مُحَمَّدًا رَسُولُ ٱللَّٰهِ
            </p>
            <p className="mt-2 text-[11px] uppercase tracking-wider text-white/50">
              Allahu Akbar · Allahu Akbar
            </p>
          </div>

          {/* Reciter + progress */}
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-white/60">Reciter</span>
              <span className="font-medium text-gold-soft">{reciter.name}</span>
            </div>
            <Progress
              value={progress}
              className="h-1.5 bg-white/15 [&>div]:bg-gold"
            />
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/55">
              <span>{paused ? 'Paused' : 'Playing'}</span>
              <span className="font-mono tabular-nums">-{remainingStr}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={handlePauseResume}
              variant="secondary"
              className="border border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              {paused ? (
                <>
                  <Play className="mr-1.5 h-4 w-4" /> Resume
                </>
              ) : (
                <>
                  <Pause className="mr-1.5 h-4 w-4" /> Pause
                </>
              )}
            </Button>
            <Button
              onClick={handleStop}
              variant="secondary"
              className="border border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <Square className="mr-1.5 h-4 w-4" /> Stop
            </Button>
            <Button
              onClick={() => setVolume(azanVolume > 0 ? 0 : 1)}
              variant="secondary"
              className="border border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              aria-label={azanVolume > 0 ? 'Mute' : 'Unmute'}
            >
              {azanVolume > 0 ? (
                <>
                  <Volume2 className="mr-1.5 h-4 w-4" /> {Math.round(azanVolume * 100)}%
                </>
              ) : (
                <>
                  <VolumeX className="mr-1.5 h-4 w-4" /> Muted
                </>
              )}
            </Button>
          </div>

          {/* Volume slider */}
          <div className="mt-3 flex items-center gap-2">
            <VolumeX className="h-3.5 w-3.5 text-white/50" />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(azanVolume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-gold"
              aria-label="Adhan volume"
            />
            <Volume2 className="h-3.5 w-3.5 text-white/50" />
          </div>

          <button
            onClick={handleStop}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs text-white/55 transition hover:text-white"
          >
            <X className="h-3.5 w-3.5" /> Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
