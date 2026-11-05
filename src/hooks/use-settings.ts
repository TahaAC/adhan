// use-settings.ts - Global app settings persisted to localStorage.
//
// Holds calculation method, time format, location override, per-prayer
// azan toggles and tuning offsets. All defaults are Shia-friendly
// (Tehran method, 12h clock, asr Standard).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  PrayerMethod,
  TimeFormat,
  AsrMethod,
  HighLatsMethod,
  RoundingMethod,
} from '@/lib/praytime';
import { DEFAULT_RECITER_ID } from '@/lib/azan';

export type PrayerKey =
  | 'fajr'
  | 'sunrise'
  | 'dhuhr'
  | 'asr'
  | 'maghrib'
  | 'isha'
  | 'midnight';

export interface SavedLocation {
  name: string;
  lat: number;
  lng: number;
  timezone?: string;
}

export interface SettingsState {
  method: PrayerMethod;
  asrMethod: AsrMethod;
  highLats: HighLatsMethod;
  rounding: RoundingMethod;
  timeFormat: TimeFormat;
  location: SavedLocation | null;
  useAutoLocation: boolean;
  // Per-prayer azan / reminder toggles. Sunrise and midnight use a beep
  // reminder rather than the full azan.
  azanEnabled: Record<PrayerKey, boolean>;
  // Per-prayer minute offset (tuning). Positive = later, negative = earlier.
  tune: Partial<Record<PrayerKey, number>>;
  // Master switch for audible notifications.
  notificationsEnabled: boolean;
  // Offset (minutes) added to scheduled azan, e.g. 5 min after the time.
  azanOffsetMin: number;
  // UI theme preference ('light' | 'dark' | 'system').
  theme: 'light' | 'dark' | 'system';
  // Selected adhan reciter (one of RECITERS in lib/azan.ts).
  reciterId: string;
  // Adhan playback volume (0..1).
  azanVolume: number;

  setMethod: (m: PrayerMethod) => void;
  setAsrMethod: (m: AsrMethod) => void;
  setHighLats: (m: HighLatsMethod) => void;
  setRounding: (m: RoundingMethod) => void;
  setTimeFormat: (f: TimeFormat) => void;
  setLocation: (loc: SavedLocation | null) => void;
  setUseAutoLocation: (v: boolean) => void;
  toggleAzan: (k: PrayerKey) => void;
  setAzan: (k: PrayerKey, v: boolean) => void;
  setTune: (k: PrayerKey, mins: number) => void;
  setNotificationsEnabled: (v: boolean) => void;
  setAzanOffsetMin: (mins: number) => void;
  setTheme: (t: 'light' | 'dark' | 'system') => void;
  setReciterId: (id: string) => void;
  setAzanVolume: (v: number) => void;
  resetTuning: () => void;
}

const defaultAzan: Record<PrayerKey, boolean> = {
  fajr: true,
  sunrise: false,
  dhuhr: true,
  asr: true,
  maghrib: true,
  isha: true,
  midnight: false,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      method: 'Tehran',
      asrMethod: 'Standard',
      highLats: 'NightMiddle',
      rounding: 'nearest',
      timeFormat: '12h',
      location: null,
      useAutoLocation: true,
      azanEnabled: defaultAzan,
      tune: {},
      notificationsEnabled: true,
      azanOffsetMin: 0,
      theme: 'system',
      reciterId: DEFAULT_RECITER_ID,
      azanVolume: 1,

      setMethod: (method) => set({ method }),
      setAsrMethod: (asrMethod) => set({ asrMethod }),
      setHighLats: (highLats) => set({ highLats }),
      setRounding: (rounding) => set({ rounding }),
      setTimeFormat: (timeFormat) => set({ timeFormat }),
      setLocation: (location) => set({ location }),
      setUseAutoLocation: (useAutoLocation) => set({ useAutoLocation }),
      toggleAzan: (k) =>
        set((s) => ({
          azanEnabled: { ...s.azanEnabled, [k]: !s.azanEnabled[k] },
        })),
      setAzan: (k, v) =>
        set((s) => ({ azanEnabled: { ...s.azanEnabled, [k]: v } })),
      setTune: (k, mins) =>
        set((s) => ({ tune: { ...s.tune, [k]: mins } })),
      setNotificationsEnabled: (notificationsEnabled) =>
        set({ notificationsEnabled }),
      setAzanOffsetMin: (azanOffsetMin) => set({ azanOffsetMin }),
      setTheme: (theme) => set({ theme }),
      setReciterId: (reciterId) => set({ reciterId }),
      setAzanVolume: (azanVolume) => set({ azanVolume }),
      resetTuning: () => set({ tune: {} }),
    }),
    {
      name: 'shia-azan-settings',
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        // v1 -> v2: add reciterId and azanVolume with safe defaults.
        const s = (persisted ?? {}) as Partial<SettingsState>;
        if (version < 2) {
          return {
            ...s,
            reciterId: s.reciterId ?? DEFAULT_RECITER_ID,
            azanVolume: s.azanVolume ?? 1,
          } as SettingsState;
        }
        return s as SettingsState;
      },
    },
  ),
);
