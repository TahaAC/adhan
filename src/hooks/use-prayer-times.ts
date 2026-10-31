// use-prayer-times.ts - Compute prayer times for today and tomorrow using
// the configured settings, and expose a structured schedule the UI can
// render directly.
//
// IMPORTANT: We use PrayTime's 'x' format to get raw Unix-ms timestamps
// (which are timezone-correct by definition), then format the display
// strings ourselves with Intl.DateTimeFormat in the configured timezone.
//
// The previous implementation parsed the formatted time string (e.g.
// "3:05 PM") back into a timestamp using Date.setHours(), which uses the
// BROWSER's local timezone — not the configured timezone. When those
// differed (e.g. user in Sydney viewing Tehran times, or vice-versa),
// the countdown was off by the timezone offset even though the displayed
// string looked correct.

import { useMemo } from 'react';
import { PrayTime, type PrayerTimes } from '@/lib/praytime';
import { useSettings, type PrayerKey } from './use-settings';

export interface PrayerSlot {
  key: PrayerKey;
  label: string;
  arabicLabel: string;
  time: string; // formatted HH:MM (12h or 24h per settings) in configured TZ
  timestamp: number; // ms epoch (UTC) — correct regardless of browser TZ
  isAzan: boolean; // full azan vs simple reminder
}

const PRAYER_META: Record<PrayerKey, { label: string; arabicLabel: string; isAzan: boolean }> = {
  fajr: { label: 'Fajr', arabicLabel: 'الفجر', isAzan: true },
  sunrise: { label: 'Sunrise', arabicLabel: 'الشروق', isAzan: false },
  dhuhr: { label: 'Dhuhr', arabicLabel: 'الظهر', isAzan: true },
  asr: { label: 'Asr', arabicLabel: 'العصر', isAzan: true },
  maghrib: { label: 'Maghrib', arabicLabel: 'المغرب', isAzan: true },
  isha: { label: 'Isha', arabicLabel: 'العشاء', isAzan: true },
  midnight: { label: 'Midnight', arabicLabel: 'منتصف الليل', isAzan: false },
};

export interface UsePrayerTimesResult {
  today: PrayerSlot[];
  tomorrow: PrayerSlot[];
  raw: { today: PrayerTimes; tomorrow: PrayerTimes };
  location: { lat: number; lng: number; name: string };
  timezone: string;
  ready: boolean;
}

/**
 * Reverse-geocode a coordinate to a human-friendly city name. We avoid
 * third-party APIs that need keys; the BigDataCloud free endpoint is
 * anonymous and reliable. Failures degrade gracefully to the lat/lng.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
    );
    if (!res.ok) throw new Error('geocode failed');
    const data = await res.json();
    const parts = [
      data.city || data.locality || data.principalSubdivision,
      data.countryName,
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  } catch {
    return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  }
}

/**
 * Look up approximate coordinates and timezone for a city name. Uses the
 * Open-Meteo geocoding API which is free and anonymous.
 */
