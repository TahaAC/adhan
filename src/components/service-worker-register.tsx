'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker for offline support and background
 * notifications. Only runs in production builds (not during `next dev`)
 * to avoid caching stale development assets.
 *
 * Also registers a Periodic Background Sync so the SW wakes up
 * periodically to re-schedule prayer-time notifications (in case the
 * browser killed and restarted the SW).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Don't register in dev — the SW would cache the dev bundle and
    // break hot reload.
    if (process.env.NODE_ENV !== 'production') return;

    let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        // Register periodic background sync so the SW re-schedules
        // prayer times if it gets killed and restarted by the browser.
        // The 'periodicsync' event fires at the browser's discretion
        // (minimum interval is browser-controlled, typically hours).
        const anyReg = reg as ServiceWorkerRegistration & {
          periodicSync?: {
            register: (
              tag: string,
              options?: { minInterval?: number },
            ) => Promise<void>;
          };
        };
        if (anyReg.periodicSync) {
          try {
            await anyReg.periodicSync.register('reshedule-prayers', {
              minInterval: 12 * 60 * 60 * 1000, // 12 hours
            });
          } catch {
            // Permission denied or not supported — the page-side
            // scheduler still works while the app is open.
          }
        }

        // Keep-alive ping: the page sends a message every 20s so the
        // SW doesn't get killed by the browser while there are pending
        // prayer-time timeouts. This is essential for the SW to fire
        // notifications at the exact prayer time.
        keepAliveInterval = setInterval(() => {
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'KEEP_ALIVE',
            });
          }
        }, 20_000);

        // Check for updates every hour.
        setInterval(() => {
          reg.update().catch(() => {});
        }, 60 * 60 * 1000);
      } catch {
        // Registration failed — app still works online, just no
        // background notifications.
      }
    };

    if (document.readyState === 'complete') {
      void register();
    } else {
      window.addEventListener('load', register, { once: true });
    }

    return () => {
      if (keepAliveInterval) clearInterval(keepAliveInterval);
    };
  }, []);

  return null;
}
