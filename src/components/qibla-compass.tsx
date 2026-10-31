'use client';

import { useCallback, useEffect, useState } from 'react';
import { Compass, Navigation, MapPin, Navigation2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { qiblaBearing, distanceToKaaba, bearingToCompass } from '@/lib/qibla';

interface QiblaCompassProps {
  location: { lat: number; lng: number; name: string };
}

/**
 * Qibla compass with a GPS-style rotating dial.
 *
 * UX:
 * - The entire dial (cardinal letters + tick marks + Kaaba marker) rotates
 *   with the device so the letter at the top always shows your facing
 *   direction.
 * - A FIXED red arrow at the top of the screen represents "forward" (the
 *   direction the top of your phone is pointing).
 * - The gold Kaaba marker is fixed on the dial at the bearing angle from
 *   true north. When you rotate yourself so the Kaaba marker aligns with
 *   the fixed red arrow at the top, you are facing the Qibla.
 *
 * When no compass sensor is available (or not yet activated), the dial is
 * static with N at the top and the Kaaba marker at `bearing` degrees
 * clockwise — so the user can still read the bearing visually.
 */
export function QiblaCompass({ location }: QiblaCompassProps) {
  const bearing = qiblaBearing(location);
  const distance = distanceToKaaba(location);
  const compassDir = bearingToCompass(bearing);

  const [heading, setHeading] = useState<number | null>(null);
  const [sensorActive, setSensorActive] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);

  const handleEvent = useCallback(
    (e: DeviceOrientationEvent) => {
      let h: number | null = null;
      // iOS 13+ provides webkitCompassHeading (true heading, clockwise
      // from north). Other browsers give `alpha` which is the rotation
      // around the Z axis (counter-clockwise from north), so we convert
      // it to a clockwise compass heading.
      const anyEvt = e as DeviceOrientationEvent & {
        webkitCompassHeading?: number;
      };
      if (typeof anyEvt.webkitCompassHeading === 'number') {
        h = anyEvt.webkitCompassHeading;
      } else if (typeof e.alpha === 'number' && e.absolute) {
        h = (360 - e.alpha) % 360;
      }
      if (h !== null && !Number.isNaN(h)) setHeading(h);
    },
    [],
  );

  const stopSensor = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('deviceorientation', handleEvent, true);
      window.removeEventListener(
        'deviceorientationabsolute',
        handleEvent as EventListener,
        true,
      );
    }
    setSensorActive(false);
    setHeading(null);
  }, [handleEvent]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => stopSensor();
  }, [stopSensor]);

  const startSensor = async () => {
    const DTO =
      typeof window !== 'undefined'
        ? (window as unknown as {
            DeviceOrientationEvent?: typeof DeviceOrientationEvent & {
              requestPermission?: () => Promise<'granted' | 'denied'>;
            };
          }).DeviceOrientationEvent
        : undefined;
    if (DTO && typeof DTO.requestPermission === 'function') {
      try {
        const res = await DTO.requestPermission();
        if (res !== 'granted') {
          setNeedsPermission(true);
          return;
        }
      } catch {
        setNeedsPermission(true);
        return;
      }
    }
    // On Android Chrome, `deviceorientationabsolute` gives true heading.
    // On iOS and others, `deviceorientation` with webkitCompassHeading works.
    window.addEventListener('deviceorientation', handleEvent, true);
    window.addEventListener(
      'deviceorientationabsolute',
      handleEvent as EventListener,
      true,
    );
    setSensorActive(true);
  };

  // The dial rotates counter-clockwise by the device heading, so the
  // cardinal letter for the direction you're facing moves to the top.
  const dialRotation = heading ?? 0;

  // How far (in degrees) the user needs to rotate clockwise to face the
  // Qibla. 0 = already facing it. Used for the alignment hint.
  const alignmentOffset = ((bearing - dialRotation + 360) % 360);
  const isAligned = sensorActive && alignmentOffset < 3;

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-kufi text-lg font-bold tracking-tight">
            Qibla Direction
          </h2>
          <p className="text-xs text-muted-foreground">
            Bearing to the Kaaba from your location.
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <Compass className="h-3.5 w-3.5" />
            {bearing.toFixed(1)}° ({compassDir})
          </span>
        </div>
      </div>

      <div className="grid items-center gap-5 sm:grid-cols-[220px_1fr]">
        <div className="relative mx-auto h-52 w-52 sm:h-56 sm:w-56">
          {/* Fixed outer ring (non-rotating) — holds the forward arrow */}
          <div className="absolute inset-0 rounded-full border-2 border-border bg-gradient-to-br from-emerald-mid/10 to-gold/10 shadow-inner" />

          {/* Fixed forward arrow at the top — shows your facing direction */}
          <div className="absolute left-1/2 top-[-2px] z-20 -translate-x-1/2">
            <div className="flex flex-col items-center">
              <div
                className={`h-0 w-0 border-l-[8px] border-r-[8px] border-t-[14px] border-l-transparent border-r-transparent transition-colors ${
                  isAligned
                    ? 'border-t-emerald-500'
                    : 'border-t-rose-500'
                }`}
              />
            </div>
          </div>

          {/* Rotating dial: cardinal letters + tick marks + Kaaba marker */}
          <div
            className="absolute inset-0 transition-transform duration-200 ease-out"
            style={{ transform: `rotate(${-dialRotation}deg)` }}
          >
            {/* Cardinal letters — rotate with the dial */}
            {(['N', 'E', 'S', 'W'] as const).map((dir, i) => {
              const angle = i * 90; // 0=N(top), 90=E(right), 180=S(bottom), 270=W(left)
              return (
                <div
                  key={dir}
                  className="absolute left-1/2 top-1/2"
                  style={{
                    transform: `rotate(${angle}deg) translateY(-${88}px) rotate(-${angle}deg)`,
                  }}
                >
                  <span
                    className={`block text-sm font-bold ${
                      dir === 'N'
                        ? 'text-amber-600 dark:text-amber-300'
                        : 'text-muted-foreground'
                    }`}
                    style={{ transform: 'translate(-50%, -50%)' }}
                  >
                    {dir}
                  </span>
                </div>
              );
            })}

            {/* Intercardinal letters (NE, SE, SW, NW) */}
            {(['NE', 'SE', 'SW', 'NW'] as const).map((dir, i) => {
              const angle = 45 + i * 90;
              return (
                <div
                  key={dir}
                  className="absolute left-1/2 top-1/2"
                  style={{
                    transform: `rotate(${angle}deg) translateY(-${86}px) rotate(-${angle}deg)`,
                  }}
                >
                  <span
                    className="block text-[10px] font-medium text-muted-foreground/70"
                    style={{ transform: 'translate(-50%, -50%)' }}
                  >
                    {dir}
                  </span>
                </div>
              );
            })}

            {/* Tick marks */}
            {Array.from({ length: 72 }).map((_, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/2"
                style={{
                  width: i % 9 === 0 ? '2px' : i % 3 === 0 ? '1.5px' : '1px',
                  height: i % 9 === 0 ? '12px' : i % 3 === 0 ? '8px' : '5px',
                  background:
                    i % 9 === 0
                      ? 'color-mix(in oklch, var(--gold) 80%, transparent)'
                      : 'color-mix(in oklch, var(--foreground) 25%, transparent)',
                  transform: `translate(-50%, -50%) rotate(${i * 5}deg) translateY(-${96}px)`,
                }}
              />
            ))}

            {/* Kaaba marker — fixed on the dial at the bearing angle */}
            <div
              className="absolute left-1/2 top-1/2"
              style={{
                transform: `translate(-50%, -50%) rotate(${bearing}deg) translateY(-${68}px) rotate(-${bearing}deg)`,
              }}
            >
              <div
                className="flex flex-col items-center transition-transform"
                style={{ transform: `rotate(${bearing}deg)` }}
              >
                <div
                  className={`grid h-10 w-10 place-items-center rounded-md shadow-lg ring-2 transition-all ${
                    isAligned
                      ? 'bg-emerald-500 text-white ring-emerald-300 scale-110'
                      : 'bg-emerald-deep text-gold ring-gold/50'
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-6 w-6"
                    fill="currentColor"
                  >
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Center hub */}
          <div className="absolute left-1/2 top-1/2 z-10 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-border bg-background shadow-md">
            <Navigation2 className="h-5 w-5 text-primary" />
          </div>

          {/* Alignment indicator */}
          {sensorActive && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  isAligned
                    ? 'bg-emerald-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isAligned ? '✓ Aligned with Qibla' : 'Rotate to align'}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div
            className={`rounded-lg border p-3 text-sm transition-colors ${
              isAligned
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-border bg-background/60'
            }`}
          >
            {sensorActive ? (
              isAligned ? (
                <p className="font-medium">
                  ✓ You are facing the Qibla! The Kaaba marker is aligned
                  with the arrow at the top.
                </p>
              ) : (
                <p>
                  Rotate yourself{' '}
                  <span className="font-semibold text-primary">
                    {alignmentOffset < 180
                      ? `${Math.round(alignmentOffset)}° clockwise`
                      : `${Math.round(360 - alignmentOffset)}° counter-clockwise`}
                  </span>{' '}
                  until the gold Kaaba marker aligns with the red arrow at
                  the top of the dial.
                </p>
              )
            ) : (
              <p>
                The Qibla is at{' '}
                <span className="font-semibold text-primary">
                  {bearing.toFixed(1)}° from true north ({compassDir})
                </span>
                . Tap “Use live compass” to activate the sensor and align
                yourself in real time.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border border-border bg-background/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Bearing
              </p>
              <p className="font-mono text-lg font-semibold">
                {bearing.toFixed(2)}°
              </p>
              <p className="text-[10px] text-muted-foreground">{compassDir}</p>
            </div>
            <div className="rounded-lg border border-border bg-background/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Distance
              </p>
              <p className="font-mono text-lg font-semibold">
                {distance.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{' '}
                km
              </p>
              <p className="text-[10px] text-muted-foreground">to Kaaba</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background/60 p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              From: <span className="text-foreground">{location.name}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              To:{' '}
              <span className="text-foreground">
                Kaaba, Makkah (21.42°N, 39.83°E)
              </span>
            </p>
          </div>

          {!sensorActive ? (
            <Button
              variant="outline"
              size="sm"
              onClick={startSensor}
              className="w-full"
            >
              <Compass className="mr-2 h-4 w-4" />
              Use live compass
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={stopSensor}
              className="w-full"
            >
              Stop compass
            </Button>
          )}
          {needsPermission && (
            <p className="text-[11px] text-amber-600 dark:text-amber-300">
              Compass permission was denied. The bearing above is still
              accurate — use a separate physical compass aligned to the
              bearing shown.
            </p>
          )}
          {sensorActive && heading === null && (
            <p className="text-[11px] text-muted-foreground">
              Waiting for sensor data… If this persists, your device may
              not have a compass sensor.
            </p>
          )}
          <p className="text-[10px] text-muted-foreground/70">
            Hold your phone flat, screen up, and rotate your body. The
            bearing uses the great-circle formula and is accurate to within
            ~1° of true north.
          </p>
        </div>
      </div>
    </section>
  );
}
