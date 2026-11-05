'use client';

import { useEffect, useState } from 'react';
import { Download, X, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

/**
 * PWA install prompt. Listens for the `beforeinstallprompt` event (fired
 * by the browser when the app meets installability criteria) and shows a
 * dismissible banner inviting the user to install the app.
 *
 * On Windows/Chrome/Edge, this lets the user install the app as a
 * standalone application that launches from the Start menu. On iOS
 * Safari, the prompt is not available; users must use Share → Add to
 * Home Screen (we show a hint for that).
 */
export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  // Detect iOS Safari, standalone mode, and dismissed state synchronously
  // on first render (client-only) to avoid setState-in-effect lint
  // violations. These values are stable for the lifetime of the page,
  // so lazy initialization is safe.
  const [isIOS] = useState(() => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent;
    return (
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  });

  const [isInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches;
  });

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const dismissedAt = localStorage.getItem('pwa-install-dismissed');
      if (!dismissedAt) return false;
      const age = Date.now() - parseInt(dismissedAt, 10);
      // Re-show after 7 days.
      return age < 7 * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (e: Event) => {
      // Prevent the default browser prompt so we can show our own.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => {
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      // The appinstalled event will fire; we just clear the prompt.
    } else {
      handleDismiss();
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('pwa-install-dismissed', String(Date.now()));
    } catch {
      // ignore
    }
  };

  // Don't render if already installed, dismissed, or no prompt available
  // (and not iOS, where we'd show the manual instructions instead).
  if (isInstalled) return null;
  if (dismissed) return null;
  if (!deferredPrompt && !isIOS) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 sm:bottom-6">
      <div className="relative flex items-start gap-3 rounded-2xl border border-gold/30 bg-gradient-to-br from-emerald-deep via-emerald-mid to-emerald-deep p-4 text-white shadow-2xl">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gold/15 ring-1 ring-gold/30">
          <Monitor className="h-5 w-5 text-gold" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install Shia Azan</p>
          <p className="mt-0.5 text-xs text-white/70">
            {isIOS
              ? 'Tap the Share button, then "Add to Home Screen" to install.'
              : 'Install as a desktop app for offline access and faster launch.'}
          </p>
          <div className="mt-2.5 flex gap-2">
            {!isIOS && (
              <Button
                size="sm"
                onClick={handleInstall}
                className="bg-gold text-emerald-deep hover:bg-gold-soft"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Install
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="text-white/70 hover:bg-white/10 hover:text-white"
            >
              Not now
            </Button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
