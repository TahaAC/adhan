// popup.js - Shia Azan browser extension popup logic.
//
// Computes prayer times using the bundled PrayTime v3.2 library, shows
// the next prayer countdown, today's schedule, and Qibla direction.
// Settings are persisted via chrome.storage.local.

const RECITERS = [
  { id: 'Moazzen-Zadeh', name: 'Moazzen Zadeh' },
  { id: 'Aghati', name: 'Aghati' },
  { id: 'Ghalwash', name: 'Ghalwash' },
  { id: 'Kazem-Zadeh', name: 'Kazem Zadeh' },
  { id: 'Mohammad-Zadeh', name: 'Mohammad Zadeh' },
  { id: 'Rezaeian', name: 'Rezaeian' },
  { id: 'Rowhani-Nejad', name: 'Rowhani Nejad' },
  { id: 'Salimi', name: 'Salimi' },
  { id: 'Sharif', name: 'Sharif' },
  { id: 'Sobhdel', name: 'Sobhdel' },
  { id: 'Tasvieh-Chi', name: 'Tasviyechi' },
  { id: 'Tookhi', name: 'Tookhi' },
];

const METHODS = [
  { value: 'Tehran', label: 'Tehran (Jafari) — Shia' },
  { value: 'Jafari', label: 'Jafari (Leva) — Shia' },
  { value: 'MWL', label: 'Muslim World League' },
  { value: 'ISNA', label: 'ISNA — North America' },
  { value: 'Egypt', label: 'Egyptian Authority' },
  { value: 'Makkah', label: 'Makkah Umm al-Qura' },
  { value: 'Karachi', label: 'Karachi' },
  { value: 'France', label: 'France (18/12)' },
  { value: 'Russia', label: 'Russia' },
  { value: 'Malaysia', label: 'Malaysia (JAKIM)' },
  { value: 'Singapore', label: 'Singapore' },
];

const PRAYER_META = {
  fajr: { label: 'Fajr', arabic: 'الفجر', icon: '🌟', isSalat: true },
  sunrise: { label: 'Sunrise', arabic: 'الشروق', icon: '🌅', isSalat: false },
  dhuhr: { label: 'Dhuhr', arabic: 'الظهر', icon: '☀️', isSalat: true },
  asr: { label: 'Asr', arabic: 'العصر', icon: '🕐', isSalat: true },
  maghrib: { label: 'Maghrib', arabic: 'المغرب', icon: '🌇', isSalat: true },
  isha: { label: 'Isha', arabic: 'العشاء', icon: '🌙', isSalat: true },
  midnight: { label: 'Midnight', arabic: 'منتصف الليل', icon: '🔮', isSalat: false },
};

const KAABA = { lat: 21.4225, lng: 39.8262 };

const DEFAULT_SETTINGS = {
  method: 'Tehran',
  timeFormat: '12h',
  reciterId: 'Moazzen-Zadeh',
  notificationsEnabled: true,
  soundEnabled: true,
  volume: 90,
  location: null,
};

// --- State ---
let settings = { ...DEFAULT_SETTINGS };
let todaySchedule = [];
let tomorrowSchedule = [];
let currentLocation = null;

// --- Init ---
async function init() {
  await loadSettings();
  fillSettingsUI();
  await acquireLocation();
  computeAndRender();
  startCountdownTicker();
}

// --- Settings ---
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings'], (result) => {
      if (result.settings) {
        settings = { ...DEFAULT_SETTINGS, ...result.settings };
      }
      resolve();
    });
  });
}

async function saveSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ settings }, resolve);
  });
}

