import { chromium } from '@playwright/test';
process.env.NODE_USE_ENV_PROXY = '1';

const VIEWPORT = process.env.VP === 'mobil'
  ? { width: 390, height: 844 }
  : { width: 1280, height: 800 };

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await b.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
await ctx.route(/(openfreemap|amazonaws|wikimedia|arcgisonline)/, async (route) => {
  try {
    const r = await fetch(route.request().url());
    await route.fulfill({
      status: r.status,
      body: Buffer.from(await r.arrayBuffer()),
      headers: { 'content-type': r.headers.get('content-type') ?? 'application/octet-stream' },
    });
  } catch (e) {
    await route.abort();
  }
});
const p = await ctx.newPage();
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[konsole]', m.type(), m.text()); });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));

await p.goto(process.env.URL ?? 'http://127.0.0.1:3210/?tag=2026-08-31');
await p.waitForTimeout(12000);

const layer = await p.evaluate(() => {
  const m = window.__islandKarte;
  return { layers: m.getStyle().layers.map((l) => l.id).filter((id) => !id.startsWith('water') ), terrain: !!m.getTerrain?.(), pitch: m.getPitch(), bearing: m.getBearing() };
});
console.log('eigene Layer:', layer.layers.filter((id) => ['route-linie','stopp-symbol','stopp-label','ort-symbol','relief'].includes(id)));
console.log('terrain:', layer.terrain, 'pitch:', layer.pitch, 'bearing:', layer.bearing);

await p.screenshot({ path: process.env.OUT ?? '/tmp/karte.png', timeout: 60000 });

if (process.env.RELIEF) {
  await p.getByTestId('schalter-relief').click();
  await p.waitForTimeout(12000);
  const nach = await p.evaluate(() => ({
    relief: !!window.__islandKarte.getLayer('relief'),
    quelle: !!window.__islandKarte.getSource('terrain-dem'),
  }));
  console.log('nach Umschalten:', nach);
  await p.screenshot({ path: process.env.OUT2 ?? '/tmp/karte-relief.png', timeout: 60000 });
}
await b.close();
