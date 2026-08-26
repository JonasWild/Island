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

/**
 * Was die eigene Oberfläche von der Karte verdeckt, in Pixeln je Seite.
 *
 * **Gemessen, nicht geraten.** Die Filterleiste oben und der Tagesstreifen
 * unten ändern ihre Höhe mit dem Inhalt und mit der Bildschirmbreite; das
 * Kontextblatt ist auf dem Handy ein Blatt von unten und ab `sm:` eine Spalte
 * rechts. Eine feste Zahl wäre auf der Hälfte der Geräte falsch.
 *
 * Der Rand oben drauf sorgt dafür, dass ein Ziel nicht als „sichtbar" gilt,
 * wenn es gerade eben noch an der Kante klebt.
 */
const RAND_FREI = 48;

function einbauten(map: MLMap): { top: number; bottom: number; left: number; right: number } {
  const karte = map.getContainer().getBoundingClientRect();
  const frei = { top: RAND_FREI, bottom: RAND_FREI, left: RAND_FREI, right: RAND_FREI };
  if (typeof document === 'undefined') return frei;

  const einbau = [
    '[data-testid="filterleiste"]',
    '[data-testid="tagesstreifen"]',
    '[data-testid="kontextblatt"]',
  ];
  for (const wahl of einbau) {
    const el = document.querySelector(wahl);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;

    /*
      Nur Kanten, an denen das Element wirklich klebt — und oben/unten nur,
      wenn es breit genug ist, um die Kante ernsthaft zu sperren. Der
      Tagesstreifen ist ab `sm:` eine zentrierte Pille: sie verdeckt einen
      Streifen in der Mitte, aber links und rechts bleibt die Karte frei.
    */
    const breit = r.width / karte.width > 0.6;
    const hoch = r.height / karte.height > 0.5;
    const obenAn = r.top - karte.top < 2;
    const untenAn = karte.bottom - r.bottom < 2;
    const linksAn = r.left - karte.left < 2;
    const rechtsAn = karte.right - r.right < 2;

    if (obenAn && breit) frei.top = Math.max(frei.top, r.bottom - karte.top + RAND_FREI);
    if (untenAn && breit) frei.bottom = Math.max(frei.bottom, karte.bottom - r.top + RAND_FREI);
    if (linksAn && hoch) frei.left = Math.max(frei.left, r.right - karte.left + RAND_FREI);
    if (rechtsAn && hoch) frei.right = Math.max(frei.right, karte.right - r.left + RAND_FREI);
  }
  return frei;
}

/**
 * Liegt der Punkt im frei sichtbaren Teil der Karte?
 *
 * Nicht `getBounds().contains()`: ein Punkt kann im Kartenausschnitt liegen
 * und trotzdem unter dem Kontextblatt oder dem Tagesstreifen stecken. Geprüft
 * wird gegen die Fläche, die tatsächlich zu sehen ist.
 */
export function istFreiSichtbar(map: MLMap, pos: Pos): boolean {
  const { x, y } = map.project(zuLngLat(pos));
  const karte = map.getContainer().getBoundingClientRect();
  const frei = einbauten(map);
  return (
    x >= frei.left &&
    x <= karte.width - frei.right &&
    y >= frei.top &&
    y <= karte.height - frei.bottom
  );
}

/**
 * Punkt ins Bild holen — **aber nur, wenn nötig**.
 *
 * Wer auf ein Symbol tippt, das er gerade ansieht, will nicht, dass die Karte
 * darunter wegrutscht. Steht das Ziel frei im Bild, bleibt die Kamera, wo sie
 * ist. Sonst wird es in die freie Fläche geschoben.
 *
 * **Der Zoom bleibt dabei unangetastet.** Eine Schwelle „unter Zoom X lohnt
 * das Heranfahren trotzdem" klingt vernünftig und ist es hier nicht: der
 * Kameraflug auf einen Tag landet je nach Ausdehnung der Etappe zwischen Zoom
 * 6 und 10,5. Jede Schwelle in dieser Spanne hätte fast jeden Klick aus der
 * normalen Tagesansicht wieder zu einer Fahrt gemacht — also genau das, was
 * hier abgestellt werden soll.
 */
export function zeigePunkt(map: MLMap, pos: Pos): void {
  if (istFreiSichtbar(map, pos)) return;

  map.easeTo({
    center: zuLngLat(pos),
    // Das Padding schiebt den Punkt in die Mitte der *freien* Fläche, nicht
    // in die Mitte des Fensters — sonst landet er unter dem Kontextblatt.
    padding: einbauten(map),
    duration: reduziert() ? 0 : 700,
  });
}
