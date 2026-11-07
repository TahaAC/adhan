// use-sw-bridge.ts - Bridge between the React app and the service worker.
//
// Responsibilities:
// 1. Send the upcoming prayer schedule to the SW so it can schedule
//    `setTimeout` calls for each prayer time. The SW then fires a
//    Windows toast notification + audio playback at the exact time,
//    even if the app tab is in the background or minimized.
// 2. Listen for `PLAY_ADHAN` messages from the SW (fired when a prayer
//    time is reached and the SW wants the page to play audio).
// 3. Listen for `RESEND_SCHEDULE` messages (fired by periodic sync) so
//    the page re-sends the prayer times if the SW was restarted.
// 4. Detect the `?playAdhan=...` URL parameter (set by the SW when it
//    opens the app from a notification) and trigger audio playback.

import { useCallback, useEffect, useRef } from 'react';
import type { PrayerSlot } from './use-prayer-times';
import { useActiveAzan } from './use-active-azan';
import { useSettings } from './use-settings';
import {
  playAzan,
  unlockAudio,
  getReciterAudioElement,
  preloadReciter,
} from '@/lib/azan';
import { toast } from 'sonner';

interface SWMessage {
  type: string;
  prayer?: PrayerSlot;
  settings?: Record<string, unknown>;
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

export function useSwBridge(
  today: PrayerSlot[],
  tomorrow: PrayerSlot[],
) {
  const reciterId = useSettings((s) => s.reciterId);
  const azanVolume = useSettings((s) => s.azanVolume);
  const notificationsEnabled = useSettings((s) => s.notificationsEnabled);
  const method = useSettings((s) => s.method);
  const asrMethod = useSettings((s) => s.asrMethod);
  const highLats = useSettings((s) => s.highLats);
  const azanEnabled = useSettings((s) => s.azanEnabled);
  const azanOffsetMin = useSettings((s) => s.azanOffsetMin);
  const location = useSettings((s) => s.location);
  const startActiveAzan = useActiveAzan((s) => s.start);
  const stopActiveAzan = useActiveAzan((s) => s.stop);
  const lastScheduleKeyRef = useRef<string>('');

  /**
   * Shared handler for playing the adhan when triggered by the SW.
   * Declared with useCallback so it can be referenced by effects below
   * without "used before declaration" errors.
   */
  const handlePlayAdhanFromSW = useCallback(
    (prayer: PrayerSlot) => {
      unlockAudio();
      preloadReciter(reciterId);

      if (prayer.isAzan) {
        const handle = playAzan({ reciterId, volume: azanVolume });
        // Update overlay duration once metadata loads.
        void handle.ready.then((realMs) => {
          useActiveAzan.setState((s) =>
            s.active
              ? { active: { ...s.active, durationMs: realMs } }
              : s,
          );
        });
        startActiveAzan(prayer, handle.durationMs);
        // Stop the overlay when the adhan finishes naturally.
        const el = getReciterAudioElement(reciterId);
        if (el) {
          el.addEventListener('ended', () => stopActiveAzan(), {
            once: true,
          });
        }
      } else {
        // Non-salat markers (Sunrise, Midnight) — just show a toast.
        toast(`${prayer.label} — ${prayer.time}`, {
          description: PRAYER_ARABIC[prayer.label] ?? '',
          duration: 8000,
        });
      }
    },
    [reciterId, azanVolume, startActiveAzan, stopActiveAzan],
  );

  // Send the prayer schedule to the SW whenever it changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (!navigator.serviceWorker.controller) return;

    const all = [...today, ...tomorrow].filter((s) => s.timestamp > 0);
    if (all.length === 0) return;

    // De-duplicate: only re-send if the schedule actually changed.
    const key = all.map((s) => `${s.key}:${s.timestamp}`).join('|');
    if (key === lastScheduleKeyRef.current) return;
    lastScheduleKeyRef.current = key;

    navigator.serviceWorker.controller.postMessage({
      type: 'SCHEDULE_PRAYERS',
      prayers: all,
      settings: {
        reciterId,
        azanVolume,
        notificationsEnabled,
        // Full settings so the SW can recompute its own schedule if it
        // gets killed and restarted while the page is closed.
        method,
        asrMethod,
        highLats,
        azanEnabled,
        azanOffsetMin,
        location: location
          ? {
              name: location.name,
              lat: location.lat,
              lng: location.lng,
              timezone: location.timezone,
            }
          : null,
      },
    });
  }, [today, tomorrow, reciterId, azanVolume, notificationsEnabled, method, asrMethod, highLats, azanEnabled, azanOffsetMin, location]);

  // Listen for messages from the SW.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const handler = (event: MessageEvent<SWMessage>) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'PLAY_ADHAN' && data.prayer) {
        // The SW detected a prayer time and wants us to play the adhan.
        // This fires when the app is open in a background tab or
        // minimized — the SW can't play audio itself, so it delegates
        // to us.
        handlePlayAdhanFromSW(data.prayer);
      } else if (data.type === 'RESEND_SCHEDULE') {
        // Periodic sync fired — re-send the schedule.
        lastScheduleKeyRef.current = '';
        if (navigator.serviceWorker.controller) {
          const all = [...today, ...tomorrow].filter(
            (s) => s.timestamp > 0,
          );
          if (all.length > 0) {
            navigator.serviceWorker.controller.postMessage({
              type: 'SCHEDULE_PRAYERS',
              prayers: all,
              settings: {
                reciterId,
                azanVolume,
                notificationsEnabled,
                method,
                asrMethod,
                highLats,
                azanEnabled,
                azanOffsetMin,
                location: location
                  ? {
                      name: location.name,
                      lat: location.lat,
                      lng: location.lng,
                      timezone: location.timezone,
                    }
                  : null,
              },
            });
          }
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () =>
      navigator.serviceWorker.removeEventListener('message', handler);
  }, [
    today,
    tomorrow,
    reciterId,
    azanVolume,
    notificationsEnabled,
    method,
    asrMethod,
    highLats,
    azanEnabled,
    azanOffsetMin,
    location,
    handlePlayAdhanFromSW,
  ]);

  // Handle the ?playAdhan= URL parameter (set by the SW when it opens
  // the app from a notification because no client was open).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const playAdhan = url.searchParams.get('playAdhan');
    if (!playAdhan) return;

    // Find the prayer slot that matches.
    const slot = [...today, ...tomorrow].find((s) => s.key === playAdhan);
    if (slot) {
      // Small delay so the page is fully loaded and audio is unlocked.
      const id = setTimeout(() => handlePlayAdhanFromSW(slot), 1000);
      // Clean the URL so we don't re-trigger on refresh.
      url.searchParams.delete('playAdhan');
      url.searchParams.delete('time');
      window.history.replaceState({}, '', url.toString());
      return () => clearTimeout(id);
    }
    // Clean the URL even if no slot matched.
    url.searchParams.delete('playAdhan');
    url.searchParams.delete('time');
    window.history.replaceState({}, '', url.toString());
  }, [today, tomorrow, handlePlayAdhanFromSW]);

  /**
   * Test the Windows toast notification. Returns true if the SW
   * accepted the request.
   */
  const testNotification = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      return false;
    }
    navigator.serviceWorker.controller.postMessage({
      type: 'TEST_NOTIFICATION',
      settings: {
        reciterId,
        azanVolume,
        notificationsEnabled,
        method,
        asrMethod,
        highLats,
        azanEnabled,
        azanOffsetMin,
        location: location
          ? {
              name: location.name,
              lat: location.lat,
              lng: location.lng,
              timezone: location.timezone,
            }
          : null,
      },
    });
    return true;
  }, [reciterId, azanVolume, notificationsEnabled, method, asrMethod, highLats, azanEnabled, azanOffsetMin, location]);

  return { testNotification };
}