export async function geocodeCity(
  query: string,
): Promise<{ lat: number; lng: number; name: string; timezone?: string }[]> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        query,
      )}&count=8&language=en&format=json`,
    );
    if (!res.ok) throw new Error('geocode failed');
    const data = await res.json();
    if (!data.results) return [];
    return data.results.map((r: {
      latitude: number;
      longitude: number;
      name: string;
      country?: string;
      admin1?: string;
      timezone?: string;
    }) => ({
      lat: r.latitude,
      lng: r.longitude,
      name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
      timezone: r.timezone,
    }));
  } catch {
    return [];
  }
}

/**
 * Format a Unix-ms timestamp as a time string in the given timezone,
 * using the user's preferred 12h or 24h format. This replaces PrayTime's
 * own string formatting so we have full control over the timezone.
 */
function formatTimeInTz(
  timestamp: number,
  timezone: string,
  format: '12h' | '24h',
): string {
  if (!timestamp || isNaN(timestamp)) return '-----';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: format === '12h',
      hour: format === '12h' ? 'numeric' : '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    // Invalid timezone — fall back to UTC.
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hour12: format === '12h',
      hour: format === '12h' ? 'numeric' : '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  }
}

function computeSchedule(
  pt: PrayTime,
  date: Date,
  timezone: string,
  format: '12h' | '24h',
): { raw: PrayerTimes; slots: PrayerSlot[] } {
  // Use 'x' format to get raw Unix-ms timestamps. This is critical: the
  // timestamps are timezone-correct by definition (they represent an
  // absolute moment in time), so the countdown and "next prayer" logic
  // works regardless of the browser's local timezone.
  pt.format('x');
  const raw = pt.times(date) as unknown as Record<string, number>;

  const keys: PrayerKey[] = [
    'fajr',
    'sunrise',
    'dhuhr',
    'asr',
    'maghrib',
    'isha',
    'midnight',
  ];

  const slots: PrayerSlot[] = keys.map((k) => {
    const meta = PRAYER_META[k];
    const timestamp = typeof raw[k] === 'number' ? raw[k] : 0;
    // Format the display string in the configured timezone.
    const timeStr = formatTimeInTz(timestamp, timezone, format);
    return {
      key: k,
      label: meta.label,
      arabicLabel: meta.arabicLabel,
      time: timeStr,
      timestamp,
      isAzan: meta.isAzan,
    };
  });

  // Cast back to PrayerTimes for the raw export (callers expect the
  // object shape, not the values, since we use the slots array).
  return { raw: raw as unknown as PrayerTimes, slots };
}

/**
 * Map a browser timezone to a sensible default location (lat, lng, name).
 *
 * This is the PERMANENT fallback for location: it works instantly on page
 * load with zero permissions, zero network requests, and zero errors.
 * The chosen city is in the user's timezone so prayer times always match
 * their local clock. The user can then refine it via city search.
 *
 * Covers all IANA timezones in common use. Falls back to a
 * longitude-based estimate if the timezone isn't recognized.
 */
function defaultLocationForTimezone(timezone: string): {
  lat: number;
  lng: number;
  name: string;
} {
  const map: Record<string, { lat: number; lng: number; name: string }> = {
    // --- Middle East (Shia heartland) ---
    'Asia/Tehran': { lat: 35.6892, lng: 51.389, name: 'Tehran, Iran' },
    'Asia/Baghdad': { lat: 32.0, lng: 44.34, name: 'Najaf, Iraq' },
    'Asia/Riyadh': { lat: 21.4225, lng: 39.8262, name: 'Makkah, Saudi Arabia' },
    'Asia/Dubai': { lat: 25.2048, lng: 55.2708, name: 'Dubai, UAE' },
    'Asia/Qatar': { lat: 25.2854, lng: 51.531, name: 'Doha, Qatar' },
    'Asia/Kuwait': { lat: 29.3759, lng: 47.9774, name: 'Kuwait City, Kuwait' },
    'Asia/Bahrain': { lat: 26.2285, lng: 50.586, name: 'Manama, Bahrain' },
    'Asia/Muscat': { lat: 23.588, lng: 58.3829, name: 'Muscat, Oman' },
    'Asia/Jerusalem': { lat: 31.7683, lng: 35.2137, name: 'Jerusalem' },
    'Asia/Beirut': { lat: 33.8938, lng: 35.5018, name: 'Beirut, Lebanon' },
    'Asia/Damascus': { lat: 33.5138, lng: 36.2765, name: 'Damascus, Syria' },
    'Asia/Amman': { lat: 31.9454, lng: 35.9284, name: 'Amman, Jordan' },
    'Asia/Aden': { lat: 15.3694, lng: 44.191, name: "Sana'a, Yemen" },

    // --- South & Central Asia ---
    'Asia/Karachi': { lat: 24.8607, lng: 67.0011, name: 'Karachi, Pakistan' },
    'Asia/Kolkata': { lat: 28.6139, lng: 77.209, name: 'New Delhi, India' },
    'Asia/Colombo': { lat: 6.9271, lng: 79.8612, name: 'Colombo, Sri Lanka' },
    'Asia/Dhaka': { lat: 23.8103, lng: 90.4125, name: 'Dhaka, Bangladesh' },
    'Asia/Kathmandu': { lat: 27.7172, lng: 85.324, name: 'Kathmandu, Nepal' },
    'Asia/Kabul': { lat: 34.5553, lng: 69.2075, name: 'Kabul, Afghanistan' },
    'Asia/Tashkent': { lat: 41.2995, lng: 69.2401, name: 'Tashkent, Uzbekistan' },
    'Asia/Almaty': { lat: 43.222, lng: 76.8512, name: 'Almaty, Kazakhstan' },
    'Asia/Baku': { lat: 40.4093, lng: 49.8671, name: 'Baku, Azerbaijan' },
    'Asia/Yerevan': { lat: 40.1792, lng: 44.4991, name: 'Yerevan, Armenia' },
    'Asia/Tbilisi': { lat: 41.7151, lng: 44.8271, name: 'Tbilisi, Georgia' },

    // --- Southeast Asia ---
    'Asia/Kuala_Lumpur': { lat: 3.139, lng: 101.6869, name: 'Kuala Lumpur, Malaysia' },
    'Asia/Singapore': { lat: 1.3521, lng: 103.8198, name: 'Singapore' },
    'Asia/Jakarta': { lat: -6.2088, lng: 106.8456, name: 'Jakarta, Indonesia' },
    'Asia/Bangkok': { lat: 13.7563, lng: 100.5018, name: 'Bangkok, Thailand' },
    'Asia/Manila': { lat: 14.5995, lng: 120.9842, name: 'Manila, Philippines' },
    'Asia/Ho_Chi_Minh': { lat: 10.8231, lng: 106.6297, name: 'Ho Chi Minh City, Vietnam' },
    'Asia/Saigon': { lat: 10.8231, lng: 106.6297, name: 'Ho Chi Minh City, Vietnam' },
    'Asia/Phnom_Penh': { lat: 11.5564, lng: 104.9282, name: 'Phnom Penh, Cambodia' },
    'Asia/Brunei': { lat: 4.9031, lng: 114.9398, name: 'Bandar Seri Begawan, Brunei' },

    // --- East Asia ---
    'Asia/Tokyo': { lat: 35.6762, lng: 139.6503, name: 'Tokyo, Japan' },
    'Asia/Seoul': { lat: 37.5665, lng: 126.978, name: 'Seoul, South Korea' },
    'Asia/Shanghai': { lat: 31.2304, lng: 121.4737, name: 'Shanghai, China' },
    'Asia/Hong_Kong': { lat: 22.3193, lng: 114.1694, name: 'Hong Kong' },
    'Asia/Taipei': { lat: 25.033, lng: 121.5654, name: 'Taipei, Taiwan' },

    // --- Europe ---
    'Europe/London': { lat: 51.5074, lng: -0.1278, name: 'London, UK' },
    'Europe/Dublin': { lat: 53.3498, lng: -6.2603, name: 'Dublin, Ireland' },
    'Europe/Paris': { lat: 48.8566, lng: 2.3522, name: 'Paris, France' },
    'Europe/Berlin': { lat: 52.52, lng: 13.405, name: 'Berlin, Germany' },
    'Europe/Madrid': { lat: 40.4168, lng: -3.7038, name: 'Madrid, Spain' },
    'Europe/Rome': { lat: 41.9028, lng: 12.4964, name: 'Rome, Italy' },
    'Europe/Amsterdam': { lat: 52.3676, lng: 4.9041, name: 'Amsterdam, Netherlands' },
    'Europe/Brussels': { lat: 50.8503, lng: 4.3517, name: 'Brussels, Belgium' },
    'Europe/Vienna': { lat: 48.2082, lng: 16.3738, name: 'Vienna, Austria' },
    'Europe/Zurich': { lat: 47.3769, lng: 8.5417, name: 'Zurich, Switzerland' },
    'Europe/Stockholm': { lat: 59.3293, lng: 18.0686, name: 'Stockholm, Sweden' },
    'Europe/Oslo': { lat: 59.9139, lng: 10.7522, name: 'Oslo, Norway' },
    'Europe/Copenhagen': { lat: 55.6761, lng: 12.5683, name: 'Copenhagen, Denmark' },
    'Europe/Helsinki': { lat: 60.1699, lng: 24.9384, name: 'Helsinki, Finland' },
    'Europe/Warsaw': { lat: 52.2297, lng: 21.0122, name: 'Warsaw, Poland' },
    'Europe/Prague': { lat: 50.0755, lng: 14.4378, name: 'Prague, Czechia' },
    'Europe/Budapest': { lat: 47.4979, lng: 19.0402, name: 'Budapest, Hungary' },
    'Europe/Bucharest': { lat: 44.4268, lng: 26.1025, name: 'Bucharest, Romania' },
    'Europe/Athens': { lat: 37.9838, lng: 23.7275, name: 'Athens, Greece' },
    'Europe/Lisbon': { lat: 38.7223, lng: -9.1393, name: 'Lisbon, Portugal' },
    'Europe/Moscow': { lat: 55.7558, lng: 37.6173, name: 'Moscow, Russia' },
    'Europe/Istanbul': { lat: 41.0082, lng: 28.9784, name: 'Istanbul, Turkey' },
    'Europe/Kiev': { lat: 50.4501, lng: 30.5234, name: 'Kyiv, Ukraine' },
    'Europe/Kyiv': { lat: 50.4501, lng: 30.5234, name: 'Kyiv, Ukraine' },
    'Europe/Sarajevo': { lat: 43.8563, lng: 18.4131, name: 'Sarajevo, Bosnia' },
    'Europe/Zagreb': { lat: 45.815, lng: 15.9819, name: 'Zagreb, Croatia' },
    'Europe/Belgrade': { lat: 44.7866, lng: 20.4489, name: 'Belgrade, Serbia' },
    'Europe/Sofia': { lat: 42.6977, lng: 23.3219, name: 'Sofia, Bulgaria' },

    // --- Africa ---
    'Africa/Cairo': { lat: 30.0444, lng: 31.2357, name: 'Cairo, Egypt' },
    'Africa/Lagos': { lat: 6.5244, lng: 3.3792, name: 'Lagos, Nigeria' },
    'Africa/Nairobi': { lat: -1.2921, lng: 36.8219, name: 'Nairobi, Kenya' },
    'Africa/Johannesburg': { lat: -26.2041, lng: 28.0473, name: 'Johannesburg, South Africa' },
    'Africa/Casablanca': { lat: 33.5731, lng: -7.5898, name: 'Casablanca, Morocco' },
    'Africa/Algiers': { lat: 36.7538, lng: 3.0588, name: 'Algiers, Algeria' },
    'Africa/Tunis': { lat: 36.8065, lng: 10.1815, name: 'Tunis, Tunisia' },
    'Africa/Khartoum': { lat: 15.5007, lng: 32.5599, name: 'Khartoum, Sudan' },
    'Africa/Addis_Ababa': { lat: 9.032, lng: 38.7469, name: 'Addis Ababa, Ethiopia' },
    'Africa/Dar_es_Salaam': { lat: -6.7924, lng: 39.2083, name: 'Dar es Salaam, Tanzania' },
    'Africa/Accra': { lat: 5.6037, lng: -0.187, name: 'Accra, Ghana' },
    'Africa/Dakar': { lat: 14.7167, lng: -17.4677, name: 'Dakar, Senegal' },

    // --- North America ---
    'America/New_York': { lat: 40.7128, lng: -74.006, name: 'New York, USA' },
    'America/Toronto': { lat: 43.6532, lng: -79.3832, name: 'Toronto, Canada' },
    'America/Detroit': { lat: 42.3314, lng: -83.0458, name: 'Detroit, USA' },
    'America/Chicago': { lat: 41.8781, lng: -87.6298, name: 'Chicago, USA' },
    'America/Winnipeg': { lat: 49.8951, lng: -97.1384, name: 'Winnipeg, Canada' },
    'America/Mexico_City': { lat: 19.4326, lng: -99.1332, name: 'Mexico City, Mexico' },
    'America/Denver': { lat: 39.7392, lng: -104.9903, name: 'Denver, USA' },
    'America/Phoenix': { lat: 33.4484, lng: -112.074, name: 'Phoenix, USA' },
    'America/Edmonton': { lat: 53.5461, lng: -113.4938, name: 'Edmonton, Canada' },
    'America/Los_Angeles': { lat: 34.0522, lng: -118.2437, name: 'Los Angeles, USA' },
    'America/Vancouver': { lat: 49.2827, lng: -123.1207, name: 'Vancouver, Canada' },
    'America/Anchorage': { lat: 61.2181, lng: -149.9003, name: 'Anchorage, USA' },
    'America/Halifax': { lat: 44.6488, lng: -63.5752, name: 'Halifax, Canada' },

    // --- South America ---
    'America/Sao_Paulo': { lat: -23.5505, lng: -46.6333, name: 'São Paulo, Brazil' },
    'America/Bogota': { lat: 4.711, lng: -74.0721, name: 'Bogotá, Colombia' },
    'America/Lima': { lat: -12.0464, lng: -77.0428, name: 'Lima, Peru' },
    'America/Buenos_Aires': { lat: -34.6037, lng: -58.3816, name: 'Buenos Aires, Argentina' },
    'America/Santiago': { lat: -33.4489, lng: -70.6693, name: 'Santiago, Chile' },
    'America/Caracas': { lat: 10.4806, lng: -66.9036, name: 'Caracas, Venezuela' },

    // --- Oceania ---
    'Australia/Sydney': { lat: -33.8688, lng: 151.2093, name: 'Sydney, Australia' },
    'Australia/Melbourne': { lat: -37.8136, lng: 144.9631, name: 'Melbourne, Australia' },
    'Australia/Brisbane': { lat: -27.4698, lng: 153.0251, name: 'Brisbane, Australia' },
    'Australia/Perth': { lat: -31.9505, lng: 115.8605, name: 'Perth, Australia' },
    'Australia/Adelaide': { lat: -34.9285, lng: 138.6007, name: 'Adelaide, Australia' },
    'Australia/Hobart': { lat: -42.8821, lng: 147.3272, name: 'Hobart, Australia' },
    'Australia/Darwin': { lat: -12.4634, lng: 130.8456, name: 'Darwin, Australia' },
    'Pacific/Auckland': { lat: -36.8485, lng: 174.7633, name: 'Auckland, New Zealand' },
    'Pacific/Fiji': { lat: -18.1416, lng: 178.4419, name: 'Suva, Fiji' },
  };

  if (map[timezone]) return map[timezone];

  // Fallback for unrecognized timezones: try matching the region prefix
  // (e.g. "Asia/" -> a central Asian city, "Europe/" -> central Europe).
  const region = timezone.split('/')[0];
  const regionFallbacks: Record<string, { lat: number; lng: number; name: string }> = {
    Asia: { lat: 35.6892, lng: 51.389, name: 'Tehran, Iran' },
    Europe: { lat: 48.8566, lng: 2.3522, name: 'Paris, France' },
    Africa: { lat: 30.0444, lng: 31.2357, name: 'Cairo, Egypt' },
    America: { lat: 40.7128, lng: -74.006, name: 'New York, USA' },
    Australia: { lat: -33.8688, lng: 151.2093, name: 'Sydney, Australia' },
    Pacific: { lat: -36.8485, lng: 174.7633, name: 'Auckland, New Zealand' },
    Indian: { lat: -20.3484, lng: 57.5522, name: 'Port Louis, Mauritius' },
  };
  if (regionFallbacks[region]) return regionFallbacks[region];

  // Absolute last resort: Makkah (spiritual center, reasonable default).
  return { lat: 21.4225, lng: 39.8262, name: 'Makkah, Saudi Arabia' };
}

export function usePrayerTimes(): UsePrayerTimesResult {
  const {
    method,
    asrMethod,
    highLats,
    rounding,
    timeFormat,
    location,
    tune,
  } = useSettings();

  return useMemo(() => {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // If the user has set a location, use it. Otherwise, pick a default
    // location in the browser's timezone so the displayed times match
    // the user's local clock.
    const loc = location
      ? { lat: location.lat, lng: location.lng, name: location.name }
      : defaultLocationForTimezone(browserTz);

    // The timezone used for display. If the location has an explicit
    // timezone (from city search or geocoding), use that. Otherwise use
    // the browser's timezone — which is what the user's system clock uses.
    const timezone = location?.timezone || browserTz;

    const pt = new PrayTime(method);
    pt.location([loc.lat, loc.lng]);
    pt.timezone(timezone);
    pt.adjust({ asr: asrMethod, highLats });
    pt.round(rounding);
    // Format is set inside computeSchedule to 'x' (raw timestamps).
    // We pass the user's preferred display format separately.

    if (tune && Object.keys(tune).length > 0) {
      // PrayTime's tune() expects minute offsets keyed by prayer name.
      pt.tune(tune as Partial<Record<string, number>>);
    }

    const fmt: '12h' | '24h' = timeFormat === '24h' ? '24h' : '12h';
    const today = computeSchedule(pt, new Date(), timezone, fmt);
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = computeSchedule(pt, tomorrowDate, timezone, fmt);

    return {
      today: today.slots,
      tomorrow: tomorrow.slots,
      raw: { today: today.raw, tomorrow: tomorrow.raw },
      location: loc,
      timezone,
      ready: true,
    };
  }, [
    method,
    asrMethod,
    highLats,
    rounding,
    timeFormat,
    location,
    tune,
  ]);
}
