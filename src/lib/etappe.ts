import type { Tag } from './schema';
import { tage, unterkuenfte } from './reise';

/**
 * Standzeiten — die Gliederung der Reise.
 *
 * Fünfzehn Tage in einer Reihe sind eine Liste, keine Reise. Was man sich
 * merkt, sind die Quartiere: drei Nächte im Westen, vier am Mývatn, zwei im
 * Osten. Genau daran hängt der Zeitstrahl seine Tage auf.
 *
 * Ein Tag gehört zu der Unterkunft, in der man an seinem **Abend** schläft —
 * das steht so in `reise.json` als `tag.unterkunft`. Der Fahrtag von
 * Borgarfjörður nach Mývatn zählt deshalb schon zur Standzeit am Mývatn.
 *
 * Der Abreisetag hat keine Unterkunft mehr und bildet eine eigene, letzte
 * Standzeit: sechs Quartiere plus Abreise ergeben sieben Abschnitte.
 */

export const ABREISE_ID = 'abreise';

export type Standzeit = {
  id: string;
  /** Name des Quartiers, am Abreisetag der Anlass. */
  name: string;
  ort: string;
  /** Nächte in diesem Quartier; am Abreisetag null. */
  naechte: number | null;
  tage: readonly Tag[];
};

function bauen(): Standzeit[] {
  const abschnitte: Standzeit[] = [];

  for (const tag of tage) {
    const id = tag.unterkunft ?? ABREISE_ID;
    const letzter = abschnitte[abschnitte.length - 1];

    // Zusammenhängende Läufe, nicht nur gleiche IDs: käme ein Quartier später
    // ein zweites Mal, wäre das eine zweite Standzeit und keine Fortsetzung.
    if (letzter && letzter.id === id) {
      (letzter.tage as Tag[]).push(tag);
      continue;
    }

    const haus = unterkuenfte.find((u) => u.id === id);
    abschnitte.push({
      id,
      name: haus?.name ?? 'Abreise',
      ort: haus?.ort ?? 'Keflavík',
      naechte: haus?.naechte ?? null,
      tage: [tag],
    });
  }
  return abschnitte;
}

export const etappen: readonly Standzeit[] = bauen();

export function etappeVon(datum: string): Standzeit | null {
  return etappen.find((e) => e.tage.some((t) => t.datum === datum)) ?? null;
}

/** Die wievielte Nacht in diesem Quartier? `null`, wo keine mehr folgt. */
export function nachtNummer(datum: string): number | null {
  const e = etappeVon(datum);
  if (!e || e.naechte === null) return null;
  const i = e.tage.findIndex((t) => t.datum === datum);
  return i < 0 ? null : i + 1;
}

/** Kurzform für die Kopfzeile: Quartier und Nächte. */
export function etappeName(e: Standzeit): string {
  if (e.naechte === null) return e.name;
  return `${e.name} · ${e.naechte} ${e.naechte === 1 ? 'Nacht' : 'Nächte'}`;
}
