import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ReiseSchema } from '@/lib/schema';
import {
  alleStopps,
  buchbareStopps,
  buchungSatz,
  kennzahlen,
  stoppNach,
  tage,
  unterkuenfte,
  unterkunftNach,
} from '@/lib/reise';

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

  it('verortet alle vier Ferienhäuser aus dem Blatt des Vermieters', () => {
    // Seit dem 01.09.2026 liegt auch für Birkiskógar das Hausblatt vor. Damit
    // hat jedes der vier Ferienhäuser eine Parzelle statt einer Siedlung.
    const haeuser = ['birkiskogar', 'thrasastadir', 'hlidarendi', 'hlidarholt'];
    for (const id of haeuser) {
      const u = unterkunftNach(id);
      expect(u?.hausblatt, id).toBeDefined();
      expect(u?.posMeta?.genauigkeit, id).toBe('punkt');
    }
  });

  it('lässt ein Haus ohne Blatt eine Bereichsangabe bleiben', () => {
    // Die Regel gilt weiter, auch wenn sie gerade auf niemanden zutrifft:
    // Ohne Blatt des Vermieters gibt es keine Parzelle, nur die Siedlung.
    for (const u of unterkuenfte.filter((u) => !u.hausblatt && u.typ.includes('Ferienhaus'))) {
      expect(u.posMeta?.genauigkeit, u.id).toBe('bereich');
    }
  });

  it('verortet Häuser mit Hausblatt punktgenau und belegt es beim Anbieter', () => {
    for (const u of unterkuenfte.filter((u) => u.hausblatt)) {
      expect(u.posMeta?.quelle, u.id).toBe('anbieter');
      expect(u.posMeta?.genauigkeit, u.id).toBe('punkt');
      expect(u.posMeta?.ref, u.id).toContain('Viator');
    }
  });
});

