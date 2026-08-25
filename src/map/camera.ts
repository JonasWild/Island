import type { Map as MLMap } from 'maplibre-gl';
import type { Pos, Tag } from '@/lib/schema';
import { bounds, zuLngLat } from '@/lib/geo';
import { ISLAND_BOUNDS } from './style';

const RAND = { top: 70, bottom: 120, left: 60, right: 60 };

function reduziert(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function zeigeInsel(map: MLMap): void {
  map.fitBounds(ISLAND_BOUNDS, {
    padding: RAND,
    duration: reduziert() ? 0 : 1400,
  });
}

/**
 * Kameraflug auf eine Etappe. Flach und nordorientiert: die Neigung trug
 * früher das 3D-Gelände, das es nicht mehr gibt, und die Drehung in
 * Fahrtrichtung kostete auf einer flachen Karte nur Orientierung — auf dem
 * Handy erst recht. Norden bleibt oben.
 */
export function fliegeZuTag(map: MLMap, tag: Tag): void {
  const punkte = tag.highlights.map((h) => h.pos).filter((p): p is Pos => p !== null);
  const b = bounds(punkte);
  if (!b) {
    zeigeInsel(map);
    return;
  }
  map.fitBounds(b, {
    padding: RAND,
    maxZoom: 10.5,
    duration: reduziert() ? 0 : 1600,
  });
}

export function fliegeZuPunkt(map: MLMap, pos: Pos, zoom = 12): void {
  map.easeTo({
    center: zuLngLat(pos),
    zoom,
    duration: reduziert() ? 0 : 1100,
    padding: { top: 0, bottom: 100, left: 0, right: 0 },
  });
}
