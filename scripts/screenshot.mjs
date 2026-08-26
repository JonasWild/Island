// @ts-check
/**
 * Screenshot der laufenden App — das Auge auf das Ergebnis.
 *
 * In Containern erreicht der Browser die Kachel-Hosts nicht: der ausgehende
 * Verkehr läuft über einen Proxy, dessen CA im frischen Browserprofil nicht
 * hinterlegt ist. Node dagegen kommt über `HTTPS_PROXY` und
 * `NODE_EXTRA_CA_CERTS` durch. Dieses Skript reicht die Kartenanfragen
 * deshalb durch Node hindurch, statt dem Browser einen Proxy zu geben — ohne
 * das sieht man eine leere Karte und hält funktionierenden Code für kaputt.
 *
 *   VP=mobil URL="http://127.0.0.1:3210/?tag=2026-08-28" OUT=/tmp/m.png \
 *     PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium \
 *     NODE_USE_ENV_PROXY=1 node scripts/screenshot.mjs
 */
import { chromium } from '@playwright/test';

/** `mobil` ist bewusst 390 px breit — die Bezugsgröße des Entwurfs. */
const VIEWPORTS = {
  mobil: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  tablet: { viewport: { width: 834, height: 1112 }, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

/** Hosts, deren Antworten Node für den Browser holt. */
const DURCHREICHEN = ['https://tiles.openfreemap.org/', 'https://s3.amazonaws.com/'];

const vp = process.env.VP ?? 'mobil';
const url = process.env.URL ?? 'http://127.0.0.1:3210/';
const out = process.env.OUT ?? `/tmp/island-${vp}.png`;
const warten = Number(process.env.WARTEN ?? 12000);

const einstellung = VIEWPORTS[vp];
if (!einstellung) {
  console.error(`Unbekannter Viewport "${vp}" — bekannt: ${Object.keys(VIEWPORTS).join(', ')}`);
  process.exit(1);
}

const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
    : {}),
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});

const context = await browser.newContext(einstellung);
const page = await context.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') console.log('  [konsole]', m.text().slice(0, 200));
});

let geholt = 0;
let gescheitert = 0;
for (const praefix of DURCHREICHEN) {
  await page.route(`${praefix}**`, async (route) => {
    try {
      const antwort = await fetch(route.request().url(), { redirect: 'follow' });
      const koerper = Buffer.from(await antwort.arrayBuffer());
      geholt++;
      await route.fulfill({
        status: antwort.status,
        contentType: antwort.headers.get('content-type') ?? 'application/octet-stream',
        headers: { 'access-control-allow-origin': '*' },
        body: koerper,
      });
    } catch (e) {
      gescheitert++;
      console.log('  [durchreichen]', String(e).slice(0, 120));
      await route.abort();
    }
  });
}

await page.goto(url, { waitUntil: 'load' });
// Kacheln, Terrain und Kameraflug brauchen Zeit; „idle" meldet MapLibre nicht.
await page.waitForTimeout(warten);
await page.screenshot({ path: out, fullPage: false });
console.log(`${out}  (${vp}, ${url})  Kartenanfragen: ${geholt} ok, ${gescheitert} gescheitert`);

await browser.close();
