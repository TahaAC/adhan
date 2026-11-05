// background.js - Service worker for the Shia Azan browser extension.
//
// Sets up periodic alarms to check for upcoming prayer times, then fires
// a desktop notification AND plays the adhan audio immediately through a
// hidden offscreen document (service workers can't play audio directly).
// Uses chrome.alarms (which survives service worker shutdown) instead of
// setInterval (which doesn't).

const RECITER_BASE = 'https://praytimes.org/audio/shia/';
const OFFSCREEN_URL = 'offscreen.html';
let creatingOffscreen = null;

const PRAYER_ARABIC = {
  Fajr: 'الفجر',
  Sunrise: 'الشروق',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
  Midnight: 'منتصف الليل',
};

// Check every 1 minute for prayer times that should fire.
chrome.alarms.create('check-prayers', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'check-prayers') {
    checkAndNotify();
  }
});

// Popup -> test the background adhan path exactly as it fires live.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'TEST_ADHAN') {
    (async () => {
      const { settings } = await chrome.storage.local.get('settings');
      const s = settings || {};
      await playAdhanAudio(s.reciterId || 'Moazzen-Zadeh', s.volume);
      sendResponse({ ok: true });
    })();
    return true; // async sendResponse
  }
  if (msg.type === 'STOP_ADHAN') {
    stopAdhanAudio();
    sendResponse({ ok: true });
  }
  if (msg.type === 'ADHAN_ENDED') {
    // Playback finished in the offscreen document; close it to free
    // resources. Errors are ignored (document may already be gone).
    closeOffscreenDocument();
  }
});

async function checkAndNotify() {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings || !settings.notificationsEnabled) return;
  if (!settings.location) return;
  const now = Date.now();
  const today = computeSchedule(new Date(), settings);
  const tomorrow = computeSchedule(getTomorrow(), settings);
  const all = [...today, ...tomorrow];

  const { lastNotified } = await chrome.storage.local.get('lastNotified');
  const notifiedSet = new Set(lastNotified || []);

  for (const slot of all) {
    if (!slot.timestamp) continue;
    // Fire within a 90-second window (alarms aren't exact).
    if (now >= slot.timestamp && now - slot.timestamp < 90000) {
      const key = `${slot.key}-${slot.timestamp}`;
      if (notifiedSet.has(key)) continue;
      notifiedSet.add(key);
      // Keep the set from growing forever.
      if (notifiedSet.size > 50) {
        const arr = Array.from(notifiedSet);
        notifiedSet.clear();
        arr.slice(-30).forEach((k) => notifiedSet.add(k));
      }
      await chrome.storage.local.set({ lastNotified: Array.from(notifiedSet) });

      const body = slot.isSalat
        ? `It's time for ${slot.label} (${slot.time}). Allahu Akbar.`
        : `${slot.label} at ${slot.time}.`;

      // Respect the per-prayer toggle. Default to ON if the user hasn't
      // configured it (so the extension still works on first install).
      const prayerOn = settings.prayersEnabled?.[slot.key] !== false;
      if (!prayerOn) continue;

      chrome.notifications.create(key, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: `Adhan: ${slot.label}`,
        message: body,
        priority: 2,
      });

      // Play the adhan voice at the same time as the notification.
      // Sound is played for the five salat times; sunrise and midnight
      // stay notification-only. Controlled by the "Adhan sound" setting.
      if (slot.isSalat && settings.soundEnabled !== false) {
        playAdhanAudio(settings.reciterId, settings.volume);
      }
    }
  }

  // Update the badge with the next prayer countdown.
  updateBadge(all, now, settings);
}

function updateBadge(all, now, settings) {
  // Skip prayers the user has disabled — the badge should count down
  // to the next prayer they'll actually hear.
  const enabled = all.filter((s) => {
    const on = settings?.prayersEnabled?.[s.key] !== false;
    return on;
  });
  const next = enabled.find((s) => s.timestamp > now);
  if (!next) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  const ms = next.timestamp - now;
  const mins = Math.floor(ms / 60000);
  let text;
  if (mins >= 60) {
    text = Math.floor(mins / 60) + 'h';
  } else if (mins >= 1) {
    text = mins + 'm';
  } else {
    text = 'now';
  }
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: '#d4a017' });
  chrome.action.setTitle({ title: `Next: ${next.label} at ${next.time}` });
}

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
}

// ---------- Background adhan audio (cross-browser) ----------
//
// Two playback paths, selected at runtime:
//
//  1. Chromium (Chrome / Edge / Brave / Opera / Vivaldi / Arc):
//     MV3 service workers have no DOM, so audio is played by a hidden
//     offscreen document created with reason AUDIO_PLAYBACK — which is
//     exempt from autoplay restrictions (no user gesture needed).
//
//  2. Firefox & Safari: their MV3 background pages are persistent DOM
//     pages (Firefox uses background.scripts; Safari converts via Xcode
//     and also runs a persistent page). We can play audio directly with
//     `new Audio()` — no offscreen document needed or available.