function fillSettingsUI() {
  const methodSelect = document.getElementById('method-select');
  METHODS.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.value;
    opt.textContent = m.label;
    methodSelect.appendChild(opt);
  });
  methodSelect.value = settings.method;
  methodSelect.addEventListener('change', async (e) => {
    settings.method = e.target.value;
    await saveSettings();
    computeAndRender();
  });

  const formatSelect = document.getElementById('format-select');
  formatSelect.value = settings.timeFormat;
  formatSelect.addEventListener('change', async (e) => {
    settings.timeFormat = e.target.value;
    await saveSettings();
    computeAndRender();
  });

  const reciterSelect = document.getElementById('reciter-select');
  RECITERS.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.name;
    reciterSelect.appendChild(opt);
  });
  reciterSelect.value = settings.reciterId;
  reciterSelect.addEventListener('change', async (e) => {
    settings.reciterId = e.target.value;
    await saveSettings();
  });

  const notifCheckbox = document.getElementById('notif-checkbox');
  notifCheckbox.checked = settings.notificationsEnabled;
  notifCheckbox.addEventListener('change', async (e) => {
    settings.notificationsEnabled = e.target.checked;
    await saveSettings();
    if (e.target.checked) {
      chrome.permissions.request({ permissions: ['notifications'] }, () => {});
    }
  });

  const soundCheckbox = document.getElementById('sound-checkbox');
  soundCheckbox.checked = settings.soundEnabled !== false;
  soundCheckbox.addEventListener('change', async (e) => {
    settings.soundEnabled = e.target.checked;
    await saveSettings();
  });

  const volumeRange = document.getElementById('volume-range');
  const volumeValue = document.getElementById('volume-value');
  volumeRange.value = typeof settings.volume === 'number' ? settings.volume : 90;
  volumeValue.textContent = volumeRange.value + '%';
  volumeRange.addEventListener('input', async (e) => {
    settings.volume = parseInt(e.target.value, 10);
    volumeValue.textContent = settings.volume + '%';
    await saveSettings();
  });

  // Test the background adhan exactly as it fires at prayer time
  // (notification + offscreen audio via the service worker).
  document.getElementById('test-adhan-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'TEST_ADHAN' });
  });
  document.getElementById('stop-adhan-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_ADHAN' });
  });

  document.getElementById('settings-btn').addEventListener('click', () => {
    const panel = document.getElementById('settings-panel');
    const opening = panel.style.display === 'none' || !panel.style.display;
    panel.style.display = opening ? 'block' : 'none';
    if (opening) {
      // The panel sits below the schedule, which already fills the
      // 600px popup — bring it into view so users see the options.
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  document.getElementById('open-full-app').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://praytimes.org' });
  });

  document.getElementById('refresh-loc').addEventListener('click', () => {
    settings.location = null;
    currentLocation = null;
    acquireLocation().then(() => computeAndRender());
  });
}

