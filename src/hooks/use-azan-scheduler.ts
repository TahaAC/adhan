// use-azan-scheduler.ts - Watch the prayer schedule and trigger the azan
// sound + on-screen overlay + browser notification when a prayer time is
// reached. Uses a 30-second window so we don't miss an event if the tab
// is throttled.
//
// Audio playback uses real Shia adhan recordings from praytimes.org
// (see src/lib/azan.ts). The active adhan is also tracked in the
// `useActiveAzan` store so the AzanOverlay component can render a
// prominent full-screen message while it plays.

import { useEffect, useRef } from 'react';
import type { PrayerSlot } from './use-prayer-times';
import {
  playAzan,
  playBeep,
  unlockAudio,
  setReciterVolume,
  getReciterAudioElement,
} from '@/lib/azan';
import { useSettings } from './use-settings';
import { useActiveAzan } from './use-active-azan';
import { toast } from 'sonner';

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
  Sunrise: 'The sun has risen',
  Dhuhr: 'Noon prayer — sun past zenith',
  Asr: 'Afternoon prayer',
  Maghrib: 'Sunset prayer — break fast',
  Isha: 'Night prayer',
  Midnight: 'Midpoint of the night (Jafari)',
};

export function useAzanScheduler(
  today: PrayerSlot[],
  tomorrow: PrayerSlot[],
) {
  const triggeredRef = useRef<Set<number>>(new Set());
  const notificationsEnabled = useSettings((s) => s.notificationsEnabled);
  const azanEnabled = useSettings((s) => s.azanEnabled);
  const azanOffsetMin = useSettings((s) => s.azanOffsetMin);
  const reciterId = useSettings((s) => s.reciterId);
  const azanVolume = useSettings((s) => s.azanVolume);
  const startActiveAzan = useActiveAzan((s) => s.start);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const offsetMs = azanOffsetMin * 60_000;
      const all = [...today, ...tomorrow];
      for (const slot of all) {
        if (!slot.timestamp) continue;
        const fireAt = slot.timestamp + offsetMs;
        const withinWindow = now >= fireAt && now - fireAt < 30_000;
        if (!withinWindow) continue;
        if (triggeredRef.current.has(fireAt)) continue;
        triggeredRef.current.add(fireAt);

        const enabled = notificationsEnabled;
        const perPrayerOn = azanEnabled[slot.key];
        if (!enabled || !perPrayerOn) continue;

        // Fire
        unlockAudio();

        if (slot.isAzan) {
          // Real adhan recording.
          const handle = playAzan({
            reciterId,
            volume: azanVolume,
          });
          // Once metadata loads, update the overlay's duration so the
          // progress bar is accurate (real adhan is ~3-4 min, not the
          // 3-min fallback).
          void handle.ready.then((realDurationMs) => {
            useActiveAzan.setState((s) =>
              s.active && s.active.slot.key === slot.key
                ? {
                    active: { ...s.active, durationMs: realDurationMs },
                  }
                : s,
            );
          });
          startActiveAzan(slot, handle.durationMs);
          // Stop the overlay when the adhan finishes naturally.
          const stopOverlay = () => useActiveAzan.getState().stop();
          const el = getReciterAudioElement(reciterId);
          if (el) {
            el.addEventListener('ended', stopOverlay, { once: true });
          }
        } else {
          // Reminder beep for Sunrise / Midnight.
          playBeep().catch(() => {});
        }

        // Browser notification
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          const body = slot.isAzan
            ? `It's time for ${slot.label} (${slot.time}). Allahu Akbar.`
            : `${slot.label} at ${slot.time}.`;
          try {
            new Notification(`${slot.label} — ${slot.time}`, {
              body,
              tag: `prayer-${slot.key}-${fireAt}`,
              icon: '/logo.svg',
            });
          } catch {
            // ignore
          }
        }

        // Persistent toast (in addition to the full-screen overlay).
        toast.success(`Adhan: ${slot.label}`, {
          description: `${PRAYER_ARABIC[slot.label] ?? ''} • ${slot.time}${
            PRAYER_DESC[slot.label] ? ' — ' + PRAYER_DESC[slot.label] : ''
          }`,
          duration: 10000,
        });
      }
    };

    const id = setInterval(check, 15_000);
    check();
    return () => clearInterval(id);
  }, [
    today,
    tomorrow,
    notificationsEnabled,
    azanEnabled,
    azanOffsetMin,
    reciterId,
    azanVolume,
    startActiveAzan,
  ]);
}

// Re-export for components that need to live-adjust the volume during
// playback (e.g. the overlay's volume slider).
export { setReciterVolume };