const HAS_OFFSCREEN =
  typeof chrome !== 'undefined' &&
  !!chrome.offscreen &&
  typeof chrome.offscreen.createDocument === 'function';

// Direct-audio path (Firefox / Safari). One element reused across
// prayers so the browser caches the reciter file.
let bgAudioEl = null;

async function ensureOffscreenDocument() {
  // Chrome 116+: query live contexts. Older Chrome: fall back to
  // createDocument and swallow the "single offscreen document" error.
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [OFFSCREEN_URL],
    });
    if (contexts.length > 0) return;
  }
  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }
  creatingOffscreen = chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: 'Play the adhan at prayer time alongside the notification.',
  });
  try {
    await creatingOffscreen;
  } catch (e) {
    // Already exists (race or older Chrome without getContexts).
  } finally {
    creatingOffscreen = null;
  }
}

function closeOffscreenDocument() {
  if (HAS_OFFSCREEN) chrome.offscreen.closeDocument().catch(() => {});
}

// Firefox / Safari path: play directly in the background page.
function playAudioDirect(url, volume) {
  try {
    if (!bgAudioEl) {
      bgAudioEl = new Audio();
      bgAudioEl.crossOrigin = 'anonymous';
    }
    bgAudioEl.src = url;
    bgAudioEl.volume = volume;
    bgAudioEl.loop = false;
    const p = bgAudioEl.play();
    if (p && typeof p.catch === 'function') {
      p.catch((e) => {
        console.warn('direct adhan playback blocked:', e);
      });
    }
  } catch (e) {
    console.warn('direct adhan audio failed:', e);
  }
}

function stopAudioDirect() {
  if (bgAudioEl) {
    try { bgAudioEl.pause(); } catch (e) {}
    try { bgAudioEl.currentTime = 0; } catch (e) {}
  }
}

async function playAdhanAudio(reciterId, volume) {
  try {
    const url = RECITER_BASE + (reciterId || 'Moazzen-Zadeh') + '.mp3';
    const vol = typeof volume === 'number' ? Math.max(0, Math.min(100, volume)) / 100 : 1;

    if (HAS_OFFSCREEN) {
      // Chromium path
      await ensureOffscreenDocument();
      await chrome.runtime.sendMessage({
        type: 'PLAY_ADHAN',
        url,
        volume: vol,
      });
    } else {
      // Firefox / Safari path
      playAudioDirect(url, vol);
    }
  } catch (e) {
    console.warn('background adhan failed:', e);
  }
}

function stopAdhanAudio() {
  if (HAS_OFFSCREEN) {
    chrome.runtime
      .sendMessage({ type: 'STOP_ADHAN' })
      .catch(() => {}) // offscreen document not open
      .finally(() => closeOffscreenDocument());
  } else {
    stopAudioDirect();
  }
}

function computeSchedule(date, settings) {
  if (typeof PrayTime === 'undefined') return [];
  const pt = new PrayTime(settings.method);
  pt.location([settings.location.lat, settings.location.lng]);
  pt.timezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  pt.adjust({ asr: 'Standard', highLats: 'NightMiddle' });
  pt.format(settings.timeFormat || '12h');
  const raw = pt.times(date);

  const keys = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha', 'midnight'];
  return keys.map((k) => {
    const value = raw[k];
    let timestamp = 0;
    if (typeof value === 'string' && /^\d/.test(value)) {
      const m = value.match(/(\d+):(\d+)(?:\s*([AP]M))?/);
      if (m) {
        let h = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        if (m[3] === 'PM' && h < 12) h += 12;
        if (m[3] === 'AM' && h === 12) h = 0;
        const d = new Date(date);
        d.setHours(h, min, 0, 0);
        timestamp = d.getTime();
      }
    }
    return {
      key: k,
      label: k.charAt(0).toUpperCase() + k.slice(1),
      time: value,
      timestamp,
      isSalat: k !== 'sunrise' && k !== 'midnight',
    };
  });
}

// Load the PrayTime library.
// - Chromium (service worker): uses importScripts().
// - Firefox / Safari (background.scripts): praytime.js is listed BEFORE
//   background.js in manifest.background.scripts, so PrayTime is already
//   defined globally by the time this runs — the try/catch below is a
//   no-op there.
try {
  importScripts('praytime.js');
} catch {
  // Expected on Firefox/Safari (no importScripts in background pages).
  // PrayTime is loaded via the manifest's background.scripts array.
}
