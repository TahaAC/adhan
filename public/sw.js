// sw.js - Service Worker for Shia Azan PWA.
//
// Responsibilities:
// 1. Cache the app shell and adhan audio for offline use.
// 2. Receive the prayer schedule from the page and schedule exact
//    timeouts for each upcoming prayer.
// 3. When a prayer time fires:
//    a. Show a Windows toast notification (auto-dismisses after ~5s).
//    b. Try to play the adhan in an open client window via postMessage.
//    c. If no client is open, open the app window (which plays audio on
//       load) — this works after the user has installed the PWA.
// 4. Handle notification clicks to focus/open the app.
// 5. Periodic background sync re-schedules prayer times if the SW was
//    killed and restarted by the browser.

const CACHE_VERSION = 'shia-azan-v2';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const AUDIO_CACHE = `${CACHE_VERSION}-audio`;

const APP_SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/praytime.js',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon-32.png',
];

// ----- Scheduled timeouts -----
// We keep track of pending timeouts so we can clear and re-schedule when
// the page sends an updated schedule. The browser may kill an idle SW
// after ~30s, but active `setTimeout` callbacks keep it alive.
const scheduledTimeouts = new Set();
const scheduledPrayers = new Map(); // key -> prayer slot

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'SCHEDULE_PRAYERS') {
    schedulePrayers(data.prayers || [], data.settings || {});
  } else if (data.type === 'TEST_NOTIFICATION') {
    fireTestNotification(data.settings || {});
  } else if (data.type === 'KEEP_ALIVE') {
    // The page sends this every 20s to keep the SW alive so the
    // scheduled timeouts don't get garbage-collected. We just respond
    // so the page knows the SW is still active.
    event.source?.postMessage({ type: 'KEEP_ALIVE_ACK' });
  }
});

/**
 * Schedule a notification + audio playback for each upcoming prayer.
 * Clears any previously scheduled timeouts first.
 */
function schedulePrayers(prayers, settings) {
  // Clear existing
  for (const id of scheduledTimeouts) clearTimeout(id);
  scheduledTimeouts.clear();
  scheduledPrayers.clear();

  const now = Date.now();
  const horizon = 24 * 60 * 60 * 1000; // schedule up to 24h ahead

  for (const prayer of prayers) {
    if (!prayer.timestamp) continue;
    const delay = prayer.timestamp - now;
    if (delay <= 0 || delay > horizon) continue;

    const key = `${prayer.key}-${prayer.timestamp}`;
    scheduledPrayers.set(key, prayer);

    const id = setTimeout(() => {
      firePrayerNotification(prayer, settings).catch(() => {});
      scheduledTimeouts.delete(id);
      scheduledPrayers.delete(key);
    }, delay);
    scheduledTimeouts.add(id);
  }
}

/**
 * Fire a Windows toast notification + trigger audio playback.
 */
async function firePrayerNotification(prayer, settings) {
  const title = `Adhan: ${prayer.label}`;
  const body = prayer.isAzan
    ? `It's time for ${prayer.label} (${prayer.time}). Allahu Akbar.`
    : `${prayer.label} at ${prayer.time}.`;

  // Show the toast notification. On Windows this appears as a banner
  // in the bottom-right corner for ~5 seconds, then moves to the
  // Action Center. `requireInteraction: false` (default) means it
  // auto-dismisses.
  try {
    await self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `prayer-${prayer.key}`,
      renotify: true,
      requireInteraction: false,
      silent: false,
      data: { prayer, settings },
    });
  } catch {
    // Notification permission may have been revoked.
  }

  // Try to play audio in an existing client window.
  const allClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  if (allClients.length > 0) {
    // Send to the first available client. The page will play the adhan
    // and show the overlay.
    for (const client of allClients) {
      client.postMessage({
        type: 'PLAY_ADHAN',
        prayer,
        settings,
      });
    }
  } else if (settings.notificationsEnabled !== false) {
    // No client open. Open the app in a new window — the app will
    // detect on load that it should play the adhan for this prayer.
    // This works reliably after the PWA is installed.
    try {
      await self.clients.openWindow(
        `/?playAdhan=${prayer.key}&time=${prayer.time}`,
      );
    } catch {
      // openWindow requires the SW to have been triggered by a
      // notification click or user gesture in some browsers. If it
      // fails, the notification alone still serves as the alert.
    }
  }
}

/**
 * Fire a test notification (used by the "Test notification" button).
 */
async function fireTestNotification(settings) {
  try {
    await self.registration.showNotification('Shia Azan — Test', {
      body: 'This is how adhan notifications will appear. You will hear the adhan and see this banner at each prayer time.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'test-notification',
      requireInteraction: false,
    });
  } catch {
    // ignore
  }
}

// ----- Notification click: focus or open the app -----
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if (client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      try {
        return await self.clients.openWindow('/');
      } catch {
        // ignore
      }
    })(),
  );
});

// ----- Periodic Background Sync: re-schedule when SW restarts -----
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'reshedule-prayers') {
    event.waitUntil(
      (async () => {
        // Ask any open client to re-send the prayer schedule.
        const allClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        for (const client of allClients) {
          client.postMessage({ type: 'RESEND_SCHEDULE' });
        }
      })(),
    );
  }
});

// ----- Install: precache app shell -----
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      await Promise.all(
        APP_SHELL_ASSETS.map(async (url) => {
          try {
            await cache.add(url);
          } catch {
            // Asset may not exist yet; skip.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

// ----- Activate: clean up old caches -----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith('shia-azan-') &&
              key !== APP_SHELL_CACHE &&
              key !== AUDIO_CACHE,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// ----- Fetch: route requests to the right caching strategy -----
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isPraytimesAudio =
    url.hostname === 'praytimes.org' && url.pathname.startsWith('/audio/');
  const isGoogleFonts =
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (!isSameOrigin && !isPraytimesAudio && !isGoogleFonts) return;

  if (isPraytimesAudio) {
    event.respondWith(cacheFirst(request, AUDIO_CACHE));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, APP_SHELL_CACHE));
});

// ----- Caching strategies -----

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(APP_SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return (
      cache.match('/') ||
      new Response('Offline', { status: 503, statusText: 'Offline' })
    );
  }
}
