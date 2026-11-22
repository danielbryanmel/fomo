import type { GeoBounds, GeoPoint } from '@/types/domain';

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distância em metros (haversine). */
export function distanceM(a: GeoPoint, b: GeoPoint) {
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number | null) {
  if (m === null) return null;
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

export function regionToBounds(r: Region): GeoBounds {
  return {
    north: r.latitude + r.latitudeDelta / 2,
    south: r.latitude - r.latitudeDelta / 2,
    east: r.longitude + r.longitudeDelta / 2,
    west: r.longitude - r.longitudeDelta / 2,
  };
}

export function inBounds(p: GeoPoint, b: GeoBounds) {
  return p.latitude <= b.north && p.latitude >= b.south && p.longitude <= b.east && p.longitude >= b.west;
}

/** Região padrão: centro expandido de São Paulo. */
export const DEFAULT_REGION: Region = { latitude: -23.553, longitude: -46.665, latitudeDelta: 0.07, longitudeDelta: 0.07 };

export function regionAround(p: GeoPoint, delta = 0.035): Region {
  return { ...p, latitudeDelta: delta, longitudeDelta: delta };
}
