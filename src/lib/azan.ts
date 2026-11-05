// azan.ts - Real Shia adhan (call to prayer) audio playback.
//
// Audio files are hosted by praytimes.org (CORS-enabled, see
// https://praytimes.org/audio/shia/) and streamed on demand. We keep a
// pool of preloaded HTMLAudioElement instances so the adhan starts with
// minimal latency when a prayer time fires.
//
// On browsers that block autoplay (most modern browsers), audio playback
// is "unlocked" the first time the user interacts with the page (clicking
// the Test Azan button, opening settings, etc.) and a no-op silent play
// is performed on the master element to satisfy the user-gesture
// requirement.

export interface Reciter {
  id: string;
  name: string;
  url: string;
}

// The full list of Shia reciters provided by praytimes.org. The default
// is Moazzen-Zadeh, one of the most widely recognised voices in the
// Shia world.
export const RECITERS: Reciter[] = [
  { id: 'Moazzen-Zadeh', name: 'Moazzen Zadeh', url: 'https://praytimes.org/audio/shia/Moazzen-Zadeh.mp3' },
  { id: 'Aghati', name: 'Aghati', url: 'https://praytimes.org/audio/shia/Aghati.mp3' },
  { id: 'Ghalwash', name: 'Ghalwash', url: 'https://praytimes.org/audio/shia/Ghalwash.mp3' },
  { id: 'Kazem-Zadeh', name: 'Kazem Zadeh', url: 'https://praytimes.org/audio/shia/Kazem-Zadeh.mp3' },
  { id: 'Mohammad-Zadeh', name: 'Mohammad Zadeh', url: 'https://praytimes.org/audio/shia/Mohammad-Zadeh.mp3' },
  { id: 'Rezaeian', name: 'Rezaeian', url: 'https://praytimes.org/audio/shia/Rezaeian.mp3' },
  { id: 'Rowhani-Nejad', name: 'Rowhani Nejad', url: 'https://praytimes.org/audio/shia/Rowhani-Nejad.mp3' },
  { id: 'Salimi', name: 'Salimi', url: 'https://praytimes.org/audio/shia/Salimi.mp3' },
  { id: 'Sharif', name: 'Sharif', url: 'https://praytimes.org/audio/shia/Sharif.mp3' },
  { id: 'Sobhdel', name: 'Sobhdel', url: 'https://praytimes.org/audio/shia/Sobhdel.mp3' },
  { id: 'Tasvieh-Chi', name: 'Tasviyechi', url: 'https://praytimes.org/audio/shia/Tasvieh-Chi.mp3' },
  { id: 'Tookhi', name: 'Tookhi', url: 'https://praytimes.org/audio/shia/Tookhi.mp3' },
];

export const DEFAULT_RECITER_ID = 'Moazzen-Zadeh';

export function getReciter(id: string): Reciter {
  return RECITERS.find((r) => r.id === id) ?? RECITERS[0];
}

// ----- Audio element pool -----------------------------------------------
//
// We keep a single shared HTMLAudioElement per reciter URL. This lets the
// browser cache the file and reuse the network connection. The element is
// created lazily on first use to avoid SSR issues.

const elementCache = new Map<string, HTMLAudioElement>();

function getAudioElement(url: string): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  let el = elementCache.get(url);
  if (!el) {
    el = new Audio(url);
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    elementCache.set(url, el);
  }
  return el;
}

// Track whether audio has been unlocked by a user gesture. Browsers will
// reject programmatic play() calls until this is true.
let audioUnlocked = false;

/**
 * Mark audio as unlocked. Called from user-gesture handlers (clicks).
 * Also resumes any suspended AudioContext so the beep sound works.
 */
export function unlockAudio(): void {
  audioUnlocked = true;
  // Bump the AudioContext too so playBeep() works.
  if (typeof window !== 'undefined') {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (AC) {
      // Reuse a single context instance.
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') void ctx.resume();
    }
  }
}

export function isAudioUnlocked(): boolean {
  return audioUnlocked;
}

// ----- AudioContext (for the short beep used for non-adhan markers) -----

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// ----- Public playback API ----------------------------------------------

export interface AzanHandle {
  stop: () => void;
  durationMs: number;
  // Resolves once the audio metadata has loaded and durationMs is the
  // real duration (not the fallback estimate). Useful for the overlay
  // to update its progress bar accuracy after the file loads.
  ready: Promise<number>;
}

/**
 * Play the full adhan for the given reciter. Returns a handle that can be
 * used to stop playback early (e.g. when the user dismisses the overlay).
 *
 * `onProgress` receives a 0..1 value as the adhan plays.
 */
