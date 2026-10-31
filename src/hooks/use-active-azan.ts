// use-active-azan.ts - Tiny Zustand store that tracks the currently
// playing adhan so any component (the overlay, the hero card, the
// schedule list) can react to it. Decoupled from the main settings store
// because this state is ephemeral and shouldn't be persisted.

import { create } from 'zustand';
import type { PrayerSlot } from './use-prayer-times';

export interface ActiveAzan {
  slot: PrayerSlot;
  startedAt: number;
  // Estimated duration in ms. Real adhan recordings are ~3 minutes.
  durationMs: number;
}

interface ActiveAzanState {
  active: ActiveAzan | null;
  start: (slot: PrayerSlot, durationMs: number) => void;
  stop: () => void;
}

export const useActiveAzan = create<ActiveAzanState>((set) => ({
  active: null,
  start: (slot, durationMs) =>
    set({ active: { slot, startedAt: Date.now(), durationMs } }),
  stop: () => set({ active: null }),
}));
