import type { Pos } from './schema';

/** MapLibre rechnet in [lon, lat], die Reisedaten stehen als [lat, lon]. */
export type LngLat = [number, number];

export function zuLngLat(pos: Pos): LngLat {
  return [pos[1], pos[0]];
}

export function distanzKm(a: Pos, b: Pos): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type Bounds = [number, number, number, number]; // [west, süd, ost, nord]

export function bounds(punkte: readonly Pos[]): Bounds | null {
  if (punkte.length === 0) return null;
  let w = 180;
  let s = 90;
  let o = -180;
  let n = -90;
  for (const [lat, lon] of punkte) {
    if (lon < w) w = lon;
    if (lon > o) o = lon;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  // Ein einzelner Punkt hat keine Ausdehnung — künstlich aufziehen, sonst
  // zoomt fitBounds ins Maximum.
  if (o - w < 0.01) {
    w -= 0.06;
    o += 0.06;
  }
  if (n - s < 0.01) {
    s -= 0.03;
    n += 0.03;
  }
  return [w, s, o, n];
}

/** Peilung von a nach b in Grad — für die Kameraausrichtung der Tour. */
export function peilung(a: Pos, b: Pos): number {
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function formatKoordinate(pos: Pos): string {
  const [lat, lon] = pos;
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'O' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lon).toFixed(4)}° ${ew}`;
}

/**
 * Link auf genau diese Koordinate in Google Maps.
 *
 * Die Koordinate, nicht der Name: „Reykholt" gibt es in Island dreimal, und
 * die Karte zeigt eine belegte Position, kein Suchwort. Die Maps-URL-API mit
 * `query=lat,lon` setzt die Nadel exakt dorthin; von dort aus ist Navigation
 * ein Tippen. Sechs Nachkommastellen sind etwa zehn Zentimeter — mehr trägt
 * keine Quelle dieses Projekts.
 */
export function googleMapsUrl(pos: Pos): string {
  const [lat, lon] = pos;
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}`;
}
