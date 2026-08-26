import type { Map as MLMap } from 'maplibre-gl';
import type { Pos } from '@/lib/schema';
import { zuLngLat } from '@/lib/geo';

/**
 * Welcher Teil der Karte ist wirklich frei?
 *
 * „Im Bild" und „sichtbar" sind zwei verschiedene Dinge. Über der Karte liegen
 * der Themenschalter oben links, die MapLibre-Bedienelemente oben rechts, der
 * Zeitstrahl unten, die Herkunftsangabe der Basiskarte darüber und — wenn
 * offen — das Kontextblatt. Ein Punkt hinter einem dieser Einbauten ist im
 * Viewport und trotzdem nicht zu sehen; `getBounds().contains()` würde ihn als
 * sichtbar melden.
 *
 * Zwei Stellen brauchen den freien Ausschnitt: die Vorschau-Blase (sie darf
 * nirgends hineinragen) und die Kamera (sie soll nicht fliegen, wenn das Ziel
 * ohnehin frei liegt).
 *
 * Die großen Einbauten werden **gemessen**, nicht geschätzt: Zeitstrahl und
 * Kontextblatt ändern ihre Größe mit Inhalt und Fensterbreite, und eine
 * nachgebaute Annahme über Breakpoints geht irgendwann auseinander. Für die
 * kleinen Bedienelemente in den Ecken bleibt es bei festen Bändern — sie
 * einzeln abzuziehen würde den freien Bereich zerschneiden, ohne ihn ehrlicher
 * zu machen.
 */

export type Rechteck = { links: number; oben: number; rechts: number; unten: number };

/** Kleine Bedienelemente in den Ecken, in Pixeln. */
const EINBAU = {
  /** Themenschalter links, Zoom/Neigung rechts. */
  oben: 56,
  seite: 52,
  /** Rückfall, falls der Zeitstrahl noch nicht gemessen werden kann. */
  streifen: 96,
};

/** Zusätzlicher Rand, damit ein Ziel nicht an der Kante klebt. */
const RAND = 16;

/** Höhe des Zeitstrahls, gemeldet als `--streifen-hoehe` (ResizeObserver in `Timeline.tsx`). */
export function streifenHoehe(): number {
  if (typeof document === 'undefined') return EINBAU.streifen;
  const roh = getComputedStyle(document.documentElement).getPropertyValue('--streifen-hoehe');
  const wert = Number.parseFloat(roh);
  return Number.isFinite(wert) && wert > 0 ? wert : EINBAU.streifen;
}

/** Rechteck eines Einbaus, umgerechnet auf Canvas-Koordinaten. */
function kasten(wahl: string, canvas: DOMRect): Rechteck | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(wahl);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return {
    links: r.left - canvas.left,
    oben: r.top - canvas.top,
    rechts: r.right - canvas.left,
    unten: r.bottom - canvas.top,
  };
}

function flaeche(r: Rechteck): number {
  return Math.max(0, r.rechts - r.links) * Math.max(0, r.unten - r.oben);
}

/**
 * Einen Einbau vom freien Bereich abziehen.
 *
 * Ein beliebiges Rechteck aus einem anderen zu schneiden ergibt kein Rechteck
 * mehr. Einbauten kleben aber immer an einer Kante — das Kontextblatt ab `sm:`
 * an der rechten, auf dem Handy als Bottom-Sheet an der unteren. Statt das
 * Layout nachzubauen, werden alle vier Schnitte durchgerechnet und der
 * genommen, der am meisten Karte übrig lässt. Das bleibt richtig, auch wenn
 * sich am Layout etwas ändert.
 */
function abziehen(frei: Rechteck, el: Rechteck): Rechteck {
  const kandidaten: Rechteck[] = [
    { ...frei, rechts: Math.min(frei.rechts, el.links - RAND) },
    { ...frei, links: Math.max(frei.links, el.rechts + RAND) },
    { ...frei, unten: Math.min(frei.unten, el.oben - RAND) },
    { ...frei, oben: Math.max(frei.oben, el.unten + RAND) },
  ];
  return kandidaten.reduce((a, b) => (flaeche(b) > flaeche(a) ? b : a));
}

/** Der frei sichtbare Ausschnitt in Canvas-Pixeln. */
export function freierBereich(map: MLMap): Rechteck {
  const canvas = map.getCanvas().getBoundingClientRect();

  const frei: Rechteck = {
    links: EINBAU.seite + RAND,
    oben: EINBAU.oben + RAND,
    rechts: canvas.width - EINBAU.seite - RAND,
    unten: canvas.height - streifenHoehe() - RAND,
  };

  let rest = frei;
  for (const wahl of ['[data-testid="kontextblatt"]', '.maplibregl-ctrl-bottom-right']) {
    const el = kasten(wahl, canvas);
    if (el) rest = abziehen(rest, el);
  }

  // Deckt ein Einbau alles zu (Vollbild-Tagesablauf, sehr kleines Fenster),
  // bleibt die Mitte übrig statt eines negativen Bereichs.
  if (rest.rechts - rest.links < 40) {
    rest.links = canvas.width * 0.25;
    rest.rechts = canvas.width * 0.75;
  }
  if (rest.unten - rest.oben < 40) {
    rest.oben = canvas.height * 0.25;
    rest.unten = canvas.height * 0.75;
  }
  return rest;
}

/** Liegt der Punkt im frei sichtbaren Ausschnitt? */
export function istFreiSichtbar(map: MLMap, pos: Pos): boolean {
  const p = map.project(zuLngLat(pos));
  const b = freierBereich(map);
  return p.x >= b.links && p.x <= b.rechts && p.y >= b.oben && p.y <= b.unten;
}
