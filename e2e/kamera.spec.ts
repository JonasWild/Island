import { expect, test } from '@playwright/test';
import { kamera, klickeStopp, oeffneKarte, ruhigeKamera, sichtbarerStopp } from './stub';

/** Aufgabe 3: die Kamera fliegt nur, wenn das Ziel es nötig hat. */

/** Wo landet ein Punkt auf dem Bildschirm — und liegt er frei? */
async function lage(page: import('@playwright/test').Page, lng: number, lat: number) {
  return page.evaluate(
    ([x, y]) => {
      const m = window.__islandKarte!;
      const p = m.project([x!, y!]);
      const { width, height } = m.getCanvas().getBoundingClientRect();
      const streifen =
        Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--streifen-hoehe'),
        ) || 96;
      return { x: p.x, y: p.y, width, height, streifen };
    },
    [lng, lat],
  );
}

test('ein frei sichtbares Ziel lässt die Kamera stehen', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-31');
  const vorher = await kamera(page);

  const ziel = await sichtbarerStopp(page);
  await klickeStopp(page, ziel);
  await expect(page.getByTestId('vorschau')).toBeVisible();

  // Genug Zeit, dass ein easeTo längst begonnen hätte.
  await page.waitForTimeout(1200);
  const nachher = await kamera(page);
  expect(nachher.lng, ziel.name).toBeCloseTo(vorher.lng, 6);
  expect(nachher.lat, ziel.name).toBeCloseTo(vorher.lat, 6);
  expect(nachher.zoom, ziel.name).toBeCloseTo(vorher.zoom, 6);
  expect(nachher.pitch, ziel.name).toBeCloseTo(vorher.pitch, 6);
  expect(nachher.bearing, ziel.name).toBeCloseTo(vorher.bearing, 6);
});

test('ein Ziel außerhalb des Bildes holt die Kamera hin', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-31');

  // Weit weg vom Tag: Reykjavík statt Mývatn. Die Stopps des Tages liegen
  // danach gut 400 km außerhalb des Bildes.
  await page.evaluate(() => window.__islandKarte!.jumpTo({ center: [-21.94, 64.14], zoom: 10 }));
  await ruhigeKamera(page);
  const vorher = await kamera(page);

  // Der Weg über den Tagesablauf: ein Ziel wählen, das man gerade nicht sieht.
  await page.getByTestId('tagestitel').click();
  await page.getByTestId('ablauf-stopp-0').click();
  await ruhigeKamera(page);

  const nachher = await kamera(page);
  expect(Math.abs(nachher.lng - vorher.lng) + Math.abs(nachher.lat - vorher.lat)).toBeGreaterThan(
    0.5,
  );

  // Und das Ziel steht danach wirklich im freien Teil des Bildes.
  const blase = page.getByTestId('vorschau');
  await expect(blase).toBeVisible();
  const kasten = (await blase.boundingBox())!;
  const fenster = page.viewportSize()!;
  expect(kasten.x).toBeGreaterThanOrEqual(0);
  expect(kasten.x + kasten.width).toBeLessThanOrEqual(fenster.width);
});

test('auf der Inselübersicht wird trotzdem geflogen', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-31');

  // Ganz Island im Bild: die Ziele liegen als Traube übereinander. Ein Symbol
  // ist dann zwar sichtbar, seine Umgebung aber nicht lesbar.
  await page.evaluate(() => window.__islandKarte!.jumpTo({ center: [-18.9, 64.9], zoom: 5.4 }));
  await ruhigeKamera(page);
  const vorher = await kamera(page);

  const ziel = await sichtbarerStopp(page);
  await klickeStopp(page, ziel);
  await ruhigeKamera(page);

  const nachher = await kamera(page);
  expect(nachher.zoom).toBeGreaterThan(vorher.zoom + 1);
});

test('das Kontextblatt schiebt sein Ziel nicht ins Verdeckte', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-31');
  const ziel = await sichtbarerStopp(page);
  await klickeStopp(page, ziel);
  await expect(page.getByTestId('vorschau')).toBeVisible();

  await page.getByTestId('vorschau-mehr').click();
  const blatt = page.getByTestId('kontextblatt');
  await expect(blatt).toBeVisible();
  await ruhigeKamera(page);

  // Das Blatt liegt auf dem Handy unten, ab `sm:` rechts — geprüft wird
  // deshalb nicht eine Seite, sondern dass das Ziel nicht darunter liegt.
  const p = await lage(page, ziel.lng, ziel.lat);
  const b = (await blatt.boundingBox())!;
  const verdeckt = p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
  expect(verdeckt, 'Ziel liegt hinter dem Kontextblatt').toBe(false);
  expect(p.y, 'Ziel liegt hinter dem Zeitstrahl').toBeLessThan(p.height - p.streifen);
  expect(p.x).toBeGreaterThan(0);
  expect(p.x).toBeLessThan(p.width);
  expect(p.y).toBeGreaterThan(0);
});

test('der Tageswechsel fliegt weiter', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-31');
  const vorher = await kamera(page);

  await page.getByTestId('tag-2026-09-05').click();
  await ruhigeKamera(page);

  const nachher = await kamera(page);
  expect(Math.abs(nachher.lng - vorher.lng) + Math.abs(nachher.lat - vorher.lat)).toBeGreaterThan(
    0.5,
  );
});

test('das Umschalten des Kartenbilds bewegt die Kamera nicht', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-31');
  const vorher = await kamera(page);

  await page.getByTestId('thema').click();
  await page.waitForTimeout(1500);

  const nachher = await kamera(page);
  expect(nachher.lng).toBeCloseTo(vorher.lng, 6);
  expect(nachher.lat).toBeCloseTo(vorher.lat, 6);
  expect(nachher.zoom).toBeCloseTo(vorher.zoom, 6);
});
