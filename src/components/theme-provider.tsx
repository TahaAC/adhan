'use client';

import { useEffect } from 'react';
import { useSettings } from '@/hooks/use-settings';

/**
 * Apply the user's theme preference to <html>. We avoid pulling in
 * next-themes to keep the bundle small and the behaviour predictable.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const apply = (mode: 'light' | 'dark') => {
      root.classList.toggle('dark', mode === 'dark');
      root.style.colorScheme = mode;
    };

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      apply(mq.matches ? 'dark' : 'light');
      const handler = (e: MediaQueryListEvent) =>
        apply(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    apply(theme);
  }, [theme]);

  return <>{children}</>;
}