describe('Hausblätter', () => {
  const mitBlatt = unterkuenfte.filter((u) => u.hausblatt);

  it('liegen für alle vier Ferienhäuser vor', () => {
    expect(mitBlatt.map((u) => u.id)).toEqual([
      'birkiskogar',
      'thrasastadir',
      'hlidarendi',
      'hlidarholt',
    ]);
  });

  it('tragen Quelle, Prüfdatum und Objektnummer', () => {
    for (const u of mitBlatt) {
      const h = u.hausblatt!;
      expect(h.quelle, u.id).toContain('Viator Summerhouses');
      expect(h.geprueftAm, u.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(h.code, u.id).toMatch(/^[A-Z]\d{3,4}$/);
    }
  });

  it('beschreiben Anfahrt, Betten und die Handgriffe vor Ort', () => {
    for (const u of mitBlatt) {
      const h = u.hausblatt!;
      expect(h.anfahrt.length, u.id).toBeGreaterThan(100);
      expect(h.schlafen.length, u.id).toBeGreaterThan(1);
      expect(h.abreise.length, u.id).toBeGreaterThan(3);
      expect(h.vorOrt.length, u.id).toBeGreaterThan(0);
    }
  });

  it('führen auf dieselbe Stelle wie die Position', () => {
    // Der Navigationslink kommt aus demselben Blatt wie die Koordinate. Gehen
    // die beiden auseinander, zeigt die Karte woanders hin als das Handy.
    for (const u of mitBlatt) {
      const ziel = new URL(u.hausblatt!.navigation!).searchParams.get('destination')!;
      const [lat, lon] = ziel.split(',').map(Number);
      expect(lat, u.id).toBeCloseTo(u.pos![0], 5);
      expect(lon, u.id).toBeCloseTo(u.pos![1], 5);
    }
  });

  it('enthalten keine Codes und Passwörter', () => {
    // Diese App liegt öffentlich erreichbar bei Vercel, das Hausblatt des
    // Vermieters nicht. Alarmcode, Torcode und WLAN-Passwort bleiben draussen;
    // der Text sagt nur, dass es sie gibt und wo sie stehen.
    const verboten = [/\b2454\b/, /HlidarHolt12/i, /passwort:/i, /\bpin\b\s*[:=]/i];
    for (const u of mitBlatt) {
      const text = JSON.stringify(u.hausblatt);
      for (const muster of verboten) {
        expect(muster.test(text), `${u.id} / ${muster}`).toBe(false);
      }
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

describe('Bilder', () => {
  const mitBild = alleStopps.filter((s) => s.stopp.bilder.length > 0);
  const alleBilder = alleStopps.flatMap((s) => s.stopp.bilder.map((b) => ({ b, name: s.stopp.name })));

  it('sind für den Grossteil der Stopps vorhanden', () => {
    expect(mitBild.length).toBeGreaterThan(70);
  });

  it('liegen bei den meisten Stopps als Streifen vor', () => {
    // Ein Ort ist mehr als ein Blickwinkel. Wo die Belege es hergeben, sind
    // es mehrere Bilder — sonst wäre der Streifen eine leere Geste.
    const mehrere = mitBild.filter((s) => s.stopp.bilder.length > 1);
    expect(mehrere.length).toBeGreaterThan(50);
    for (const { stopp } of mitBild) expect(stopp.bilder.length, stopp.name).toBeLessThanOrEqual(6);
  });

  it('nennen Urheber, Lizenz und Nachweisseite', () => {
    // Ohne Lizenz und Urheber darf nichts eingebunden werden — bei CC-BY-SA
    // ist die Nennung Bedingung, nicht Höflichkeit.
    for (const { b, name } of alleBilder) {
      expect(b.urheber, name).not.toBe('');
      expect(b.lizenz, name).not.toBe('');
      expect(b.seite, name).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      expect(b.url, name).toMatch(/^https:\/\/upload\.wikimedia\.org\//);
      expect(b.breite, name).toBeGreaterThan(0);
      expect(b.hoehe, name).toBeGreaterThan(0);
    }
  });

  it('tragen keine Tracking-Parameter in der URL', () => {
    for (const { b, name } of alleBilder) {
      expect(b.url, name).not.toContain('utm_');
      expect(b.url, name).not.toContain('?');
    }
  });

  it('zeigen Fotos, keine Lagekarten und Wappen', () => {
    // Die deutsche Wikipedia setzt bei Gemeinden gern eine Lagekarte als
    // Leitbild. Ein Kartenausschnitt in einer Karten-App ist nutzlos.
    for (const { b, name } of alleBilder) {
      expect(b.url.toLowerCase(), name).not.toMatch(
        /[_.-](map|karte|locator|flag|wappen|logo)[_.-]|\.svg$/,
      );
    }
  });

  it('stehen nur einmal je Stopp im Streifen', () => {
    for (const { stopp } of mitBild) {
      const urls = stopp.bilder.map((b) => b.url);
      expect(new Set(urls).size, stopp.name).toBe(urls.length);
    }
  });

  it('lassen keinen Urheber den ganzen Streifen füllen', () => {
    // Wer einmal dort stand, hat zwanzig Aufnahmen hochgeladen. Sechs davon
    // nebeneinander sind kein Streifen, sondern eine Wiederholung.
    for (const { stopp } of mitBild) {
      const zaehler = new Map<string, number>();
      for (const b of stopp.bilder) {
        if (b.urheber === 'unbekannt') continue;
        zaehler.set(b.urheber, (zaehler.get(b.urheber) ?? 0) + 1);
      }
      for (const [wer, n] of zaehler) expect(n, `${stopp.name} / ${wer}`).toBeLessThanOrEqual(2);
    }
  });

  it('tragen eine lesbare Bildbeschreibung, wo Commons eine hat', () => {
    const mitText = alleBilder.filter(({ b }) => b.beschreibung);
    expect(mitText.length).toBeGreaterThan(alleBilder.length * 0.7);
    for (const { b, name } of mitText) {
      expect(b.beschreibung!.length, name).toBeLessThanOrEqual(200);
      // Nicht-lateinische Schriften helfen dieser Reisegruppe nicht.
      expect(b.beschreibung!, name).not.toMatch(/[\u0370-\u04FF\u0590-\u05FF\u0600-\u06FF\u4E00-\u9FFF]/);
    }
  });
});

describe('Buchbare Angebote', () => {
  it('kennt die Stopps, an denen etwas zu buchen ist', () => {
    expect(buchbareStopps).toHaveLength(19);
  });

  it('nennt die Ziele mit Frist im Reiseplan', () => {
    // Die vier, bei denen der Plan ausdrücklich auf eine Buchung vor der
    // Abreise dringt — sie sind der Grund, warum das Abzeichen existiert.
    const mitFrist = ['Blaue Lagune (Bláa Lónið)', 'Gletscherlagune Jökulsárlón', 'Naturbad Krauma'];
    for (const name of mitFrist) {
      const treffer = buchbareStopps.filter((s) => s.stopp.name === name);
      expect(treffer.length, name).toBeGreaterThan(0);
      for (const { stopp } of treffer) expect(stopp.buchenText, name).toBeTruthy();
    }
  });

  it('gibt jedem buchbaren Stopp einen Satz', () => {
    for (const { stopp } of buchbareStopps) {
      expect(buchungSatz(stopp), stopp.name).toBeTruthy();
    }
  });

  it('schweigt zu allen anderen', () => {
    // Kein stiller Standardsatz an Stopps ohne Flag: Wo nichts zu buchen ist,
    // steht auch nichts. Sonst wäre das Abzeichen bedeutungslos.
    for (const { stopp } of alleStopps.filter((s) => s.stopp.buchen !== true)) {
      expect(buchungSatz(stopp), stopp.name).toBeNull();
    }
  });

  it('erfindet keine Frist, wo der Reiseplan keine nennt', () => {
    // Eine geratene Frist wäre schlimmer als gar keine — nach ihr würde
    // jemand planen. Der Ersatzsatz sagt deshalb, dass der Plan schweigt.
    const ohneText = buchbareStopps.filter((s) => !s.stopp.buchenText);
    for (const { stopp } of ohneText) {
      expect(buchungSatz(stopp), stopp.name).toContain('keine Frist');
    }
  });

  it('flaggt keine Unterkunft und keinen Tunnel als Ausflug', () => {
    // Vaðlaheiðargöng trägt das Flag, weil die Maut vor der Durchfahrt
    // registriert werden muss — dieselbe Mechanik, dieselbe Farbe.
    const tunnel = buchbareStopps.find((s) => s.stopp.name.includes('Vaðlaheiðargöng'));
    expect(tunnel?.stopp.buchenText).toContain('Registrierung');
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
