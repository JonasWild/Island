import { deflateSync } from 'node:zlib';
import type { Page, Route } from '@playwright/test';

/**
 * Netzfreier Kartenstil für die Tests.
 *
 * Geprüft wird der eigene Code, nicht die Erreichbarkeit fremder Server. Alle
 * Anfragen an die Basiskarte und an das DEM werden deshalb im Browser
 * abgefangen und lokal beantwortet: der Stil ist gültig, aber leer, die
 * Kacheln kommen nie. Was die Tests sehen — Route, Stopp-Symbole, Labels,
 * Kamera — stammt vollständig aus `reise.json` und liegt in eigenen Quellen.
 *
 * Der Stil trägt bewusst eine `glyphs`-URL: MapLibre lädt für jede
 * Textbeschriftung ein Glyphen-PBF, und eine fehlende URL macht den ganzen
 * Symbol-Layer ungültig. Die abgefangene Antwort ist leer — die Labels
 * bleiben aus (`text-optional: true`), die Symbole zeichnen weiter.
 */

const BASIS = 'https://tiles.openfreemap.org';
const DEM = 'https://s3.amazonaws.com';

/** Hintergrundfarbe je Thema, damit der Style-Wechsel im Test sichtbar bleibt. */
const HINTERGRUND: Record<'bright' | 'dark', string> = {
  bright: '#e7ecef',
  dark: '#12181f',
};

function stubStil(variante: 'bright' | 'dark') {
  return {
    version: 8,
    name: `stub-${variante}`,
    glyphs: `${BASIS}/fonts/{fontstack}/{range}.pbf`,
    sources: {},
    layers: [
      {
        id: 'hintergrund',
        type: 'background',
        paint: { 'background-color': HINTERGRUND[variante] },
      },
    ],
  };
}

async function stil(route: Route, variante: 'bright' | 'dark') {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(stubStil(variante)),
  });
}

/**
 * 256×256-PNG, in dem jedes Pixel für Terrarium-Höhe 0 steht
 * (R=128, G=0, B=0 → 128·256 + 0 + 0/256 − 32768 = 0 m).
 */
function flacheDemKachel(): Buffer {
  const n = 256;
  const roh = Buffer.alloc(n * (1 + n * 3));
  for (let y = 0; y < n; y++) {
    const zeile = y * (1 + n * 3);
    roh[zeile] = 0; // Filtertyp „none"
    for (let x = 0; x < n; x++) roh[zeile + 1 + x * 3] = 128;
  }

  const chunk = (typ: string, daten: Buffer) => {
    const laenge = Buffer.alloc(4);
    laenge.writeUInt32BE(daten.length);
    const koerper = Buffer.concat([Buffer.from(typ, 'ascii'), daten]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(koerper));
    return Buffer.concat([laenge, koerper, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 2; // Farbtyp RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(roh)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const CRC_TABELLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABELLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const FLACHE_DEM_KACHEL = flacheDemKachel();

/**
 * Einmal je Seite aufrufen, vor `page.goto`.
 *
 * Reihenfolge ist wichtig: bei mehreren passenden Mustern gewinnt in
 * Playwright das **zuletzt** registrierte. Die Auffangregel steht deshalb
 * zuerst, die genaueren Muster danach.
 */
export async function karteStubben(page: Page): Promise<void> {
  // Auffangregel: Kacheln und Sprites der Basiskarte kommen nicht.
  await page.route(`${BASIS}/**`, (r) => r.abort());

  // DEM: flache Kachel statt Fehler. Ein abgebrochenes Terrain-Tile füllt die
  // Konsole und lässt die Höhe offen; mit Meereshöhe 0 ist `project()`
  // vorhersagbar — die Kameratests vergleichen Pixel.
  await page.route(`${DEM}/**`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': '*' },
      body: FLACHE_DEM_KACHEL,
    }),
  );

  // Glyphen: gültige, leere Antwort statt eines Fehlers.
  await page.route(`${BASIS}/fonts/**`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/x-protobuf',
      headers: { 'access-control-allow-origin': '*' },
      body: Buffer.alloc(0),
    }),
  );

  await page.route(`${BASIS}/styles/bright*`, (r) => stil(r, 'bright'));
  await page.route(`${BASIS}/styles/dark*`, (r) => stil(r, 'dark'));
}

/**
 * Zählt abgeschlossene Kamerabewegungen mit.
 *
 * „Die Kamera steht" ist direkt nach dem Laden wertlos: der Flug auf den
 * gewählten Tag startet erst, wenn MapLibre `load` meldet — bis dahin steht
 * die Kamera auf der Startposition still, und ein Test, der nur auf Stillstand
 * wartet, misst den falschen Ausschnitt. Genau das ist hier schon einmal
 * schiefgegangen. Deshalb wartet `oeffneKarte` auf einen **abgeschlossenen**
 * Flug, nicht auf Ruhe.
 */
