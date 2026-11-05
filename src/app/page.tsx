'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { NextPrayerHero } from '@/components/next-prayer-hero';
import { PrayerSchedule } from '@/components/prayer-schedule';
import { QiblaCompass } from '@/components/qibla-compass';
import { SettingsPanel } from '@/components/settings-panel';
import { AzanOverlay } from '@/components/azan-overlay';
import { BackgroundStatusBar } from '@/components/background-status-bar';
import { LocationBar } from '@/components/location-bar';
import { LocationBanner } from '@/components/location-banner';
import { usePrayerTimes } from '@/hooks/use-prayer-times';
import { useSettings } from '@/hooks/use-settings';
import { useAzanScheduler } from '@/hooks/use-azan-scheduler';
import { useSwBridge } from '@/hooks/use-sw-bridge';
import { useMounted } from '@/hooks/use-mounted';
import { unlockAudio, preloadReciter } from '@/lib/azan';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const mounted = useMounted();

  const savedLocation = useSettings((s) => s.location);
  const notificationsEnabled = useSettings((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useSettings(
    (s) => s.setNotificationsEnabled,
  );
  const reciterId = useSettings((s) => s.reciterId);

  const { today, tomorrow, location: loc, timezone } = usePrayerTimes();

  // Preload the selected reciter's audio file so playback starts with
  // minimal latency when a prayer time fires.
  useEffect(() => {
    if (!mounted) return;
    preloadReciter(reciterId);
  }, [mounted, reciterId]);

  // Request browser notification permission the first time the user
  // enables notifications. We only do this on a user gesture (click) —
  // browsers block permission prompts that fire on page load.
  useEffect(() => {
    if (!mounted) return;
    if (!notificationsEnabled) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      // Defer to next tick so it doesn't race with other effects.
      const id = setTimeout(() => {
        Notification.requestPermission().catch(() => {});
      }, 1000);
      return () => clearTimeout(id);
    }
  }, [mounted, notificationsEnabled]);

  // Unlock audio on the first user interaction (any click on the page).
  // This is required for autoplay to work later when a prayer time fires.
  useEffect(() => {
    if (!mounted) return;
    const handler = () => {
      unlockAudio();
    };
    window.addEventListener('click', handler, { once: true });
    window.addEventListener('touchstart', handler, { once: true });
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('touchstart', handler);
    };
  }, [mounted]);

  // Location auto-detection is handled by the LocationBanner component
  // (which uses the useGeolocation store). No useEffect here — the
  // banner triggers detection on mount and shows appropriate error
  // guidance if it fails.

  // Schedule the azan for today + tomorrow (in-page scheduler — works
  // while the app is open).
  useAzanScheduler(today, tomorrow);

  // Bridge to the service worker — sends the prayer schedule so the SW
  // can fire Windows toast notifications + audio at the exact prayer
  // time, even when the app is in the background or minimized.
  const { testNotification } = useSwBridge(today, tomorrow);

  // Render a lightweight skeleton until mounted to avoid SSR/client
  // hydration mismatches caused by locale, timezone and localStorage
  // differences. The skeleton keeps the same layout so there's no jump.
  if (!mounted) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-emerald-mid/5">
        <div className="border-b border-border/60 bg-background/85 px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/20" />
            <div className="space-y-1.5">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-3 w-44 rounded bg-muted/70" />
            </div>
          </div>
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          <div className="flex h-64 items-center justify-center gap-2 rounded-3xl border border-border bg-card/50 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading prayer times…
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-emerald-mid/5">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        displayLocation={loc}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-5 sm:px-6 sm:py-7 md:space-y-6">
        <LocationBar
          currentLocation={loc}
          isAuto={!savedLocation}
        />

        <LocationBanner onOpenSearch={() => setSettingsOpen(true)} />

        <NextPrayerHero
          today={today}
          tomorrow={tomorrow}
          locationName={loc.name}
          timezone={timezone}
          notificationsEnabled={notificationsEnabled}
          onToggleNotifications={() =>
            setNotificationsEnabled(!notificationsEnabled)
          }
        />

        <BackgroundStatusBar
          onTestNotification={() => {
            if (testNotification()) {
              // The toast should appear within a second.
            } else {
              // Fallback: use the page-side Notification API.
              if (
                typeof window !== 'undefined' &&
                'Notification' in window &&
                Notification.permission === 'granted'
              ) {
                new Notification('Shia Azan — Test', {
                  body: 'This is how adhan notifications will appear at each prayer time.',
                  icon: '/icon-192.png',
                });
              }
            }
          }}
        />

        <PrayerSchedule today={today} tomorrow={tomorrow} />

        <div className="grid gap-5 md:grid-cols-2 md:gap-6">
          <QiblaCompass location={loc} />

          <section className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm sm:p-5">
            <div className="mb-3">
              <h2 className="font-kufi text-lg font-bold tracking-tight">
                Tomorrow&apos;s Times
              </h2>
              <p className="text-xs text-muted-foreground">
                Plan your day ahead — same calculation method.
              </p>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {tomorrow.map((slot) => (
                <li
                  key={slot.key}
                  className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{slot.label}</p>
                    <p className="text-arabic text-[10px] text-muted-foreground">
                      {slot.arabicLabel}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {slot.time}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="rounded-2xl border border-border bg-gradient-to-br from-emerald-mid/10 to-gold/10 p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <h2 className="font-kufi text-base font-bold">
                About the Tehran method
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                The Tehran (Jafari) method is the calculation standard used
                by Shia Ithna Ashari (Twelver) Muslims. It uses a fajr angle
                of 17.7°, maghrib at 4.5° below the horizon, and the
                Jafari midnight (midpoint between sunset and the next fajr).
              </p>
            </div>
            <div>
              <h2 className="font-kufi text-base font-bold">
                Tips for accuracy
              </h2>
              <ul className="mt-1 space-y-1 text-xs leading-relaxed text-muted-foreground">
                <li>• Allow location access for precise local times.</li>
                <li>• Verify with your local mosque during Ramadan.</li>
                <li>• Adjust Asr method if you follow Hanafi fiqh.</li>
                <li>• Use tuning offsets for ±a few minutes if needed.</li>
              </ul>
            </div>
            <div>
              <h2 className="font-kufi text-base font-bold">Adhan audio</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Real Shia adhan recordings from praytimes.org — choose from
                12 reciters in Settings. The adhan plays automatically at
                each prayer time and a full-screen overlay appears with the
                prayer name, reciter and live progress.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AzanOverlay />
    </div>
  );
}
