import { describe, expect, it } from 'vitest';
import { kategorieVon, KATEGORIE_LABEL, type Kategorie } from '@/lib/kategorie';
import { routeFeatures, stoppFeatures } from '@/map/layers';
import { alleStopps, tage, unterkuenfte } from '@/lib/reise';

const stopp = (name: string) => ({ name, wanderung: undefined });

describe('Kategorien', () => {
  it('erkennt die Zielarten am Namen', () => {
    const faelle: Array<[string, Kategorie]> = [
      ['Goðafoss', 'wasserfall'],
      ['Skógafoss', 'wasserfall'],
      ['Blaue Lagune (Bláa Lónið)', 'bad'],
      ['Hot Pot Krosslaug', 'bad'],
      ['Krater Eldborg', 'vulkan'],
      ['Solfatarenfeld Námaskarð', 'vulkan'],
      ['Gletscherlagune Jökulsárlón', 'gletscher'],
      ['Schlucht Fjaðrárgljúfur', 'schlucht'],
      ['Lavahöhle Víðgelmir', 'hoehle'],
      ['Djúpalónssandur', 'strand'],
      ['Tunnel Vaðlaheiðargöng', 'verkehr'],
      ['Freilichtmuseum Glaumbær', 'museum'],
      ['Eiðakirkja', 'kirche'],
    ];
    for (const [name, erwartet] of faelle) {
      expect(kategorieVon(stopp(name)), name).toBe(erwartet);
    }
  });

  it('lässt Eis nicht als Badeort durchgehen', () => {
    // „Lagune" steckt im Namen, gemeint ist aber der Gletschersee.
    expect(kategorieVon(stopp('Gletscherlagune Fjallsárlón'))).toBe('gletscher');
  });

  it('ignoriert den Beschreibungstext', () => {
    // Stykkishólmur hat ein Vulkanmuseum, Akranes einen Hot Pot, Egilsstaðir
    // ein Schwimmbad — Nebensätze, die den Ort falsch einsortieren würden.
    for (const name of ['Stykkishólmur', 'Akranes', 'Egilsstaðir']) {
      expect(kategorieVon(stopp(name)), name).toBe('ort');
    }
  });

  it('gibt jedem der 128 Stopps eine Kategorie mit Label', () => {
    for (const { stopp: s } of alleStopps) {
      const k = kategorieVon(s);
      expect(KATEGORIE_LABEL[k], s.name).toBeTruthy();
    }
  });
});

describe('Kartenquellen', () => {
  it('führt alle verorteten Stopps und Unterkünfte in einer Quelle', () => {
    const fc = stoppFeatures();
    const stopps = alleStopps.filter((s) => s.stopp.pos !== null).length;
    const haeuser = unterkuenfte.filter((u) => u.pos !== null).length;
    expect(fc.features).toHaveLength(stopps + haeuser);
    for (const f of fc.features) {
      expect(f.properties?.icon).toMatch(/^sym-/);
    }
  });

  it('zeichnet die Route durchgehend über alle Tage', () => {
    const fc = routeFeatures();
    expect(fc.features.length).toBeGreaterThan(1);
    // Jedes Segment beginnt dort, wo das vorige endet — keine Lücke zwischen Tagen.
    for (let i = 1; i < fc.features.length; i++) {
      const vorher = fc.features[i - 1]!.geometry.coordinates;
      const jetzt = fc.features[i]!.geometry.coordinates;
      expect(jetzt[0], `Segment ${i}`).toEqual(vorher[vorher.length - 1]);
    }
  });

  it('gibt jedem Segment die Farbe seines Tages', () => {
    const daten = new Set(routeFeatures().features.map((f) => f.properties?.datum));
    for (const d of daten) expect(tage.some((t) => t.datum === d)).toBe(true);
  });
});