// --- Location ---
async function acquireLocation() {
  if (settings.location) {
    currentLocation = settings.location;
    updateLocationBar();
    return;
  }
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const name = await reverseGeocode(latitude, longitude);
        currentLocation = { lat: latitude, lng: longitude, name };
        settings.location = currentLocation;
        await saveSettings();
        updateLocationBar();
        resolve();
      },
      () => {
        // Fall back to a default (Tehran) so the popup still works.
        currentLocation = { lat: 35.6892, lng: 51.389, name: 'Tehran, Iran (default)' };
        updateLocationBar();
        resolve();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  });
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
    );
    if (!res.ok) throw new Error('geocode failed');
    const data = await res.json();
    const parts = [data.city || data.locality || data.principalSubdivision, data.countryName].filter(Boolean);
    return parts.length ? parts.join(', ') : `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  } catch {
    return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  }
}

function updateLocationBar() {
  document.getElementById('location').textContent = currentLocation?.name || 'Unknown';
}

// --- Prayer times computation ---
function computeSchedule(date) {
  if (!currentLocation) return [];
  const pt = new PrayTime(settings.method);
  pt.location([currentLocation.lat, currentLocation.lng]);
  pt.timezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  pt.adjust({ asr: 'Standard', highLats: 'NightMiddle' });
  pt.format(settings.timeFormat);
  const raw = pt.times(date);

  const keys = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha', 'midnight'];
  return keys.map((k) => {
    const meta = PRAYER_META[k];
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
    return { key: k, label: meta.label, arabic: meta.arabic, icon: meta.icon, isSalat: meta.isSalat, time: value, timestamp };
  });
}

function computeAndRender() {
  // Hijri date
  try {
    const fmt = new Intl.DateTimeFormat('en-US-u-ca-islamic', { day: 'numeric', month: 'long', year: 'numeric' });
    const hijri = fmt.format(new Date());
    const greg = new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    document.getElementById('date').textContent = `${greg} · ${hijri}`;
  } catch {
    document.getElementById('date').textContent = new Date().toLocaleDateString();
  }

  if (!currentLocation) {
    document.getElementById('next-name').textContent = '—';
    return;
  }

  const now = new Date();
  todaySchedule = computeSchedule(now);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrowSchedule = computeSchedule(tomorrow);

  renderHero();
  renderSchedule();
  renderQibla();
}

function renderHero() {
  const now = Date.now();
  const all = [...todaySchedule, ...tomorrowSchedule].filter((s) => s.timestamp > 0);
  let next = null;
  let prev = null;
  for (const slot of all) {
    if (slot.timestamp <= now) prev = slot;
    else if (!next) { next = slot; break; }
  }
  if (!next && tomorrowSchedule.length) next = tomorrowSchedule[0];

  if (!next) {
    document.getElementById('next-name').textContent = '—';
    return;
  }

  document.getElementById('next-name').textContent = next.label;
  document.getElementById('next-arabic').textContent = next.arabic;
  document.getElementById('next-time').textContent = next.time;

  // Progress
  const start = prev ? prev.timestamp : next.timestamp - 6 * 3600 * 1000;
  const span = Math.max(1, next.timestamp - start);
  const progress = Math.min(100, Math.max(0, ((now - start) / span) * 100));
  document.getElementById('progress-fill').style.width = progress + '%';
  document.getElementById('progress-text').textContent = Math.round(progress) + '% through';
}

function renderSchedule() {
  const container = document.getElementById('schedule');
  container.innerHTML = '<div class="schedule-title">Today\'s Schedule</div>';

  const now = Date.now();
  const all = [...todaySchedule, ...tomorrowSchedule].filter((s) => s.timestamp > 0);
  let nextKey = null;
  let prevKey = null;
  for (const slot of all) {
    if (slot.timestamp <= now) prevKey = slot.key;
    else if (!nextKey) { nextKey = slot.key; break; }
  }

  todaySchedule.forEach((slot) => {
    const row = document.createElement('div');
    row.className = 'prayer-row';
    if (slot.key === nextKey) row.classList.add('next');
    else if (slot.key === prevKey) row.classList.add('current');

    const badge = slot.key === nextKey
      ? '<span class="prayer-row-badge badge-next">Next</span>'
      : slot.key === prevKey
        ? '<span class="prayer-row-badge badge-now">Now</span>'
        : '';

    row.innerHTML = `
      <div class="prayer-row-info">
        <div class="prayer-row-icon">${slot.icon}</div>
        <div>
          <div class="prayer-row-name">${slot.label}${badge}</div>
          <div class="prayer-row-arabic">${slot.arabic}</div>
        </div>
      </div>
      <div class="prayer-row-time">${slot.time}</div>
    `;
    container.appendChild(row);
  });
}

function renderQibla() {
  if (!currentLocation) return;
  const bearing = qiblaBearing(currentLocation);
  const distance = distanceToKaaba(currentLocation);
  document.getElementById('qibla-bearing').textContent = bearing.toFixed(1) + '°';
  document.getElementById('qibla-distance').textContent = Math.round(distance).toLocaleString() + ' km';
}

// --- Qibla math (mirrors the web app's qibla.ts) ---
function qiblaBearing(from) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const dLat = toRad(KAABA.lat - from.lat);
  const dLng = toRad(KAABA.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(KAABA.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(KAABA.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(KAABA.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function distanceToKaaba(from) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(KAABA.lat - from.lat);
  const dLng = toRad(KAABA.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(KAABA.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// --- Countdown ticker ---
function startCountdownTicker() {
  setInterval(() => {
    if (!todaySchedule.length) return;
    const now = Date.now();
    const all = [...todaySchedule, ...tomorrowSchedule].filter((s) => s.timestamp > 0);
    let next = null;
    for (const slot of all) {
      if (slot.timestamp > now) { next = slot; break; }
    }
    if (!next) return;

    const ms = next.timestamp - now;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const pad = (n) => String(n).padStart(2, '0');
    document.getElementById('countdown').textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;

    // Update progress
    const prev = all.filter((s) => s.timestamp <= now).pop();
    const start = prev ? prev.timestamp : next.timestamp - 6 * 3600 * 1000;
    const span = Math.max(1, next.timestamp - start);
    const progress = Math.min(100, Math.max(0, ((now - start) / span) * 100));
    document.getElementById('progress-fill').style.width = progress + '%';
    document.getElementById('progress-text').textContent = Math.round(progress) + '% through';
  }, 1000);
}

// --- Boot ---
document.addEventListener('DOMContentLoaded', init);
