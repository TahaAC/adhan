'use client';

import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  LocateFixed,
  Loader2,
  RotateCcw,
  MapPin,
  Check,
  Play,
  Square,
} from 'lucide-react';
import { useSettings, type PrayerKey, type SavedLocation } from '@/hooks/use-settings';
import {
  geocodeCity,
  reverseGeocode,
} from '@/hooks/use-prayer-times';
import type {
  PrayerMethod,
  AsrMethod,
  HighLatsMethod,
  RoundingMethod,
  TimeFormat,
} from '@/lib/praytime';
import { RECITERS, playAzan, unlockAudio, getReciterAudioElement } from '@/lib/azan';
import { useActiveAzan } from '@/hooks/use-active-azan';
import { useGeolocation } from '@/hooks/use-geolocation';
import { toast } from 'sonner';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const PRAYER_KEYS: PrayerKey[] = [
  'fajr',
  'sunrise',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
  'midnight',
];

const PRAYER_LABELS: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: 'Fajr', ar: 'الفجر' },
  sunrise: { en: 'Sunrise', ar: 'الشروق' },
  dhuhr: { en: 'Dhuhr', ar: 'الظهر' },
  asr: { en: 'Asr', ar: 'العصر' },
  maghrib: { en: 'Maghrib', ar: 'المغرب' },
  isha: { en: 'Isha', ar: 'العشاء' },
  midnight: { en: 'Midnight', ar: 'منتصف الليل' },
};

const METHODS: { value: PrayerMethod; label: string; note: string }[] = [
  { value: 'Tehran', label: 'Tehran (Jafari)', note: 'Shia Ithna Ashari — recommended' },
  { value: 'Jafari', label: 'Jafari (Leva)', note: 'Shia, lower fajr angle' },
  { value: 'MWL', label: 'Muslim World League', note: 'Sunni, widely used' },
  { value: 'ISNA', label: 'ISNA', note: 'North America' },
  { value: 'Egypt', label: 'Egyptian Authority', note: 'Egypt & Sudan' },
  { value: 'Makkah', label: 'Makkah Umm al-Qura', note: 'Saudi Arabia' },
  { value: 'Karachi', label: 'Karachi (Univ. of Karachi)', note: 'Pakistan, India' },
  { value: 'France', label: 'France (18°/12°)', note: 'France, parts of Europe' },
  { value: 'Russia', label: 'Russia', note: 'Russia & CIS' },
  { value: 'Malaysia', label: 'Malaysia (JAKIM)', note: 'Malaysia, Brunei' },
  { value: 'Singapore', label: 'Singapore', note: 'Singapore' },
];

