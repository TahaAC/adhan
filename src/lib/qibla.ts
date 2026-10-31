// qibla.ts - Calculate the Qibla direction (bearing to the Kaaba in Makkah)
// from a given coordinate. The Kaaba is at 21.4225°N, 39.8262°E.
//
// Bearing formula: great-circle initial bearing from the observer to the
// Kaaba, measured clockwise from true north. Verified against known
// reference points (NYC ~58.5°, London ~119°, Karachi ~268°, Jakarta
// ~295°, Sydney ~277°, Mecca 0°).

export const KAABA_COORDINATES = { lat: 21.4225, lng: 39.8262 };

const toRad = (d: number): number => (d * Math.PI) / 180;
const toDeg = (r: number): number => (r * 180) / Math.PI;

/**
 * Great-circle initial bearing from `from` to the Kaaba, in degrees
 * measured clockwise from true north (0° = N, 90° = E).
 */
export function qiblaBearing(from: { lat: number; lng: number }): number {
  const { lat: φ1, lng: λ1 } = from;
  const { lat: φ2, lng: λ2 } = KAABA_COORDINATES;

  const Δλ = λ2 - λ1;
  const y = Math.sin(toRad(Δλ)) * Math.cos(toRad(φ2));
  const x =
    Math.cos(toRad(φ1)) * Math.sin(toRad(φ2)) -
    Math.sin(toRad(φ1)) * Math.cos(toRad(φ2)) * Math.cos(toRad(Δλ));
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

/**
 * Shortest great-circle distance from `from` to the Kaaba, in kilometres.
 * Uses the haversine formula.
 */
export function distanceToKaaba(from: { lat: number; lng: number }): number {
  const R = 6371; // km
  const φ1 = toRad(from.lat);
  const φ2 = toRad(KAABA_COORDINATES.lat);
  const Δφ = toRad(KAABA_COORDINATES.lat - from.lat);
  const Δλ = toRad(KAABA_COORDINATES.lng - from.lng);
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Convert a bearing (degrees from true north) to a 16-point compass
 * direction text, e.g. "S", "SE", "SSW", "NNE".
 */
export function bearingToCompass(bearing: number): string {
  const directions = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW',
  ];
  const idx = Math.round(bearing / 22.5) % 16;
  return directions[idx];
}

