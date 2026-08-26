import type { Map as MLMap } from 'maplibre-gl';
import type { Pos } from '@/lib/schema';
import { zuLngLat } from '@/lib/geo';

/**
 * Welcher Teil der Karte ist wirklich frei?
 *
 * „Im Bild" und „sichtbar" sind zwei verschiedene Dinge. Über der Karte liegen
 * der Themenschalter oben links, die MapLibre-Bedienelemente oben rechts, der
 * Tagesstreifen unten und — wenn offen — das Kontextblatt. Ein Punkt hinter
 * einem dieser Einbauten ist im Viewport und trotzdem nicht zu sehen.
 *
 * Dieses Modul rechnet den frei sichtbaren Ausschnitt in Pixeln aus. Zwei
 * Stellen brauchen ihn: die Vorschau-Blase (sie darf nirgends hineinragen) und
 * die Kamera (sie soll nicht fliegen, wenn das Ziel ohnehin frei liegt).
 */

export type Rechteck = { links: number; oben: number; rechts: number; unten: number };

/** Ab dieser Breite gilt Tailwinds `sm:` — dort wechselt das Kontextblatt die Seite. */
export const SM = 640;

/** Bedienelemente über der Karte, in Pixeln. */
const EINBAU = {
  /** Themenschalter links, Navigation rechts. */
  oben: 56,
  /** Rückfall, falls der Streifen seine Höhe noch nicht gemeldet hat. */
  untenMindestens: 72,
  seite: 52,
};

/** Zusätzlicher Rand, damit ein Ziel nicht an der Kante klebt. */
const RAND = 16;

/**
 * Höhe des Tagesstreifens. Der Streifen meldet sie als `--streifen-hoehe`
 * (ResizeObserver in `Timeline.tsx`), weil sie vom Inhalt abhängt.
 */
export function streifenHoehe(): number {
  if (typeof document === 'undefined') return EINBAU.untenMindestens;
  const roh = getComputedStyle(document.documentElement).getPropertyValue('--streifen-hoehe');
  const wert = Number.parseFloat(roh);
  return Number.isFinite(wert) && wert > 0 ? wert : EINBAU.untenMindestens;
}

export type SichtLage = {
  /** Ist das Kontextblatt offen? Es verdeckt je nach Breite unten oder rechts. */
  detailsOffen: boolean;
};

/**
 * Der frei sichtbare Ausschnitt in Canvas-Pixeln.
 *
 * Das Kontextblatt ist auf dem Handy ein Bottom-Sheet bis `max-h-[75dvh]` und
 * ab `sm:` eine Spalte über das rechte Drittel — beides zieht ab, aber an
 * verschiedenen Seiten.
 */
export function freierBereich(map: MLMap, lage: SichtLage = { detailsOffen: false }): Rechteck {
  const { width: breite, height: hoehe } = map.getCanvas().getBoundingClientRect();

  const bereich: Rechteck = {
    links: EINBAU.seite + RAND,
    oben: EINBAU.oben + RAND,
    rechts: breite - EINBAU.seite - RAND,
    unten: hoehe - streifenHoehe() - RAND,
  };

  if (lage.detailsOffen) {
    if (breite >= SM) bereich.rechts = Math.min(bereich.rechts, breite / 3 - RAND);
    else bereich.unten = Math.min(bereich.unten, hoehe * 0.25 - RAND);
  }

  // Bei sehr kleinen Fenstern kann sich das Rechteck aufheben; dann bleibt die
  // Mitte übrig, statt eines negativen Bereichs.
  if (bereich.rechts <= bereich.links) {
    bereich.links = breite * 0.25;
    bereich.rechts = breite * 0.75;
  }
  if (bereich.unten <= bereich.oben) {
    bereich.oben = hoehe * 0.25;
    bereich.unten = hoehe * 0.75;
  }
  return bereich;
}

/** Liegt der Punkt im frei sichtbaren Ausschnitt? */
export function istFreiSichtbar(map: MLMap, pos: Pos, lage?: SichtLage): boolean {
  const p = map.project(zuLngLat(pos));
  const b = freierBereich(map, lage);
  return p.x >= b.links && p.x <= b.rechts && p.y >= b.oben && p.y <= b.unten;
}
