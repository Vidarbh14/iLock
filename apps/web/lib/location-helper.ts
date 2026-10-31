import type { AgentHeartbeatInput, DeviceLocationFix } from '@ilock/shared';

// A history row is appended when the laptop moves this far or this long since the previous row
export const LOCATION_HISTORY_MIN_DISTANCE_M = 50;
export const LOCATION_HISTORY_MIN_INTERVAL_MS = 5 * 60 * 1000;
export const LOCATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

// A precise Windows fix younger than this is preferred over a coarse IP fallback
const PRECISE_FIX_PREFERRED_MS = 30 * 60 * 1000;

export interface StoredLocation {
  latitude: number | null;
  longitude: number | null;
  location_source: string | null;
  location_fixed_at: string | null;
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Picks the best available fix for this heartbeat:
 *  1. Windows Location fix reported by the agent (Wi-Fi / GPS, typically 20-100 m)
 *  2. IP geolocation from Vercel edge headers (city-level), unless a recent precise fix exists
 * Returns null when neither is available, so the stored last-known location is left untouched.
 */
export function resolveLocationFix(
  heartbeat: AgentHeartbeatInput,
  headers: Headers,
  previous: StoredLocation | null,
  now: Date
): DeviceLocationFix | null {
  if (typeof heartbeat.latitude === 'number' && typeof heartbeat.longitude === 'number') {
    return {
      latitude: heartbeat.latitude,
      longitude: heartbeat.longitude,
      accuracyM: heartbeat.locationAccuracyM ?? null,
      source: 'windows',
      city: null,
      fixedAt: new Date(heartbeat.locationFixedAt ?? now.getTime()).toISOString(),
    };
  }

  if (previous?.location_source === 'windows' && previous.location_fixed_at) {
    const ageMs = now.getTime() - new Date(previous.location_fixed_at).getTime();
    if (ageMs < PRECISE_FIX_PREFERRED_MS) return null;
  }

  // Only populated when deployed on Vercel; no third-party IP lookup is made.
  const lat = parseFloat(headers.get('x-vercel-ip-latitude') || '');
  const lon = parseFloat(headers.get('x-vercel-ip-longitude') || '');
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

  const rawCity = headers.get('x-vercel-ip-city');
  let city: string | null = null;
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity);
    } catch {
      city = rawCity;
    }
  }

  return {
    latitude: lat,
    longitude: lon,
    accuracyM: null,
    source: 'ip',
    city,
    fixedAt: now.toISOString(),
  };
}

/** True when the fix carries new information compared to what is already stored. */
export function isNewFix(fix: DeviceLocationFix, previous: StoredLocation | null): boolean {
  if (!previous || previous.latitude === null || previous.longitude === null) return true;
  if (fix.source === 'ip') {
    return previous.location_source !== 'ip' || previous.latitude !== fix.latitude || previous.longitude !== fix.longitude;
  }
  if (!previous.location_fixed_at) return true;
  return new Date(previous.location_fixed_at).getTime() !== new Date(fix.fixedAt).getTime();
}
