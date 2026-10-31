// background.js - Service worker for the Shia Azan browser extension.
//
// Sets up periodic alarms to check for upcoming prayer times and fire
// desktop notifications. Uses chrome.alarms (which survives service
// worker shutdown) instead of setInterval (which doesn't).

const RECITER_BASE = 'https://praytimes.org/audio/shia/';

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

      chrome.notifications.create(key, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: `Adhan: ${slot.label}`,
        message: body,
        priority: 2,
      });

      // Optionally play the adhan audio via an offscreen document
      // (service workers can't play audio directly). We skip this in
      // the extension for simplicity — the notification + badge is
      // sufficient. Users can click the popup to play the adhan.
    }
  }

  // Update the badge with the next prayer countdown.
  updateBadge(all, now);
}

function updateBadge(all, now) {
  const next = all.find((s) => s.timestamp > now);
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

// Import the PrayTime library in the service worker context.
// chrome.service workers can use importScripts.
try {
  importScripts('praytime.js');
} catch {
  // In MV3, importScripts works only in the service worker entry.
  // If it fails, computeSchedule will return [] gracefully.
}
