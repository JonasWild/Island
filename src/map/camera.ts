import type { Map as MLMap } from 'maplibre-gl';
import type { Pos, Tag } from '@/lib/schema';
import { bounds, peilung, zuLngLat } from '@/lib/geo';
import { ISLAND_BOUNDS, START_KAMERA } from './style';

export const RAND = { top: 90, bottom: 190, left: 60, right: 60 };

function reduziert(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Ganze Insel — Ausgangs- und Rückfallansicht. */
export function zeigeInsel(map: MLMap): void {
  map.fitBounds(ISLAND_BOUNDS, {
    padding: RAND,
    pitch: START_KAMERA.pitch,
    bearing: 0,
    duration: reduziert() ? 0 : 1400,
  });
}

/**
 * Kameraflug auf eine Etappe: alle verorteten Stopps des Tages ins Bild, dabei
 * geneigt und in Fahrtrichtung gedreht, damit das Terrain sichtbar bleibt.
 */
export function fliegeZuTag(map: MLMap, tag: Tag): void {
  const punkte = tag.highlights.map((h) => h.pos).filter((p): p is Pos => p !== null);
  const b = bounds(punkte);
  if (!b) {
    zeigeInsel(map);
    return;
  }
  const erster = punkte[0]!;
  const letzter = punkte[punkte.length - 1]!;
  const richtung = punkte.length > 1 ? peilung(erster, letzter) : 0;
  map.fitBounds(b, {
    padding: RAND,
    pitch: 58,
    bearing: richtung,
    maxZoom: 11,
    duration: reduziert() ? 0 : 1800,
  });
}

export function fliegeZuPunkt(map: MLMap, pos: Pos, zoom = 12.5): void {
  map.easeTo({
    center: zuLngLat(pos),
    zoom,
    pitch: 62,
    duration: reduziert() ? 0 : 1200,
    padding: { top: 0, bottom: 160, left: 0, right: 0 },
  });
}

export type TourSchritt = { index: number; pos: Pos };

/**
 * Ein Schritt der Kamera-Tour: auf den Stopp zu, ausgerichtet auf den nächsten.
 * Gibt die Dauer zurück, damit der Aufrufer den Takt kennt.
 */
export function tourSchritt(map: MLMap, punkte: readonly Pos[], i: number): number {
  const hier = punkte[i];
  if (!hier) return 0;
  const naechster = punkte[i + 1] ?? punkte[i - 1] ?? hier;
  const dauer = reduziert() ? 0 : 3200;
  map.easeTo({
    center: zuLngLat(hier),
    zoom: 11.2,
    pitch: 66,
    bearing: peilung(hier, naechster),
    duration: dauer,
    easing: (t) => t * (2 - t),
    padding: { top: 0, bottom: 170, left: 0, right: 0 },
  });
  return dauer + 900; // Standzeit am Stopp
}
