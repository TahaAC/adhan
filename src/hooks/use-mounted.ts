// use-mounted.ts - Returns true after the component has mounted on the
// client. Use this to gate rendering of time-sensitive or client-only
// content (Hijri date, prayer times, localStorage-derived state) so that
// the server-rendered HTML matches the first client render.
//
// We use useSyncExternalStore (the React-recommended pattern for
// client/server snapshot divergence) instead of useState+useEffect to
// avoid the "setState in effect" lint rule and to guarantee no
// hydration mismatch.

import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    clientSnapshot,
    serverSnapshot,
  );
}
