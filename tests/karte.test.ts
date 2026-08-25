import { describe, expect, it } from 'vitest';
import { kategorieVon, KATEGORIE_LABEL, type Kategorie } from '@/lib/kategorie';
import { routeFeatures, stoppFeatures } from '@/map/layers';
import { alleStopps, tage, unterkuenfte } from '@/lib/reise';
import { route, routeNach } from '@/lib/route';

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

  it('folgt echten Straßen statt der Luftlinie', () => {
    // Eine Luftlinie zwischen Stopps hätte so viele Stützpunkte wie Stopps.
    // Eine gefahrene Route hat sehr viel mehr.
    for (const f of routeFeatures().features) {
      if (f.properties?.art !== 'strasse') continue;
      const tag = tage.find((t) => t.datum === f.properties!.datum)!;
      expect(f.geometry.coordinates.length, tag.datum).toBeGreaterThan(
        tag.highlights.length * 5,
      );
    }
  });

  it('kennzeichnet jedes Segment als Straße oder Luftlinie', () => {
    for (const f of routeFeatures().features) {
      expect(['strasse', 'luftlinie'], f.properties?.datum).toContain(f.properties?.art);
    }
  });
});

describe('Route aus der Build-Zeit-Pipeline', () => {
  it('deckt alle Reisetage ab', () => {
    for (const t of tage) expect(routeNach(t.datum), t.datum).not.toBeNull();
  });

  it('hält die Kette über alle Tage geschlossen', () => {
    // Jeder Tag beginnt beim letzten Punkt des Vortags — die Pipeline routet so.
    for (let i = 1; i < route.tage.length; i++) {
      const vorher = route.tage[i - 1]!.geometrie;
      expect(route.tage[i]!.geometrie[0], route.tage[i]!.datum).toEqual(
        vorher[vorher.length - 1],
      );
    }
  });

  it('begründet jede Luftlinie', () => {
    // Kein stiller Rückfall: wer keine Straßenroute bekommt, sagt warum.
    for (const t of route.tage) {
      if (t.art === 'luftlinie') expect(t.grund, t.datum).toBeTruthy();
    }
  });

  it('bleibt mit allen Stützpunkten im Umgriff Islands', () => {
    for (const t of route.tage) {
      for (const [lon, lat] of t.geometrie) {
        expect(lat, t.datum).toBeGreaterThan(63);
        expect(lat, t.datum).toBeLessThan(67);
        expect(lon, t.datum).toBeGreaterThan(-25);
        expect(lon, t.datum).toBeLessThan(-13);
      }
    }
  });

  it('bleibt klein genug für den Client', () => {
    // Ungefiltert liefert der Router rund 53 000 Stützpunkte und 1,2 MB.
    const punkte = route.tage.reduce((n, t) => n + t.geometrie.length, 0);
    expect(punkte).toBeLessThan(12_000);
  });
});
