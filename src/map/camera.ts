import type { Map as MLMap } from 'maplibre-gl';
import type { Pos, Tag } from '@/lib/schema';
import { bounds, peilung, zuLngLat } from '@/lib/geo';
import { freierBereich, istFreiSichtbar } from './sicht';
import { ISLAND_BOUNDS, START_KAMERA } from './style';

const RAND = { top: 70, bottom: 120, left: 60, right: 60 };

function reduziert(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function zeigeInsel(map: MLMap): void {
  map.fitBounds(ISLAND_BOUNDS, {
    padding: RAND,
    pitch: START_KAMERA.pitch,
    bearing: 0,
    duration: reduziert() ? 0 : 1400,
  });
}

/** Kameraflug auf eine Etappe: geneigt und in Fahrtrichtung, damit das Relief trägt. */
export function fliegeZuTag(map: MLMap, tag: Tag): void {
  const punkte = tag.highlights.map((h) => h.pos).filter((p): p is Pos => p !== null);
  const b = bounds(punkte);
  if (!b) {
    zeigeInsel(map);
    return;
  }
  const erster = punkte[0]!;
  const letzter = punkte[punkte.length - 1]!;
  map.fitBounds(b, {
    padding: RAND,
    pitch: 55,
    bearing: punkte.length > 1 ? peilung(erster, letzter) : 0,
    maxZoom: 10.5,
    duration: reduziert() ? 0 : 1600,
  });
}

/**
 * Unter diesem Zoom ist ein Punkt zwar zu sehen, seine Umgebung aber nicht zu
 * lesen: auf der Inselübersicht liegen die Ziele als Trauben übereinander.
 * Dort lohnt der Flug auch dann, wenn das Symbol schon im Bild steht.
 */
export const ZOOM_LESBAR = 8;

/** Wird geflogen, dann mindestens so nah — sonst landet man wieder in der Traube. */
export const ZOOM_NAH = 10.5;

/**
 * Ein Ziel zeigen — aber nur, wenn es das nötig hat.
 *
 * Die Kamera flog früher bei jedem Klick auf ein Symbol los, mit festem Zoom
 * 12. Das war unnötig und desorientierend: das Ziel stand ja schon im Bild,
 * und der Sprung riss den Ausschnitt weg, den man sich gerade aufgebaut hatte.
 *
 * Geflogen wird jetzt in drei Fällen:
 *
 * 1. Das Ziel liegt nicht im **frei sichtbaren** Ausschnitt (`sicht.ts`) —
 *    also außerhalb des Bildes oder hinter Kontextblatt, Zeitstrahl oder
 *    Bedienelementen. `getBounds().contains()` würde hier das Falsche sagen.
 * 2. Der Zoom liegt unter `ZOOM_LESBAR`.
 * 3. Die Kamera bewegt sich gerade. Während eines Fluges ist „sichtbar" ein
 *    wandernder Begriff — beim Deep Link setzt `useDeepLink` die Auswahl,
 *    während `fliegeZuTag` noch läuft. Dann gilt: hinfliegen.
 *
 * Und wenn geflogen wird, dann so ruhig wie möglich: der aktuelle Zoom bleibt
 * (nur nach unten begrenzt), Neigung und Drehung bleiben unangetastet,
 * verschoben wird nur die Mitte. `padding` schiebt das Ziel dabei in die Mitte
 * des **freien** Bereichs statt in die Mitte des Fensters — sonst landet es
 * unter dem Kontextblatt.
 *
 * @returns ob geflogen wurde
 */
export function zeigeZiel(map: MLMap, pos: Pos): boolean {
  const ruhig = !map.isMoving() && !map.isZooming() && !map.isRotating();
  if (ruhig && map.getZoom() >= ZOOM_LESBAR && istFreiSichtbar(map, pos)) return false;

  const { width, height } = map.getCanvas().getBoundingClientRect();
  const b = freierBereich(map);
  map.easeTo({
    center: zuLngLat(pos),
    zoom: Math.max(map.getZoom(), ZOOM_NAH),
    padding: {
      top: Math.max(0, b.oben),
      bottom: Math.max(0, height - b.unten),
      left: Math.max(0, b.links),
      right: Math.max(0, width - b.rechts),
    },
    duration: reduziert() ? 0 : 900,
  });
  return true;
}