async function bewegungenZaehlen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__fluege = 0;
    const uhr = setInterval(() => {
      const m = window.__islandKarte;
      if (!m) return;
      clearInterval(uhr);
      m.on('moveend', () => {
        window.__fluege = (window.__fluege ?? 0) + 1;
      });
    }, 25);
  });
}

/** Seite mit Stub öffnen und warten, bis die Karte steht — nach dem Tagesflug. */
export async function oeffneKarte(page: Page, pfad = '/'): Promise<void> {
  await bewegungenZaehlen(page);
  await karteStubben(page);
  await page.goto(pfad);
  await page.waitForFunction(() => Boolean(window.__islandKarte?.getLayer('stopp-symbol')), undefined, {
    timeout: 30_000,
  });
  await page.waitForFunction(() => (window.__fluege ?? 0) >= 1, undefined, { timeout: 30_000 });
  await ruhigeKamera(page);
}

/**
 * Wartet, bis die Kamera steht. `queryRenderedFeatures` und `project` liefern
 * während eines Fluges Werte aus einem anderen Ausschnitt.
 */
export async function ruhigeKamera(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const m = window.__islandKarte;
      return Boolean(m) && !m!.isMoving() && !m!.isZooming() && !m!.isRotating();
    },
    undefined,
    { timeout: 30_000 },
  );
}

export type Kamera = { lng: number; lat: number; zoom: number; bearing: number; pitch: number };

export async function kamera(page: Page): Promise<Kamera> {
  return page.evaluate(() => {
    const m = window.__islandKarte!;
    const c = m.getCenter();
    return { lng: c.lng, lat: c.lat, zoom: m.getZoom(), bearing: m.getBearing(), pitch: m.getPitch() };
  });
}

export type Symbolziel = {
  x: number;
  y: number;
  lng: number;
  lat: number;
  name: string;
  id: string;
};

/**
 * Wo liegen die Stopp-Symbole, und wo trifft ein Klick sie?
 *
 * `project()` allein genügt nicht: die Symbole sitzen bei geneigter Kamera
 * nicht zwingend auf ihrem Bodenpunkt. Jede Stelle wird deshalb mit derselben
 * Frage gegengeprüft, die auch der Klick-Handler stellt —
 * `queryRenderedFeatures` an genau dieser Bildschirmstelle.
 */
export async function symbolziele(page: Page): Promise<Symbolziel[]> {
  await ruhigeKamera(page);
  return page.evaluate(() => {
    const m = window.__islandKarte!;
    const { width, height } = m.getCanvas().getBoundingClientRect();
    const ziele: Symbolziel[] = [];
    const gesehen = new Set<string>();

    for (const f of m.queryRenderedFeatures({ layers: ['stopp-symbol'] })) {
      const id = String(f.properties?.id ?? '');
      if (gesehen.has(id)) continue;
      gesehen.add(id);
      const p = m.project((f.geometry as { coordinates: [number, number] }).coordinates);
      if (p.x < 0 || p.y < 0 || p.x > width || p.y > height) continue;
      // Gegenprobe an genau der Stelle, an der auch der Klick landet: nur was
      // hier antwortet, ist wirklich anklickbar.
      const treffer = m.queryRenderedFeatures([p.x, p.y], { layers: ['stopp-symbol'] })[0];
      if (!treffer) continue;
      const [lng, lat] = (f.geometry as { coordinates: [number, number] }).coordinates;
      ziele.push({
        x: Math.round(p.x),
        y: Math.round(p.y),
        lng,
        lat,
        name: String(treffer.properties?.name ?? ''),
        id: String(treffer.properties?.id ?? ''),
      });
    }
    return ziele;
  });
}

/**
 * Ein Symbol, das bequem in der Bildmitte liegt — sicher innerhalb dessen, was
 * die App als frei sichtbar rechnet, also weder unter den Bedienelementen noch
 * unter dem Zeitstrahl.
 */
export async function sichtbarerStopp(page: Page): Promise<Symbolziel> {
  const g = page.viewportSize()!;
  const mitte = { x: g.width / 2, y: g.height * 0.38 };
  const ziel = (await symbolziele(page))
    .filter(
      (p) =>
        p.x > g.width * 0.2 &&
        p.x < g.width * 0.8 &&
        p.y > g.height * 0.18 &&
        p.y < g.height * 0.55 &&
        !p.id.startsWith('unterkunft:'),
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - mitte.x, a.y - mitte.y) - Math.hypot(b.x - mitte.x, b.y - mitte.y),
    )[0];
  if (!ziel) throw new Error('kein frei liegendes Stopp-Symbol im Bild');
  return ziel;
}

export async function klickeStopp(page: Page, ziel: Symbolziel): Promise<void> {
  await page.mouse.click(ziel.x, ziel.y);
}
