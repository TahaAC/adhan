'use client';

import {
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGeolocation } from '@/hooks/use-geolocation';
import { useSettings } from '@/hooks/use-settings';

interface LocationBannerProps {
  onOpenSearch: () => void;
}

/**
 * Shows a banner ONLY when the user explicitly requested GPS detection
 * (via the "Use GPS" button in LocationBar or settings) and it failed.
 *
 * This component NEVER auto-triggers geolocation. The app defaults to a
 * timezone-based city instantly on load (see usePrayerTimes), so the
 * user always gets working prayer times without any permission prompts.
 */
export function LocationBanner({ onOpenSearch }: LocationBannerProps) {
  const geoStatus = useGeolocation((s) => s.status);
  const geoError = useGeolocation((s) => s.error);
  const detect = useGeolocation((s) => s.detect);
  const setLocation = useSettings((s) => s.setLocation);

  // Only render for explicit GPS failure states. The 'idle', 'loading'
  // and 'success' states never render anything.
  if (
    geoStatus === 'idle' ||
    geoStatus === 'loading' ||
    geoStatus === 'success'
  ) {
    return null;
  }

  const handleRetry = () => {
    void detect({ force: true }).then((loc) => {
      if (loc) setLocation(loc);
    });
  };

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  // Customize the message based on the failure mode.
  let title = 'GPS location failed';
  let description = geoError || 'Please pick a city manually instead.';
  let icon = <AlertTriangle className="h-4 w-4" />;
  let actions = (
    <>
      <Button size="sm" variant="outline" onClick={handleRetry} className="h-8">
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
        Retry GPS
      </Button>
      <Button size="sm" variant="ghost" onClick={onOpenSearch} className="h-8">
        <Search className="mr-1.5 h-3.5 w-3.5" />
        Pick a city
      </Button>
    </>
  );

  if (geoStatus === 'iframe-blocked') {
    title = 'GPS blocked in preview';
    description =
      'The preview iframe blocks GPS. Open the app in a new tab for GPS, or just search for your city below.';
    icon = <ExternalLink className="h-4 w-4" />;
    actions = (
      <>
        <Button size="sm" onClick={handleOpenNewTab} className="h-8">
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          Open in new tab
        </Button>
        <Button size="sm" variant="ghost" onClick={onOpenSearch} className="h-8">
          <Search className="mr-1.5 h-3.5 w-3.5" />
          Pick a city
        </Button>
      </>
    );
  } else if (geoStatus === 'denied') {
    title = 'GPS permission denied';
    description =
      'Your browser denied location access. You can still search for your city — prayer times will be accurate to the city level.';
  } else if (geoStatus === 'unavailable') {
    title = 'GPS not supported';
    description =
      "This device doesn't support GPS. Please search for your city instead.";
    actions = (
      <Button size="sm" variant="ghost" onClick={onOpenSearch} className="h-8">
        <Search className="mr-1.5 h-3.5 w-3.5" />
        Pick a city
      </Button>
    );
  } else if (geoStatus === 'insecure') {
    title = 'GPS requires HTTPS';
    description =
      'GPS only works over a secure connection. You can still search for your city.';
  } else if (geoStatus === 'timed-out' || geoStatus === 'position-unavailable') {
    title = 'GPS could not determine location';
    description =
      'Try again, or search for your city — city-level times are accurate within a few minutes.';
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 sm:p-4">
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
            {title}
          </p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </section>
  );
}
