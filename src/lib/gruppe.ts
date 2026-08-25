import type { Kategorie } from './kategorie';

/**
 * Sechs Filter waren immer noch zu viele für eine Leiste, die auf 390 px
 * lesbar bleiben soll — und sie zwangen zu Bündelungen, die niemand von
 * aussen errät („Baden" bei den Vulkanen).
 *
 * Deshalb **drei** Gruppen, die die eigentliche Frage stellen: Landschaft
 * anschauen, etwas tun, oder Orte und Gebautes. Die genaue Zielart wählt man
 * darin aus — die Leiste bleibt schmal, die Feinauswahl bleibt möglich.
 *
 * Unterkünfte stehen in **keiner** Gruppe: sie lassen sich nicht wegfiltern.
 * Wo man schläft, ist der Anker des Tages und muss sichtbar bleiben, auch
 * wenn man gerade nur nach Wasserfällen sucht.
 */
export type Gruppe = 'natur' | 'aktiv' | 'orte';

export const GRUPPEN: readonly Gruppe[] = ['natur', 'aktiv', 'orte'];

export const GRUPPE_LABEL: Record<Gruppe, string> = {
  natur: 'Natur',
  aktiv: 'Aktiv',
  orte: 'Orte',
};

/**
 * Die Zielarten je Gruppe, in der Reihenfolge, in der sie im Aufklapper
 * stehen: das Häufigste zuerst.
 */
export const GRUPPE_ARTEN: Record<Gruppe, readonly Kategorie[]> = {
  natur: ['wasserfall', 'vulkan', 'berg', 'see', 'gletscher', 'schlucht', 'strand', 'hoehle'],
  aktiv: ['wanderung', 'bad', 'tier'],
  orte: ['ort', 'museum', 'kirche', 'verkehr'],
};

export const GRUPPE_FARBE: Record<Gruppe, string> = {
  natur: '#0284c7',
  aktiv: '#16a34a',
  orte: '#a16207',
};

const ZU_GRUPPE = new Map<Kategorie, Gruppe>(
  GRUPPEN.flatMap((g) => GRUPPE_ARTEN[g].map((k) => [k, g] as const)),
);

export function gruppeVon(kategorie: Kategorie): Gruppe | null {
  return ZU_GRUPPE.get(kategorie) ?? null;
}

/** Alle filterbaren Zielarten — alles ausser der Unterkunft. */
export const FILTERBAR: readonly Kategorie[] = GRUPPEN.flatMap((g) => GRUPPE_ARTEN[g]);
