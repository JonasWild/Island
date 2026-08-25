import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ReiseSchema } from '@/lib/schema';
import { alleStopps, kennzahlen, stoppNach, tage, unterkunftNach } from '@/lib/reise';

const roh = JSON.parse(readFileSync(resolve(import.meta.dirname, '../data/reise.json'), 'utf8'));

describe('reise.json', () => {
  it('passt zum Schema', () => {
    expect(ReiseSchema.safeParse(roh).success).toBe(true);
  });

  it('hat 15 Tage in chronologischer Reihenfolge', () => {
    expect(tage).toHaveLength(15);
    const daten = tage.map((t) => t.datum);
    expect([...daten].sort()).toEqual(daten);
  });

  it('verweist nur auf existierende Unterkünfte', () => {
    for (const t of tage) {
      if (t.unterkunft) expect(unterkunftNach(t.unterkunft), t.datum).not.toBeNull();
    }
  });

  it('hält alle 128 Stopps', () => {
    expect(kennzahlen.stopps).toBe(128);
  });

  it('hat für jede Position einen Herkunftsnachweis', () => {
    const ohneBeleg = alleStopps
      .filter((s) => s.stopp.pos !== null && !s.stopp.posMeta)
      .map((s) => `${s.datum} ${s.stopp.name}`);
    expect(ohneBeleg).toEqual([]);
  });

  it('hält alle Positionen im Umgriff Islands', () => {
    for (const { stopp } of alleStopps) {
      if (!stopp.pos) continue;
      expect(stopp.pos[0], stopp.name).toBeGreaterThan(63);
      expect(stopp.pos[0], stopp.name).toBeLessThan(67);
      expect(stopp.pos[1], stopp.name).toBeGreaterThan(-25);
      expect(stopp.pos[1], stopp.name).toBeLessThan(-13);
    }
  });

  it('führt Ferienhäuser als Bereichsangabe', () => {
    const haeuser = ['birkiskogar', 'thrasastadir', 'hlidarendi', 'hlidarholt'];
    for (const id of haeuser) {
      const u = unterkunftNach(id);
      expect(u?.posMeta?.genauigkeit, id).toBe('bereich');
    }
  });
});

describe('Wissen', () => {
  const mitWissen = alleStopps.filter((s) => s.stopp.wissen);

  it('ist überhaupt vorhanden', () => {
    expect(mitWissen.length).toBeGreaterThan(50);
  });

  it('trägt jeder Eintrag Quelle, Link und Prüfdatum', () => {
    for (const { stopp } of mitWissen) {
      const w = stopp.wissen!;
      expect(w.text.length, stopp.name).toBeGreaterThan(20);
      expect(w.quelle, stopp.name).toMatch(/^Wikipedia \(de\): /);
      expect(w.url, stopp.name).toMatch(/^https:\/\/de\.wikipedia\.org\/wiki\//);
      expect(w.geprueftAm, stopp.name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('bleibt leer, wo kein eindeutiger Artikel gefunden wurde', () => {
    // Keine Halbwahrheiten: was nicht eindeutig war, steht in wissen-offen.json.
    const offen = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../data/wissen-offen.json'), 'utf8'),
    ) as { eintraege: Array<{ name: string }> };
    const ohne = new Set(alleStopps.filter((s) => !s.stopp.wissen).map((s) => s.stopp.name));
    for (const e of offen.eintraege) expect(ohne.has(e.name), e.name).toBe(true);
  });
});

describe('Stopp-IDs', () => {
  it('lösen sich zurück auf', () => {
    const erster = alleStopps[0]!;
    const zurueck = stoppNach(erster.id);
    expect(zurueck?.stopp.name).toBe(erster.stopp.name);
  });

  it('liefern null für Unsinn', () => {
    expect(stoppNach('2026-01-01#0')).toBeNull();
    expect(stoppNach('kaputt')).toBeNull();
    expect(stoppNach(null)).toBeNull();
  });
});
