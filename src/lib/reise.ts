import rohdaten from '@data/reise.json';
import { ReiseSchema, type Reise, type Stopp, type Tag, type Unterkunft } from './schema';

/**
 * Einmalige Validierung beim Modul-Laden. Schlägt sie fehl, bricht der Build —
 * das ist Absicht: eine kaputte reise.json soll nie deployed werden.
 */
export const reise: Reise = ReiseSchema.parse(rohdaten);

export const tage: readonly Tag[] = reise.tage;
export const unterkuenfte: readonly Unterkunft[] = reise.unterkuenfte;

export function tagNach(datum: string | null | undefined): Tag | null {
  if (!datum) return null;
  return tage.find((t) => t.datum === datum) ?? null;
}

export function tagIndex(datum: string): number {
  return tage.findIndex((t) => t.datum === datum);
}

export function unterkunftNach(id: string | null): Unterkunft | null {
  if (!id) return null;
  return unterkuenfte.find((u) => u.id === id) ?? null;
}

/** Stabile ID über die ganze Reise: "2026-09-05#3". */
export function stoppId(datum: string, index: number): string {
  return `${datum}#${index}`;
}

export function stoppNach(id: string | null): { tag: Tag; stopp: Stopp; index: number } | null {
  if (!id) return null;
  const [datum, idxRoh] = id.split('#');
  const tag = tagNach(datum);
  const index = Number(idxRoh);
  if (!tag || !Number.isInteger(index)) return null;
  const stopp = tag.highlights[index];
  return stopp ? { tag, stopp, index } : null;
}

export type StoppRef = {
  id: string;
  datum: string;
  index: number;
  stopp: Stopp;
};

/** Alle Stopps der Reise in Reihenfolge — auch die ohne Position. */
export const alleStopps: readonly StoppRef[] = tage.flatMap((t) =>
  t.highlights.map((stopp, index) => ({
    id: stoppId(t.datum, index),
    datum: t.datum,
    index,
    stopp,
  })),
);

export const verorteteStopps = alleStopps.filter((s) => s.stopp.pos !== null);

/** Stopps, an denen etwas zu buchen ist — was vor der Abreise zu erledigen ist. */
export const buchbareStopps = alleStopps.filter((s) => s.stopp.buchen === true);

/**
 * Was zum Buchen zu sagen ist — in einem Satz, für Karte, Blatt und Ablauf
 * derselbe.
 *
 * Steht im Reiseplan eine Frist („vor Reisebeginn", „Vorausbuchung
 * empfehlenswert"), dann ist sie es, die zählt, und sie steht wörtlich hier.
 * Steht dort keine, wird auch keine erfunden: Der Satz sagt dann, dass es
 * etwas zu buchen gibt und dass der Plan zur Frist schweigt. Eine geratene
 * Frist wäre schlimmer als gar keine — nach ihr würde jemand planen.
 */
export function buchungSatz(stopp: Pick<Stopp, 'buchen' | 'buchenText'>): string | null {
  if (stopp.buchen !== true) return null;
  return stopp.buchenText ?? 'Buchbares Angebot — der Reiseplan nennt dazu keine Frist.';
}

export const kennzahlen = {
  tage: tage.length,
  stopps: alleStopps.length,
  verortet: verorteteStopps.length,
  punktgenau: alleStopps.filter((s) => s.stopp.posMeta?.genauigkeit === 'punkt').length,
  ohnePosition: alleStopps.filter((s) => s.stopp.pos === null).length,
  km: tage.reduce((n, t) => n + (t.etappe?.km ?? 0), 0),
} as const;

export const TAG_FARBE: Record<Tag['typ'], string> = {
  anreise: '#0284c7',
  standtag: '#059669',
  tagesausflug: '#d97706',
  etappe: '#db2777',
  abreise: '#7c3aed',
};

export const TAG_LABEL: Record<Tag['typ'], string> = {
  anreise: 'Anreise',
  standtag: 'Standtag',
  tagesausflug: 'Tagesausflug',
  etappe: 'Etappe',
  abreise: 'Abreise',
};

/**
 * Gehzeit einer Wanderung in Minuten, aus dem Freitext des Reiseplans.
 * Der Veranstalter schreibt „ca. 1 Std.", „1-2 Std.", „45 min", „4,5 Std." —
 * gelesen wird nur, was eindeutig ist. Bei einer Spanne zählt der obere Wert:
 * wer den Tag plant, will wissen, wie lang er höchstens wird.
 */
export function gehzeitMinuten(gehzeit: string | undefined): number | null {
  if (!gehzeit) return null;
  const stunden = [...gehzeit.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:std|stunde)/gi)].map((m) =>
    Number(m[1]!.replace(',', '.')),
  );
  if (stunden.length > 0) return Math.round(Math.max(...stunden) * 60);
  const minuten = [...gehzeit.matchAll(/(\d+)\s*min/gi)].map((m) => Number(m[1]));
  if (minuten.length > 0) return Math.max(...minuten);
  return null;
}

/** Summe der Gehzeiten eines Tages — die Zeit, die nicht im Auto vergeht. */
export function gehzeitTag(datum: string): number {
  const tag = tagNach(datum);
  if (!tag) return 0;
  return tag.highlights.reduce((n, h) => n + (gehzeitMinuten(h.wanderung?.gehzeit) ?? 0), 0);
}

/** Stopps eines Tages, an denen gewandert wird. */
export function wanderungenTag(datum: string): number {
  return tagNach(datum)?.highlights.filter((h) => h.wanderung !== undefined).length ?? 0;
}

/**
 * Eine Dauer in Minuten als Text. Ohne führende „0 h": ein Tag mit sechzehn
 * Minuten Fahrt sagt „16 min", nicht „0 h 16 min".
 */
export function stunden(minuten: number): string {
  const h = Math.floor(minuten / 60);
  const m = minuten % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export function datumKurz(datum: string): string {
  const [, m, d] = datum.split('-');
  return `${d}.${m}.`;
}
