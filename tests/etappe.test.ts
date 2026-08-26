import { describe, expect, it } from 'vitest';
import { ABREISE_ID, etappen, etappeName, etappeVon, nachtNummer } from '@/lib/etappe';
import { tage, unterkuenfte } from '@/lib/reise';

describe('Standzeiten', () => {
  it('gliedert die Reise in sechs Quartiere plus Abreise', () => {
    expect(etappen).toHaveLength(unterkuenfte.length + 1);
    expect(etappen[etappen.length - 1]!.id).toBe(ABREISE_ID);
  });

  it('teilt jeden Tag genau einer Standzeit zu', () => {
    expect(etappen.flatMap((e) => e.tage)).toHaveLength(tage.length);
    for (const t of tage) expect(etappeVon(t.datum), t.datum).not.toBeNull();
  });

  it('lässt die Tage in der Reihenfolge der Reise', () => {
    const daten = etappen.flatMap((e) => e.tage.map((t) => t.datum));
    expect(daten).toEqual(tage.map((t) => t.datum));
  });

  it('rechnet einen Tag der Unterkunft seines Abends zu', () => {
    // Der Fahrtag nach Mývatn gehört schon zur Standzeit dort, nicht mehr zu
    // Borgarfjörður — geschlafen wird am Abend in Þrasastaðir.
    expect(etappeVon('2026-08-30')?.id).toBe('thrasastadir');
    expect(etappeVon('2026-08-29')?.id).toBe('birkiskogar');
  });

  it('zählt die Nächte innerhalb einer Standzeit', () => {
    expect(nachtNummer('2026-08-30')).toBe(1);
    expect(nachtNummer('2026-09-02')).toBe(4);
    // Am Abreisetag folgt keine Nacht mehr.
    expect(nachtNummer('2026-09-10')).toBeNull();
  });

  it('deckt die Nächtezahl der Standzeit mit der Unterkunft', () => {
    for (const e of etappen) {
      if (e.naechte === null) continue;
      expect(e.tage.length, e.name).toBe(e.naechte);
    }
  });

  it('beschriftet die Abschnitte lesbar', () => {
    expect(etappeName(etappen[0]!)).toBe('Birkiskógar · 3 Nächte');
    expect(etappeName(etappen[3]!)).toBe('Fosshótel Núpar · 1 Nacht');
    expect(etappeName(etappen[6]!)).toBe('Abreise');
  });
});
