import type { Kategorie } from './kategorie';

/**
 * Sechzehn Zielarten sind zum Ansehen richtig und zum Filtern zu viel: eine
 * Leiste mit sechzehn Schaltflächen ist auf dem Handy genauso unbrauchbar wie
 * 128 Symbole gleichzeitig auf der Karte. Deshalb sechs Überkategorien —
 * gebündelt danach, wonach man unterwegs sucht, nicht danach, was
 * geologisch verwandt ist.
 *
 * „Baden" liegt bei den Vulkanen, weil in Island jede heiße Quelle
 * vulkanischen Ursprungs ist und beides am selben Ort liegt (Námaskarð und
 * Mývatn Nature Baths sind Nachbarn). Wer „heiße Quellen" sucht, findet sie
 * dort, wo er sie erwartet.
 *
 * Unterkünfte stehen bewusst in **keiner** Gruppe: sie lassen sich nicht
 * wegfiltern. Wo man schläft, ist der Anker des Tages und muss immer sichtbar
 * bleiben — auch wenn man gerade nur nach Wasserfällen sucht.
 */
export type Gruppe = 'wasser' | 'thermal' | 'berge' | 'aktiv' | 'orte' | 'unterwegs';

export const GRUPPE_VON: Record<Kategorie, Gruppe | null> = {
  wasserfall: 'wasser',
  see: 'wasser',
  strand: 'wasser',

  vulkan: 'thermal',
  bad: 'thermal',

  berg: 'berge',
  gletscher: 'berge',
  schlucht: 'berge',
  hoehle: 'berge',

  wanderung: 'aktiv',
  tier: 'aktiv',

  ort: 'orte',
  museum: 'orte',
  kirche: 'orte',

  verkehr: 'unterwegs',

  // Die Unterkunft ist der Anker des Tages und wird nie ausgeblendet.
  unterkunft: null,
};

export const GRUPPEN: readonly Gruppe[] = [
  'wasser',
  'thermal',
  'berge',
  'aktiv',
  'orte',
  'unterwegs',
];

/** Kurz genug für eine Schaltfläche auf 390 px Breite. */
export const GRUPPE_LABEL: Record<Gruppe, string> = {
  wasser: 'Wasser',
  thermal: 'Vulkanisch',
  berge: 'Berge & Eis',
  aktiv: 'Aktiv',
  orte: 'Orte',
  unterwegs: 'Unterwegs',
};

/** Was genau drinsteckt — für Titel und Legende, damit nichts geraten wird. */
export const GRUPPE_INHALT: Record<Gruppe, string> = {
  wasser: 'Wasserfälle, Seen, Strände',
  thermal: 'Vulkane, Krater, heiße Quellen, Bäder',
  berge: 'Berge, Gletscher, Schluchten, Höhlen',
  aktiv: 'Wanderungen, Tierbeobachtung',
  orte: 'Ortschaften, Museen, Kirchen',
  unterwegs: 'Tunnel, Tankstellen, Flughafen, Leuchttürme',
};

/** Ein Farbton je Gruppe, aus der stärksten Zielart der Gruppe. */
export const GRUPPE_FARBE: Record<Gruppe, string> = {
  wasser: '#0284c7',
  thermal: '#dc2626',
  berge: '#57534e',
  aktiv: '#16a34a',
  orte: '#a16207',
  unterwegs: '#0f766e',
};

export function gruppeVon(kategorie: Kategorie): Gruppe | null {
  return GRUPPE_VON[kategorie];
}
