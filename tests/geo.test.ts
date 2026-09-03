import { describe, expect, it } from 'vitest';
import { bounds, distanzKm, formatKoordinate, googleMapsUrl, peilung, zuLngLat } from '@/lib/geo';
import type { Pos } from '@/lib/schema';

const REYKJAVIK: Pos = [64.1466, -21.9426];
const AKUREYRI: Pos = [65.6839, -18.0906];

describe('geo', () => {
  it('dreht [lat, lon] auf MapLibres [lon, lat]', () => {
    expect(zuLngLat(REYKJAVIK)).toEqual([-21.9426, 64.1466]);
  });

  it('rechnet Luftlinien plausibel', () => {
    // Reykjavík–Akureyri sind rund 250 km Luftlinie.
    expect(distanzKm(REYKJAVIK, AKUREYRI)).toBeGreaterThan(240);
    expect(distanzKm(REYKJAVIK, AKUREYRI)).toBeLessThan(260);
    expect(distanzKm(REYKJAVIK, REYKJAVIK)).toBe(0);
  });

  it('peilt nach Nordosten', () => {
    const grad = peilung(REYKJAVIK, AKUREYRI);
    expect(grad).toBeGreaterThan(0);
    expect(grad).toBeLessThan(90);
  });

  it('umschließt Punkte', () => {
    const b = bounds([REYKJAVIK, AKUREYRI])!;
    expect(b[0]).toBeCloseTo(-21.9426, 4);
    expect(b[1]).toBeCloseTo(64.1466, 4);
    expect(b[2]).toBeCloseTo(-18.0906, 4);
    expect(b[3]).toBeCloseTo(65.6839, 4);
  });

  it('zieht einen einzelnen Punkt künstlich auf', () => {
    const b = bounds([REYKJAVIK])!;
    expect(b[2] - b[0]).toBeGreaterThan(0.05);
    expect(b[3] - b[1]).toBeGreaterThan(0.02);
  });

  it('gibt null für nichts', () => {
    expect(bounds([])).toBeNull();
  });

  it('formatiert Koordinaten für Island', () => {
    expect(formatKoordinate(REYKJAVIK)).toBe('64.1466° N, 21.9426° W');
  });

  it('verlinkt genau die Koordinate in Google Maps', () => {
    // Die Nadel, nicht das Suchwort: `query=lat,lon` mit Vorzeichen, damit
    // Google Maps dieselbe Stelle zeigt wie die Karte.
    const url = new URL(googleMapsUrl(REYKJAVIK));
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/search/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('query')).toBe('64.146600,-21.942600');
  });
});