export function playAzan(opts?: {
  reciterId?: string;
  volume?: number;
  onProgress?: (ratio: number) => void;
}): AzanHandle {
  const reciter = getReciter(opts?.reciterId ?? DEFAULT_RECITER_ID);
  const el = getAudioElement(reciter.url);
  const vol = opts?.volume !== undefined
    ? Math.max(0, Math.min(1, opts.volume))
    : 1;
  if (!el) {
    return {
      stop: () => {},
      durationMs: 180_000,
      ready: Promise.resolve(180_000),
    };
  }

  // Reset to start.
  try {
    el.currentTime = 0;
  } catch {
    // Some browsers throw if not yet loaded; ignore.
  }
  el.volume = vol;
  el.loop = false;

  if (opts?.onProgress) {
    const handler = () => {
      const dur = el.duration && isFinite(el.duration) ? el.duration : 0;
      if (dur > 0) opts.onProgress!(el.currentTime / dur);
    };
    el.addEventListener('timeupdate', handler);
    el.addEventListener(
      'ended',
      () => el.removeEventListener('timeupdate', handler),
      { once: true },
    );
  }

  // play() returns a Promise; some browsers reject if not unlocked yet.
  const p = el.play();
  if (p && typeof p.catch === 'function') {
    p.catch(() => {
      // Autoplay blocked — caller should ensure unlockAudio() has been
      // invoked from a user gesture. We re-attempt once after a tick.
      setTimeout(() => {
        el.play().catch(() => {});
      }, 100);
    });
  }

  // Estimate duration; if unknown yet, fall back to ~3 minutes (typical adhan).
  const initialDurationMs =
    el.duration && isFinite(el.duration)
      ? el.duration * 1000
      : 180_000;

  // Resolve the real duration once metadata loads (so the overlay's
  // progress bar becomes accurate). Resolves immediately if already known.
  const ready = new Promise<number>((resolve) => {
    if (el.duration && isFinite(el.duration)) {
      resolve(el.duration * 1000);
      return;
    }
    const onLoaded = () => {
      el.removeEventListener('loadedmetadata', onLoaded);
      if (el.duration && isFinite(el.duration)) {
        resolve(el.duration * 1000);
      } else {
        resolve(180_000);
      }
    };
    el.addEventListener('loadedmetadata', onLoaded);
    // Safety timeout in case metadata never loads.
    setTimeout(() => resolve(initialDurationMs), 5000);
  });

  return {
    durationMs: initialDurationMs,
    ready,
    stop: () => {
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        // ignore
      }
    },
  };
}

/**
 * A short beep used for the Sunrise / Midnight reminders, which
 * traditionally do not use the full adhan.
 */
export async function playBeep(): Promise<void> {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const master = audioCtx.createGain();
  master.gain.setValueAtTime(0.5, audioCtx.currentTime);
  master.connect(audioCtx.destination);

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, audioCtx.currentTime);
  const t0 = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + 0.5);
  await new Promise<void>((resolve) => setTimeout(resolve, 600));
}

/**
 * Preload the audio file for a reciter so playback starts with minimal
 * latency when a prayer time fires. Safe to call multiple times.
 */
export function preloadReciter(reciterId: string): void {
  const reciter = getReciter(reciterId);
  getAudioElement(reciter.url);
}

/**
 * Set the playback volume for a reciter's cached audio element. Safe to
 * call before the element has been created (the volume is applied on
 * next play via the playAzan -> el.volume = 1 line; for live volume
 * changes during playback, this writes to the cached element directly).
 *
 * The actual `el.volume` is reset to 1 inside playAzan on each play, so
 * callers that want a non-default volume should call this *after*
 * playAzan starts playback.
 */
export function setReciterVolume(reciterId: string, volume: number): void {
  const reciter = getReciter(reciterId);
  const el = elementCache.get(reciter.url);
  if (el) {
    el.volume = Math.max(0, Math.min(1, volume));
  }
}

/**
 * Get the cached HTMLAudioElement for a reciter, or null if it hasn't
 * been created yet. Used by the scheduler to attach 'ended' listeners.
 */
export function getReciterAudioElement(reciterId: string): HTMLAudioElement | null {
  const reciter = getReciter(reciterId);
  return elementCache.get(reciter.url) ?? null;
}

/**
 * Stop playback of a specific reciter's audio, if it's currently playing.
 */
export function stopReciter(reciterId: string): void {
  const reciter = getReciter(reciterId);
  const el = elementCache.get(reciter.url);
  if (el) {
    el.pause();
    try {
      el.currentTime = 0;
    } catch {
      // ignore
    }
  }
}
