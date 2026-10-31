'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Search, LocateFixed, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSettings, type SavedLocation } from '@/hooks/use-settings';
import { geocodeCity } from '@/hooks/use-prayer-times';
import { useGeolocation } from '@/hooks/use-geolocation';
import { toast } from 'sonner';

/**
 * Quick-pick cities for one-tap selection. Prioritizes cities with deep
 * Shia significance, then major world cities.
 */
const QUICK_CITIES: SavedLocation[] = [
  { name: 'Makkah, Saudi Arabia', lat: 21.4225, lng: 39.8262, timezone: 'Asia/Riyadh' },
  { name: 'Madinah, Saudi Arabia', lat: 24.4686, lng: 39.6142, timezone: 'Asia/Riyadh' },
  { name: 'Najaf, Iraq', lat: 32.0, lng: 44.34, timezone: 'Asia/Baghdad' },
  { name: 'Karbala, Iraq', lat: 32.616, lng: 44.0249, timezone: 'Asia/Baghdad' },
  { name: 'Qom, Iran', lat: 34.6416, lng: 50.8746, timezone: 'Asia/Tehran' },
  { name: 'Mashhad, Iran', lat: 36.2605, lng: 59.6168, timezone: 'Asia/Tehran' },
  { name: 'Tehran, Iran', lat: 35.6892, lng: 51.389, timezone: 'Asia/Tehran' },
  { name: 'Damascus, Syria', lat: 33.5138, lng: 36.2765, timezone: 'Asia/Damascus' },
  { name: 'Beirut, Lebanon', lat: 33.8938, lng: 35.5018, timezone: 'Asia/Beirut' },
  { name: 'London, UK', lat: 51.5074, lng: -0.1278, timezone: 'Europe/London' },
  { name: 'Sydney, Australia', lat: -33.8688, lng: 151.2093, timezone: 'Australia/Sydney' },
  { name: 'New York, USA', lat: 40.7128, lng: -74.006, timezone: 'America/New_York' },
];

interface LocationBarProps {
  /** The location currently used for prayer calculations (may be a
   *  timezone-based default when the user hasn't picked one). */
  currentLocation: { lat: number; lng: number; name: string };
  /** Whether the current location is an automatic timezone-based
   *  default (true) or explicitly chosen by the user (false). */
  isAuto: boolean;
}

/**
 * A prominent location selector bar shown directly under the header.
 *
 * This is the PERMANENT solution to location problems:
 * - Never auto-triggers geolocation (no permission prompts on load)
 * - Shows the current location with an "auto" badge if it's a
 *   timezone-based default
 * - Expands to reveal city search + quick-pick cities + optional GPS
 * - Location is persisted to localStorage once chosen
 */
export function LocationBar({ currentLocation, isAuto }: LocationBarProps) {
  const location = useSettings((s) => s.location);
  const setLocation = useSettings((s) => s.setLocation);

  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<
    { lat: number; lng: number; name: string; timezone?: string }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-expand on first visit if no location has been set yet, so the
  // user immediately sees how to pick their city.
  useEffect(() => {
    if (!location) {
      const timer = setTimeout(() => setExpanded(true), 800);
      return () => clearTimeout(timer);
    }
  }, [location]);

  // Debounced city search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      const r = await geocodeCity(q);
      if (!cancelled) {
        setResults(r);
        setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const pickCity = (c: {
    lat: number;
    lng: number;
    name: string;
    timezone?: string;
  }) => {
    setLocation({
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      timezone: c.timezone,
    });
    setExpanded(false);
    setQuery('');
    setResults([]);
    toast.success('Location set', {
      description: `Prayer times now shown for ${c.name}. This choice is saved on this device.`,
      icon: <Check className="h-4 w-4" />,
      duration: 5000,
    });
  };

  const useMyLocation = async () => {
    setDetecting(true);
    const { detect } = useGeolocation.getState();
    const loc = await detect({ force: true });
    setDetecting(false);
    if (loc) {
      setLocation(loc);
      setExpanded(false);
      toast.success('Location set', { description: loc.name });
    }
    // On failure the geolocation store shows its own guidance toast.
  };

  const handleExpand = () => {
    setExpanded((e) => !e);
    // Focus the search input when expanding.
    if (!expanded) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card/70 shadow-sm">
      {/* Collapsed: current location + Change button */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 sm:p-4">
        <button
          onClick={handleExpand}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          aria-label="Change location"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <MapPin className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-semibold">
                {currentLocation.name}
              </span>
              {isAuto && (
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                  auto · tap to set exact
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {isAuto
                ? 'Set from your timezone. Tap to choose your exact city.'
                : 'Prayer times for this location. Tap to change.'}
            </span>
          </span>
        </button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleExpand}
          className="h-8 shrink-0"
        >
          {expanded ? (
            <>
              <X className="mr-1.5 h-3.5 w-3.5" /> Close
            </>
          ) : (
            <>
              <Search className="mr-1.5 h-3.5 w-3.5" /> Change
            </>
          )}
        </Button>
      </div>

      {/* Expanded: search + quick picks + GPS */}
      {expanded && (
        <div className="border-t border-border p-3 sm:p-4">
          {/* Search input */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any city — e.g. Najaf, Karbala, Qom, Dearborn, Toronto…"
              className="pl-9"
              aria-label="Search for a city"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Search results */}
          {results.length > 0 && (
            <ul className="thin-scrollbar mt-2 max-h-56 overflow-y-auto rounded-lg border border-border">
              {results.map((r, i) => (
                <li key={`${r.name}-${i}`}>
                  <button
                    onClick={() => pickCity(r)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/60"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {r.name}
                      </span>
                      <span className="block font-mono text-[10px] text-muted-foreground">
                        {r.lat.toFixed(3)}, {r.lng.toFixed(3)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Quick-pick cities */}
          <div className="mt-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Popular cities
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_CITIES.map((c) => (
                <button
                  key={c.name}
                  onClick={() => pickCity(c)}
                  className="rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs font-medium transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                >
                  {c.name.split(',')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* GPS option */}
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-background/40 p-2.5">
            <p className="text-[11px] text-muted-foreground">
              Want exact GPS coordinates? Use your device location
              (requires permission).
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={useMyLocation}
              disabled={detecting}
              className="h-8 shrink-0"
            >
              {detecting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <LocateFixed className="mr-1.5 h-3.5 w-3.5" />
              )}
              Use GPS
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
