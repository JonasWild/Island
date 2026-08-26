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

/** Seite mit Stub öffnen und warten, bis die Karte ihre Layer gesetzt hat. */
export async function oeffneKarte(page: Page, pfad = '/'): Promise<void> {
  await karteStubben(page);
  await page.goto(pfad);
  await page.waitForFunction(
    () => Boolean(window.__islandKarte?.getLayer('stopp-symbol')),
    undefined,
    { timeout: 30_000 },
  );
  await ruhigeKamera(page);
}

/**
 * Wartet, bis die Kamera steht. `queryRenderedFeatures` und `project` liefern
 * während eines Fluges Werte aus einem anderen Ausschnitt — genau daran ist
 * hier schon einmal ein Vergleich zerbrochen.
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