interface CityResult {
  lat: number;
  lng: number;
  name: string;
  timezone?: string;
}

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const s = useSettings();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [detecting, setDetecting] = useState(false);

  // Debounced city search. We avoid synchronous setState in the effect
  // body: the "searching" flag is updated inside the timeout callback
  // (which counts as an async setState, allowed by the lint rule).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
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

  const detectLocation = async () => {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation not supported on this device.');
      return;
    }
    setDetecting(true);
    // Use the shared geolocation store so the status is consistent
    // across the banner, header, and settings panel. Pass force: true
    // so the manual button always retries even if a previous attempt
    // failed.
    const { detect } = useGeolocation.getState();
    const loc = await detect({ force: true });
    setDetecting(false);
    if (loc) {
      s.setLocation(loc);
      s.setUseAutoLocation(true);
      toast.success('Location detected', { description: loc.name });
    }
    // If detect() returned null, the store already showed an error toast
    // with specific guidance (permission denied, iframe blocked, etc.).
  };

  const pickCity = (c: CityResult) => {
    s.setLocation({
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      timezone: c.timezone,
    });
    s.setUseAutoLocation(false);
    setQuery('');
    setResults([]);
    toast.success('Location updated', { description: c.name });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="font-kufi text-lg">Settings</SheetTitle>
          <SheetDescription>
            Calculation method, location and per-prayer azan.
          </SheetDescription>
        </SheetHeader>

        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-6 px-5 py-5">
            {/* LOCATION */}
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Location</h3>
                <p className="text-xs text-muted-foreground">
                  Used for all prayer time calculations.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 p-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <span className="truncate">
                      {s.location?.name || 'No location set'}
                    </span>
                  </p>
                  {s.location && (
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {s.location.lat.toFixed(4)}, {s.location.lng.toFixed(4)}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={detectLocation}
                  disabled={detecting}
                >
                  {detecting ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LocateFixed className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Detect
                </Button>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search city, e.g. Najaf, Karbala, Qom…"
                  className="pl-9"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>

              {results.length > 0 && (
                <ul className="max-h-60 overflow-y-auto rounded-lg border border-border bg-background/60">
                  {results.map((r, i) => (
                    <li key={`${r.name}-${i}`}>
                      <button
                        onClick={() => pickCity(r)}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/60"
                      >
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {r.name}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {r.lat.toFixed(3)}, {r.lng.toFixed(3)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 p-3">
                <div>
                  <p className="text-sm font-medium">Auto-detect on launch</p>
                  <p className="text-xs text-muted-foreground">
                    Re-use device GPS each time you open the app.
                  </p>
                </div>
                <Switch
                  checked={s.useAutoLocation}
                  onCheckedChange={s.setUseAutoLocation}
                />
              </div>
            </section>

            {/* CALCULATION */}
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Calculation Method</h3>
                <p className="text-xs text-muted-foreground">
                  Defaults to Tehran (Jafari) for Shia Muslims.
                </p>
              </div>
              <Select
                value={s.method}
                onValueChange={(v) => s.setMethod(v as PrayerMethod)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex flex-col">
                        <span>{m.label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {m.note}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Asr Method</Label>
                  <Select
                    value={s.asrMethod}
                    onValueChange={(v) => s.setAsrMethod(v as AsrMethod)}
                  >
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard">Standard (Shafi'i)</SelectItem>
                      <SelectItem value="Hanafi">Hanafi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">High Latitudes</Label>
                  <Select
                    value={s.highLats}
                    onValueChange={(v) =>
                      s.setHighLats(v as HighLatsMethod)
                    }
                  >
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NightMiddle">Night Middle</SelectItem>
                      <SelectItem value="OneSeventh">One Seventh</SelectItem>
                      <SelectItem value="AngleBased">Angle Based</SelectItem>
                      <SelectItem value="None">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Time Format</Label>
                  <Select
                    value={s.timeFormat}
                    onValueChange={(v) => s.setTimeFormat(v as TimeFormat)}
                  >
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                      <SelectItem value="24h">24-hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Rounding</Label>
                  <Select
                    value={s.rounding}
                    onValueChange={(v) =>
                      s.setRounding(v as RoundingMethod)
                    }
                  >
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nearest">Nearest minute</SelectItem>
                      <SelectItem value="up">Always up</SelectItem>
                      <SelectItem value="down">Always down</SelectItem>
                      <SelectItem value="none">None (exact)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* AZAN TOGGLES */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Azan & Reminders</h3>
                  <p className="text-xs text-muted-foreground">
                    Master switch and per-prayer settings.
                  </p>
                </div>
                <Switch
                  checked={s.notificationsEnabled}
                  onCheckedChange={s.setNotificationsEnabled}
                />
              </div>

              <div className="space-y-1 rounded-lg border border-border bg-background/60 p-2">
                {PRAYER_KEYS.map((k) => {
                  const meta = PRAYER_LABELS[k];
                  const on = s.azanEnabled[k];
                  return (
                    <div
                      key={k}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/40"
                    >
                      <div>
                        <p className="text-sm font-medium">{meta.en}</p>
                        <p className="text-arabic text-xs text-muted-foreground">
                          {meta.ar}
                        </p>
                      </div>
                      <Switch
                        checked={on}
                        onCheckedChange={(v) => s.setAzan(k, v)}
                      />
                    </div>
                  );
                })}
              </div>
            </section>

            {/* RECITER & VOLUME */}
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Adhan Reciter</h3>
                <p className="text-xs text-muted-foreground">
                  Real Shia adhan recordings from praytimes.org.
                </p>
              </div>

              <Select
                value={s.reciterId}
                onValueChange={(v) => {
                  s.setReciterId(v);
                  // Preload the new reciter's audio so playback is instant
                  // when the next prayer time fires.
                  unlockAudio();
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECITERS.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="rounded-lg border border-border bg-background/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-xs">Volume</Label>
                  <span className="font-mono text-xs tabular-nums">
                    {Math.round(s.azanVolume * 100)}%
                  </span>
                </div>
                <Slider
                  value={[Math.round(s.azanVolume * 100)]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={(v) => s.setAzanVolume(v[0] / 100)}
                  aria-label="Adhan volume"
                />
              </div>

              <div className="flex gap-2">
                <ReciterPreviewButton
                  reciterId={s.reciterId}
                  volume={s.azanVolume}
                  variant="play"
                />
                <ReciterPreviewButton
                  reciterId={s.reciterId}
                  volume={s.azanVolume}
                  variant="stop"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                The first tap also unlocks audio so the adhan can play
                automatically at prayer times. Browsers block autoplay
                until you interact with the page at least once.
              </p>
            </section>

            {/* TUNING */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Tuning (offsets)</h3>
                  <p className="text-xs text-muted-foreground">
                    Shift each prayer by a few minutes if needed.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={s.resetTuning}
                  className="h-7"
                >
                  <RotateCcw className="mr-1 h-3 w-3" /> Reset
                </Button>
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
                {PRAYER_KEYS.map((k) => {
                  const meta = PRAYER_LABELS[k];
                  const val = s.tune[k] ?? 0;
                  return (
                    <div key={k} className="grid grid-cols-[80px_1fr_50px] items-center gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{meta.en}</p>
                      </div>
                      <Slider
                        value={[val]}
                        min={-15}
                        max={15}
                        step={1}
                        onValueChange={(v) => s.setTune(k, v[0])}
                        aria-label={`Tune ${meta.en}`}
                      />
                      <span className="text-right font-mono text-xs tabular-nums">
                        {val > 0 ? '+' : ''}
                        {val}m
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* AZAN OFFSET */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Azan Delay</h3>
                  <p className="text-xs text-muted-foreground">
                    Wait this many minutes after the prayer time before
                    sounding the azan.
                  </p>
                </div>
                <span className="font-mono text-sm font-semibold">
                  {s.azanOffsetMin}m
                </span>
              </div>
              <Slider
                value={[s.azanOffsetMin]}
                min={0}
                max={15}
                step={1}
                onValueChange={(v) => s.setAzanOffsetMin(v[0])}
              />
            </section>
          </div>
        </div>

        <SheetFooter className="border-t border-border px-5 py-3">
          <Button
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              toast.success('Settings saved', {
                description: 'Your preferences are stored on this device.',
                icon: <Check className="h-4 w-4" />,
              });
            }}
          >
            Done
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * A small play/stop button pair that lets the user preview the selected
 * reciter without leaving the settings sheet. Mirrors the same audio
 * element pool used by the scheduler so a preview also preloads the file.
 */
function ReciterPreviewButton({
  reciterId,
  volume,
  variant,
}: {
  reciterId: string;
  volume: number;
  variant: 'play' | 'stop';
}) {
  const startActiveAzan = useActiveAzan((s) => s.start);
  const stopActiveAzan = useActiveAzan((s) => s.stop);
  const active = useActiveAzan((s) => s.active);

  const handlePlay = () => {
    unlockAudio();
    const handle = playAzan({ reciterId, volume });
    startActiveAzan(
      {
        key: 'fajr',
        label: 'Preview',
        arabicLabel: 'معاينة',
        time: '—',
        timestamp: Date.now(),
        isAzan: true,
      },
      handle.durationMs,
    );
    // Update overlay duration once metadata loads.
    void handle.ready.then((realMs) => {
      useActiveAzan.setState((s) =>
        s.active
          ? { active: { ...s.active, durationMs: realMs } }
          : s,
      );
    });
    // Stop overlay when audio ends naturally.
    const el = getReciterAudioElement(reciterId);
    if (el) {
      el.addEventListener('ended', () => stopActiveAzan(), { once: true });
    }
    toast.info(`Previewing reciter…`, {
      description: 'Tap Stop to end early.',
    });
  };

  const handleStop = () => {
    const el = getReciterAudioElement(reciterId);
    if (el) {
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        // ignore
      }
    }
    stopActiveAzan();
  };

  if (variant === 'play') {
    return (
      <Button
        variant="outline"
        size="sm"
        className="flex-1"
        onClick={handlePlay}
        disabled={!!active}
      >
        <Play className="mr-1.5 h-3.5 w-3.5" /> Preview
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      className="flex-1"
      onClick={handleStop}
      disabled={!active}
    >
      <Square className="mr-1.5 h-3.5 w-3.5" /> Stop
    </Button>
  );
}
