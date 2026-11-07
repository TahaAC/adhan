// sw.js - Service Worker for Shia Azan PWA.
//
// Responsibilities:
// 1. Cache the app shell and adhan audio for offline use.
// 2. Compute prayer times ITSELF using the bundled PrayTime library
//    (so the SW can re-schedule even if the page is closed and the SW
//    was killed + restarted by the browser).
// 3. Persist settings in IndexedDB so they survive SW restarts.
// 4. When a prayer time fires:
//    a. Show a Windows toast notification (auto-dismisses after ~5s).
//    b. Try to play the adhan in an open client window via postMessage.
//    c. If no client is open, open the app window (which plays audio on
//       load) — this works after the user has installed the PWA.
// 5. Handle notification clicks to focus/open the app.
// 6. Periodic background sync re-computes and re-schedules prayer times
//    if the SW was killed and restarted by the browser.

importScripts('/praytime.js');

const CACHE_VERSION = 'shia-azan-v3';
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

// ----- IndexedDB for settings persistence -----
const DB_NAME = 'shia-azan-sw';
const DB_VERSION = 1;
const STORE_SETTINGS = 'settings';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const req = tx.objectStore(STORE_SETTINGS).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbSet(key, value) {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      tx.objectStore(STORE_SETTINGS).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

// ----- Scheduled timeouts -----
const scheduledTimeouts = new Set();
const scheduledPrayers = new Map();

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'SCHEDULE_PRAYERS') {
    // Page sent a fresh schedule + settings. Persist settings so the
    // SW can recompute on its own next time it restarts.
    if (data.settings) {
      idbSet('settings', data.settings).catch(() => {});
    }
    schedulePrayers(data.prayers || [], data.settings || {});
  } else if (data.type === 'TEST_NOTIFICATION') {
    fireTestNotification(data.settings || {});
  } else if (data.type === 'KEEP_ALIVE') {
    event.source?.postMessage({ type: 'KEEP_ALIVE_ACK' });
  } else if (data.type === 'PING') {
    // Lightweight presence check from the page.
    event.source?.postMessage({ type: 'PONG' });
  }
});

/**
 * Schedule a notification + audio playback for each upcoming prayer.
 * Clears any previously scheduled timeouts first.
 */
function schedulePrayers(prayers, settings) {
  for (const id of scheduledTimeouts) clearTimeout(id);
  scheduledTimeouts.clear();
  scheduledPrayers.clear();

  const now = Date.now();
  const horizon = 24 * 60 * 60 * 1000;

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
 * Compute prayer times IN THE SW using the bundled PrayTime library,
 * then schedule timeouts. Used when the page is closed and the SW
 * wakes up via periodic sync or activate event.
 */
async function computeAndScheduleFromStoredSettings() {
  const settings = await idbGet('settings');
  if (!settings || !settings.location) return;

  try {
    const pt = new PrayTime(settings.method || 'Tehran');
    pt.location([settings.location.lat, settings.location.lng]);
    pt.timezone(
      settings.location.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    pt.adjust({
      asr: settings.asrMethod || 'Standard',
      highLats: settings.highLats || 'NightMiddle',
    });
    pt.format('24h');

    const offsetMin = settings.azanOffsetMin || 0;
    const offsetMs = offsetMin * 60 * 1000;
    const now = Date.now();

    // Build today's + tomorrow's prayer slots, filtered by per-prayer
    // enabled setting. The page sends pre-filtered lists, but the SW
    // computes its own and must filter itself.
    const PRAYER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha', 'midnight'];
    const allSlots = [];

    for (const dayOffset of [0, 1]) {
      const date = new Date();
      date.setDate(date.getDate() + dayOffset);
      const times = pt.times(date);
      for (const k of PRAYER_KEYS) {
        const enabled = settings.azanEnabled?.[k] !== false;
        if (!enabled) continue;
        const value = times[k];
        if (typeof value !== 'string' || !/^\d/.test(value)) continue;
        const m = value.match(/(\d+):(\d+)/);
        if (!m) continue;
        const h = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        const d = new Date(date);
        d.setHours(h, min, 0, 0);
        const timestamp = d.getTime() + offsetMs;
        if (timestamp <= now) continue;
        allSlots.push({
          key: k,
          label: k.charAt(0).toUpperCase() + k.slice(1),
          time: value,
          timestamp,
          isAzan: k !== 'sunrise' && k !== 'midnight',
        });
      }
    }

    schedulePrayers(allSlots, settings);
  } catch (e) {
    // PrayTime not loaded yet, or bad settings — silently skip.
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

  const allClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  if (allClients.length > 0) {
    for (const client of allClients) {
      client.postMessage({
        type: 'PLAY_ADHAN',
        prayer,
        settings,
      });
    }
  } else if (settings.notificationsEnabled !== false) {
    try {
      await self.clients.openWindow(
        `/?playAdhan=${prayer.key}&time=${prayer.time}`,
      );
    } catch {
      // openWindow requires the SW to have been triggered by a
      // notification click or user gesture in some browsers.
    }
  }
}

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
// This is the key to "app closed" background adhan: the browser wakes
// the SW every ~12h (Chrome/Edge, controlled by the browser based on
// site engagement). When it fires, we recompute the prayer schedule
// from stored settings and re-arm the timeouts.
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'reshedule-prayers') {
    event.waitUntil(computeAndScheduleFromStoredSettings());
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

// ----- Activate: clean up old caches + re-schedule from stored settings -----
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
      // Re-schedule from stored settings — covers the case where the
      // SW was killed and the page is closed.
      await computeAndScheduleFromStoredSettings();
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
