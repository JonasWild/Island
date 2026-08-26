import { tage, unterkunftNach } from './reise';
import { routeNach } from './route';
import type { Tag, Unterkunft } from './schema';

/**
 * Die Reise besteht nicht aus fünfzehn gleichrangigen Tagen, sondern aus
 * **sechs Standzeiten**: Zeiträumen zwischen zwei Unterkünften. Man packt
 * einmal aus, bleibt eine bis vier Nächte, packt wieder ein. Genau daran
 * hängt, was ein Tag überhaupt sein kann — ein Umzugstag mit Gepäck im Auto
 * oder ein Tag, an dem man abends ins selbe Bett zurückkehrt.
 *
 * Ein Tag gehört zu der Unterkunft, in der man an seinem **Abend** schläft
 * (`tag.unterkunft`). Der Abreisetag hat keine und bildet einen eigenen,
 * letzten Abschnitt.
 *
 * Das ist die Gliederung, nach der der Tagesstreifen aufgebaut ist und in der
 * sich der Reiseplan lesen lässt.
 */
export type Etappe = {
  /** Unterkunft-ID, oder `abreise` für den letzten Tag ohne Übernachtung. */
  id: string;
  unterkunft: Unterkunft | null;
  /** Die Tage, an deren Abend man dort schläft — chronologisch. */
  tage: readonly Tag[];
  /** Erster und letzter Reisetag dieser Standzeit. */
  von: string;
  bis: string;
  /** Kennzahlen über alle Tage der Etappe zusammen. */
  km: number;
  fahrzeitMin: number;
};

function etappenBauen(): Etappe[] {
  const liste: Etappe[] = [];

  for (const tag of tage) {
    const id = tag.unterkunft ?? 'abreise';
    const letzte = liste[liste.length - 1];
    // Aufeinanderfolgende Tage mit derselben Unterkunft bilden eine Etappe.
    // Ein Vergleich mit dem letzten Eintrag reicht: die Tage sind
    // chronologisch, und dieselbe Unterkunft kommt nicht zweimal getrennt vor.
    if (letzte && letzte.id === id) {
      (letzte.tage as Tag[]).push(tag);
      letzte.bis = tag.datum;
    } else {
      liste.push({
        id,
        unterkunft: unterkunftNach(tag.unterkunft),
        tage: [tag],
        von: tag.datum,
        bis: tag.datum,
        km: 0,
        fahrzeitMin: 0,
      });
    }
  }

  for (const etappe of liste) {
    for (const tag of etappe.tage) {
      const gefahren = routeNach(tag.datum);
      if (gefahren?.art !== 'strasse') continue;
      etappe.km += gefahren.km;
      etappe.fahrzeitMin += gefahren.fahrzeitMin;
    }
    etappe.km = Math.round(etappe.km);
  }

  return liste;
}

export const etappen: readonly Etappe[] = etappenBauen();

const etappeJeTag = new Map<string, Etappe>(
  etappen.flatMap((e) => e.tage.map((t) => [t.datum, e] as const)),
);

export function etappeVon(datum: string): Etappe | null {
  return etappeJeTag.get(datum) ?? null;
}

/** Die wievielte Nacht dieser Standzeit ist das? 1-basiert, 0 wenn keine. */
export function nachtNummer(datum: string): number {
  const etappe = etappeVon(datum);
  if (!etappe?.unterkunft) return 0;
  return etappe.tage.findIndex((t) => t.datum === datum) + 1;
}

/** Kurzer Name der Etappe für Überschriften. */
export function etappeName(etappe: Etappe): string {
  return etappe.unterkunft?.name ?? 'Abreise';
}
