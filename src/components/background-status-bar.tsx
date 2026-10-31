'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, ShieldCheck, ShieldAlert, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/use-settings';
import { toast } from 'sonner';

interface BackgroundStatusBarProps {
  onTestNotification: () => void;
}

/**
 * Shows the status of background notifications and lets the user
 * enable/test them. Displays one of three states:
 *
 * 1. Notifications not enabled — prompt to enable
 * 2. Permission not granted — prompt to grant
 * 3. All set — confirmation with a "Test" button
 *
 * This bar is dismissible and stays hidden once the user has confirmed
 * everything works.
 */
export function BackgroundStatusBar({ onTestNotification }: BackgroundStatusBarProps) {
  const notificationsEnabled = useSettings((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useSettings(
    (s) => s.setNotificationsEnabled,
  );

  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined') return 'default';
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [dismissed, setDismissed] = useState(false);

  // Listen for permission changes (e.g. if the user changes it in the
  // browser settings while the page is open).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (typeof navigator === 'undefined' || !navigator.permissions) return;
    let cancelled = false;
    navigator.permissions
      .query({ name: 'notifications' as PermissionName })
      .then((status) => {
        const handler = () => {
          if (!cancelled && typeof Notification !== 'undefined') {
            setPermission(Notification.permission);
          }
        };
        status.addEventListener('change', handler);
        // Cleanup is best-effort — the status object may be GC'd.
        return () => status.removeEventListener('change', handler);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Don't render if dismissed or if everything is set up correctly.
  if (dismissed) return null;

  const isUnsupported = permission === 'unsupported';
  const isGranted = permission === 'granted';
  const isDenied = permission === 'denied';

  // If everything is good and the user has tested, hide the bar.
  if (isGranted && notificationsEnabled) {
    // Still show a slim confirmation bar with a Test button.
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 sm:p-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              Background adhan is active
            </p>
            <p className="text-xs text-muted-foreground">
              Windows toast notifications + adhan audio will fire at each
              prayer time, even when the app is minimized.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onTestNotification}
            className="h-8"
          >
            <Bell className="mr-1.5 h-3.5 w-3.5" />
            Test notification
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDismissed(true)}
            className="h-8 text-muted-foreground"
          >
            Hide
          </Button>
        </div>
      </section>
    );
  }

  // Permission denied — show how to fix it.
  if (isDenied) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 sm:p-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              Notifications are blocked
            </p>
            <p className="text-xs text-muted-foreground">
              To enable background adhan, click the lock icon in your
              browser&apos;s address bar and allow notifications, then
              reload this page.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDismissed(true)}
          className="h-8 text-muted-foreground"
        >
          Dismiss
        </Button>
      </section>
    );
  }

  // Unsupported browser.
  if (isUnsupported) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-3 sm:p-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground">
            <BellOff className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Background notifications not supported</p>
            <p className="text-xs text-muted-foreground">
              Your browser doesn&apos;t support push notifications. The
              adhan will still play when the app is open.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDismissed(true)}
          className="h-8 text-muted-foreground"
        >
          Dismiss
        </Button>
      </section>
    );
  }

  // Default state: prompt to enable.
  const handleEnable = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        setNotificationsEnabled(true);
        toast.success('Background adhan enabled', {
          description: 'You will see a Windows toast and hear the adhan at each prayer time.',
        });
        // Fire a test notification so the user sees what it looks like.
        setTimeout(onTestNotification, 500);
      } else if (result === 'denied') {
        toast.error('Notifications blocked', {
          description: 'You can change this later in your browser settings.',
        });
      }
    } catch {
      // ignore
    }
  };

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 sm:p-4">
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary">
          <Bell className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            Enable background adhan notifications
          </p>
          <p className="text-xs text-muted-foreground">
            Get a Windows toast banner + adhan audio at each prayer time,
            even when the app is closed or minimized.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleEnable} className="h-8">
          <Volume2 className="mr-1.5 h-3.5 w-3.5" />
          Enable
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDismissed(true)}
          className="h-8 text-muted-foreground"
        >
          Not now
        </Button>
      </div>
    </section>
  );
}
