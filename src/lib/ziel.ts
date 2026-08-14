import { alleStopps, datumKurz, tagNach, unterkunftNach } from './reise';
import { KATEGORIE_LABEL, kategorieVon } from './kategorie';
import { formatKoordinate } from './geo';
import type { Bild, Pos } from './schema';
import type { Ziel } from '@/store/mapStore';
import type { Frage } from './llm/types';

/**
 * Ein Ziel — Stopp, Unterkunft oder ein Punkt auf der Karte — in der Form, die
 * Infobox und Detailleiste beide brauchen. Beide zeigen dasselbe Ding, nur
 * unterschiedlich ausführlich; deshalb liegt die Ableitung an einer Stelle.
 */
export type ZielAnsicht = {
  titel: string;
  unter: string;
  /** Ein bis zwei knappe Fakten für die Infobox. */
  fakten: string[];
  text: string;
  bild?: Bild;
  pos: Pos | null;
  frage: Frage | null;
  website?: string;
};

export function ansicht(ziel: Ziel, tagDatum: string): ZielAnsicht | null {
  if (ziel.art === 'stopp') {
    const ref = alleStopps.find((s) => s.id === ziel.id);
    if (!ref) return null;
    const s = ref.stopp;
    const fakten: string[] = [];
    if (s.wanderung) {
      const w = [s.wanderung.distanz, s.wanderung.gehzeit, s.wanderung.hoehenmeter]
        .filter(Boolean)
        .join(' · ');
      if (w) fakten.push(w);
    }
    if (s.buchen) fakten.push('Vorher buchen');
    if (s.strasse) fakten.push(s.strasse);
    return {
      titel: s.name,
      unter: `${datumKurz(ref.datum)} · ${KATEGORIE_LABEL[kategorieVon(s)]}`,
      fakten: fakten.slice(0, 2),
      text: s.text,
      bild: s.bild,
      pos: s.pos,
      frage: { art: 'stopp', stoppId: ziel.id, tagDatum: ref.datum },
    };
  }

  if (ziel.art === 'unterkunft') {
    const u = unterkunftNach(ziel.id);
    if (!u) return null;
    return {
      titel: u.name,
      unter: `Unterkunft · ${datumKurz(u.von)}–${datumKurz(u.bis)}`,
      fakten: [`${u.naechte} Nächte`, u.verpflegung],
      text: u.beschreibung + (u.hinweis ? `\n\n${u.hinweis}` : ''),
      bild: u.bild,
      pos: u.pos,
      frage: null,
      website: u.website,
    };
  }

  const tag = tagNach(tagDatum);
  return {
    titel: 'Was ist hier?',
    unter: formatKoordinate(ziel.pos),
    fakten: tag ? [tag.titel] : [],
    text: '',
    pos: ziel.pos,
    frage: { art: 'ort', pos: ziel.pos, tagDatum },
  };
}

export function zielPos(ziel: Ziel): Pos | null {
  if (ziel.art === 'ort') return ziel.pos;
  if (ziel.art === 'stopp') return alleStopps.find((s) => s.id === ziel.id)?.stopp.pos ?? null;
  return unterkunftNach(ziel.id)?.pos ?? null;
}

export function gleichesZiel(a: Ziel | null, b: Ziel | null): boolean {
  if (!a || !b || a.art !== b.art) return false;
  if (a.art === 'ort' && b.art === 'ort') return a.pos[0] === b.pos[0] && a.pos[1] === b.pos[1];
  return 'id' in a && 'id' in b && a.id === b.id;
}
