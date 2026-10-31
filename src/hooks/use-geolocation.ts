// use-geolocation.ts - Detect the user's geographic location with
// proper error handling and status tracking.
//
// Browsers restrict the Geolocation API in several ways:
// - Requires a secure context (HTTPS or localhost)
// - Requires explicit user permission
// - Blocked inside cross-origin iframes unless the parent page adds
//   `allow="geolocation"` to the <iframe> tag
//
// State is kept in a Zustand store so multiple components (banner,
// header, settings panel) can read/share it without prop drilling.
//
// IMPORTANT: This module includes guards to prevent the "toast spam"
// bug where the same error toast was shown repeatedly. The `detect()`
// function refuses to run if a detection is already in progress, and
// duplicate error toasts are suppressed within a 10-second window.

import { create } from 'zustand';
import { reverseGeocode } from './use-prayer-times';
import type { SavedLocation } from './use-settings';
import { toast } from 'sonner';

export type GeoStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'denied' // user denied permission
  | 'unavailable' // device/browser doesn't support geolocation
  | 'iframe-blocked' // running in an iframe without allow="geolocation"
  | 'insecure' // not HTTPS and not localhost
  | 'timed-out'
  | 'position-unavailable' // GPS/network issue
  | 'error'; // other error

interface GeoState {
  status: GeoStatus;
  location: SavedLocation | null;
  error?: string;
  /** Detect location. Returns the detected location or null on failure.
   *  If a detection is already in progress, returns null immediately
   *  without starting a new one. Pass `force: true` to bypass the guard
   *  (used by the manual "Retry" button). */
  detect: (opts?: {
    onSuccess?: (loc: SavedLocation) => void;
    force?: boolean;
  }) => Promise<SavedLocation | null>;
  reset: () => void;
}

/**
 * Detect if we're running inside an iframe. Geolocation is blocked in
 * cross-origin iframes unless the parent grants permission via the
 * `allow="geolocation"` attribute.
 */
function isInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin access throws — we're definitely in an iframe.
    return true;
  }
}

/**
 * Check if the current context is "secure" (HTTPS or localhost).
 * Geolocation API only works in secure contexts.
 */
function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.isSecureContext === 'boolean') {
    return window.isSecureContext;
  }
  return (
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
}

// --- Toast deduplication ---
// Track the last error we showed a toast for, and when. We suppress
// duplicate toasts within a 10-second window to prevent spam.
let lastToastStatus: GeoStatus | null = null;
let lastToastTime = 0;
const TOAST_DEBOUNCE_MS = 10_000;

function showErrorToast(status: GeoStatus, message: string) {
  const now = Date.now();
  if (status === lastToastStatus && now - lastToastTime < TOAST_DEBOUNCE_MS) {
    // Same error was shown recently — suppress duplicate.
    return;
  }
  lastToastStatus = status;
  lastToastTime = now;

  if (status === 'denied') {
    toast.error('Location permission denied', {
      description:
        'Click the lock icon in your browser address bar to allow location access, then reload.',
    });
  } else if (status === 'iframe-blocked') {
    toast.error('Location blocked in preview', {
      description:
        'Open the app in a new tab to enable location detection.',
      action: {
        label: 'Open in new tab',
        onClick: () => window.open(window.location.href, '_blank'),
      },
    });
  } else if (status === 'timed-out') {
    toast.error('Location timed out', {
      description:
        'Could not determine your location in time. Try again or pick a city manually.',
    });
  } else if (status === 'position-unavailable') {
    toast.error('Position unavailable', {
      description:
        'Your device could not determine its position. Try again or pick a city manually.',
    });
  } else if (status === 'unavailable') {
    toast.error('Geolocation not supported', {
      description:
        "Your browser doesn't support location detection. Please pick a city manually.",
    });
  } else if (status === 'insecure') {
    toast.error('Location requires HTTPS', {
      description: 'Geolocation only works over a secure connection.',
    });
  }
}

export const useGeolocation = create<GeoState>((set, get) => ({
  status: 'idle',
  location: null,

  detect: async (opts) => {
    const onSuccess = opts?.onSuccess;
    const force = opts?.force ?? false;

    // Guard: don't start a new detection if one is already in progress.
    // This prevents the "toast spam" bug where multiple components or
    // effect re-runs trigger detect() simultaneously.
    if (get().status === 'loading' && !force) {
      return null;
    }

    // Pre-flight checks — give specific error messages for each case.
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      set({ status: 'unavailable', error: 'Geolocation not supported' });
      showErrorToast('unavailable', 'Geolocation not supported');
      return null;
    }

    if (!isSecureContext()) {
      set({ status: 'insecure', error: 'Geolocation requires HTTPS' });
      showErrorToast('insecure', 'Geolocation requires HTTPS');
      return null;
    }

    // If we're in an iframe, geolocation may be blocked. Try anyway —
    // some preview environments do allow it — but be ready to show a
    // helpful message if it fails.
    const inIframe = isInIframe();

    set({ status: 'loading', error: undefined });

    return new Promise<SavedLocation | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          const name = await reverseGeocode(latitude, longitude);
          const loc: SavedLocation = {
            name,
            lat: latitude,
            lng: longitude,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          };
          set({ status: 'success', location: loc });
          // Reset toast dedup on success so future errors can show.
          lastToastStatus = null;
          onSuccess?.(loc);
          resolve(loc);
        },
        (err) => {
          let status: GeoStatus = 'error';
          let message = err.message || 'Unknown error';

          switch (err.code) {
            case err.PERMISSION_DENIED:
              status = inIframe ? 'iframe-blocked' : 'denied';
              message = inIframe
                ? 'Geolocation is blocked in this iframe. Open the app in a new tab.'
                : 'Location permission was denied.';
              break;
            case err.POSITION_UNAVAILABLE:
              status = 'position-unavailable';
              message = 'Position unavailable. Check your GPS or network.';
              break;
            case err.TIMEOUT:
              status = 'timed-out';
              message = 'Location request timed out.';
              break;
          }

          set({ status, error: message });
          showErrorToast(status, message);
          resolve(null);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 5 * 60 * 1000,
        },
      );
    });
  },

  reset: () => {
    set({ status: 'idle', error: undefined, location: null });
    lastToastStatus = null;
  },
}));
