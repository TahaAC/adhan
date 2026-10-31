'use client';

import { Github, Heart } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-background/70">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <div className="flex flex-col items-center gap-1 text-center sm:flex-row sm:gap-2 sm:text-left">
          <span className="text-arabic text-base text-primary">
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </span>
          <span className="text-muted-foreground">
            · Prayer times via the PrayTime v3.2 algorithm (MIT).
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            Made with <Heart className="h-3 w-3 fill-current text-rose-500" /> for the Shia community
          </span>
          <a
            href="https://praytimes.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <Github className="h-3 w-3" />
            praytimes.org
          </a>
        </div>
      </div>
    </footer>
  );
}
