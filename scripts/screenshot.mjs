/**
 * node scripts/screenshot.mjs — Screenshot der gebauten App.
 *
 * Nur ein Entwicklungswerkzeug, kein Teil der App. Es gibt Umgebungen (CI,
 * Container), in denen der Browser die Kachel-Hosts nicht erreicht, Node aber
 * über HTTPS_PROXY schon. Ohne diesen Umweg sieht man eine leere Karte und
 * hält funktionierenden Code für kaputt. Deshalb reicht das Skript die
 * Kartenanfragen durch Node durch.
 *
 * Voraussetzung: `pnpm build && pnpm start -p 3210`.
 *
 * Umgebung:
 *   VP=mobil       Handy-Viewport (390x844) statt Desktop
 *   URL=…          Seite (Standard: http://127.0.0.1:3210/?tag=2026-08-31)
 *   OUT=…          Zieldatei (Standard: karte.png)
 *   RELIEF=1       zusätzlich mit eingeschalteter Schummerung nach OUT2
 */
import { chromium } from '@playwright/test';

process.env.NODE_USE_ENV_PROXY = '1';

const viewport =
  process.env.VP === 'mobil' ? { width: 390, height: 844 } : { width: 1280, height: 800 };

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? undefined,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });

await ctx.route(/(openfreemap|amazonaws|wikimedia)/, async (route) => {
  try {
    // Eigener User-Agent: Wikimedia antwortet sonst mit 429, und die Bilder
    // fehlen im Screenshot, obwohl die App sie im echten Browser lädt.
    const r = await fetch(route.request().url(), {
      headers: { 'User-Agent': 'island-2026-screenshot/1.0 (+https://github.com/JonasWild/Island)' },
    });
    await route.fulfill({
      status: r.status,
      body: Buffer.from(await r.arrayBuffer()),
      headers: { 'content-type': r.headers.get('content-type') ?? 'application/octet-stream' },
    });
  } catch {
    await route.abort();
  }
});

const seite = await ctx.newPage();
seite.on('pageerror', (err) => console.log('[pageerror]', err.message));

await seite.goto(process.env.URL ?? 'http://127.0.0.1:3210/?tag=2026-08-31');
await seite.waitForTimeout(12_000);

const zustand = await seite.evaluate(() => ({
  layer: [
    'route-linie',
    'route-wahlweise',
    'route-luftlinie',
    'route-pfeil',
    'stopp-symbol',
    'stopp-wanderung',
    'stopp-label',
    'ort-symbol',
    'relief',
  ].filter(
    (id) => window.__islandKarte?.getLayer(id) != null,
  ),
  terrain: window.__islandKarte?.getTerrain() != null,
  pitch: window.__islandKarte?.getPitch(),
}));
console.log('Layer:', zustand.layer.join(', '));
console.log('Terrain:', zustand.terrain, '· Pitch:', zustand.pitch);

await seite.screenshot({ path: process.env.OUT ?? 'karte.png', timeout: 60_000 });

if (process.env.RELIEF) {
  await seite.getByTestId('schalter-relief').click();
  await seite.waitForTimeout(12_000);
  await seite.screenshot({ path: process.env.OUT2 ?? 'karte-relief.png', timeout: 60_000 });
}

await browser.close();
