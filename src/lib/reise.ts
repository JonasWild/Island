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
  t.highlights.map((stopp, index) => ({ id: stoppId(t.datum, index), datum: t.datum, index, stopp })),
);

export const verorteteStopps = alleStopps.filter((s) => s.stopp.pos !== null);

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

export function datumKurz(datum: string): string {
  const [, m, d] = datum.split('-');
  return `${d}.${m}.`;
}
