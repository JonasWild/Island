import { expect, test, type Locator } from '@playwright/test';
import { oeffneKarte } from './stub';

/** Aufgabe 2: die untere Leiste ist ein lesbarer Zeitstrahl. */

const STANDZEITEN = [
  'birkiskogar',
  'thrasastadir',
  'hlidarendi',
  'nupar',
  'hlidarholt',
  'konvin',
  'abreise',
];

test('der Streifen gliedert die Reise in Standzeiten', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-31');

  await expect(page.locator('[data-testid^="etappe-"]')).toHaveCount(STANDZEITEN.length);
  for (const id of STANDZEITEN) {
    await expect(page.getByTestId(`etappe-${id}`)).toHaveCount(1);
  }

  // Jeder Tag sitzt in genau einer Standzeit, und in der richtigen.
  await expect(
    page.getByTestId('etappe-thrasastadir').getByTestId('tag-2026-08-30'),
  ).toHaveCount(1);
  await expect(
    page.getByTestId('etappe-birkiskogar').getByTestId('tag-2026-08-29'),
  ).toHaveCount(1);
  await expect(page.locator('[data-testid^="tag-2026-"]')).toHaveCount(15);
});

test('jeder Tag trägt seine Tagesart als Symbol', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-31');
  const knoten = page.locator('[data-testid^="tag-2026-"]');
  const anzahl = await knoten.count();
  for (let i = 0; i < anzahl; i++) {
    await expect(knoten.nth(i).locator('svg')).toHaveCount(1);
  }
});

test('der aktive Tag ist als solcher ausgezeichnet und zentriert sich selbst', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-28');
  await expect(page.getByTestId('tag-2026-08-28')).toHaveAttribute('aria-selected', 'true');

  // Ein Tag am anderen Ende der Reise: er muss von allein ins Bild rücken.
  await page.getByTestId('tagestitel').press('Escape');
  for (let i = 0; i < 10; i++) await page.locator('body').press('ArrowRight');
  await expect(page.getByTestId('tag-2026-09-07')).toHaveAttribute('aria-selected', 'true');
  await page.waitForTimeout(700); // scroll-smooth

  const knoten = (await page.getByTestId('tag-2026-09-07').boundingBox())!;
  const strahl = (await page.getByTestId('zeitstrahl').boundingBox())!;
  expect(knoten.x).toBeGreaterThanOrEqual(strahl.x - 1);
  expect(knoten.x + knoten.width).toBeLessThanOrEqual(strahl.x + strahl.width + 1);
});

test('der Tagesablauf ist ohne Suchen erreichbar', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-09-05');

  // Der Weg dorthin ist die Zusammenfassungszeile selbst — sichtbar, benannt
  // und mit einer Trefferfläche, die auf dem Handy trägt.
  const weg = page.getByTestId('tagestitel');
  await expect(weg).toBeVisible();
  await expect(weg).toContainText('Tagesablauf');
  const kasten = (await weg.boundingBox())!;
  expect(kasten.height).toBeGreaterThanOrEqual(44);

  await expect(page.getByTestId('tageszusammenfassung')).toContainText('320 km');

  await weg.click();
  const ablauf = page.getByTestId('tagesablauf');
  await expect(ablauf).toBeVisible();
  await expect(ablauf).toContainText('Fahrt von Ostisland');

  await page.locator('body').press('Escape');
  await expect(ablauf).toBeHidden();
});

test('aus dem Tagesablauf führt ein Stopp zurück auf die Karte', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-31');
  await page.getByTestId('tagestitel').click();
  await page.getByTestId('ablauf-stopp-0').click();

  await expect(page.getByTestId('tagesablauf')).toBeHidden();
  await expect(page.getByTestId('vorschau')).toBeVisible();
});

test('die Leiste meldet ihre Höhe als --streifen-hoehe', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-31');
  const gemeldet = await page.evaluate(() =>
    Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--streifen-hoehe'),
    ),
  );
  const echt = (await page.getByTestId('zeitstrahl').boundingBox())!.height;
  expect(gemeldet).toBeGreaterThan(0);
  expect(Math.abs(gemeldet - echt)).toBeLessThanOrEqual(1);
});

test('nichts überlappt — auch die Herkunftsangabe nicht', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-31');

  const teile: Array<[string, Locator]> = [
    ['Zeitstrahl', page.getByTestId('zeitstrahl')],
    ['Themenschalter', page.getByTestId('thema')],
    ['Navigation', page.locator('.maplibregl-ctrl-top-right')],
    ['Herkunftsangabe', page.locator('.maplibregl-ctrl-attrib')],
  ];

  const kaesten: Array<[string, { x: number; y: number; width: number; height: number }]> = [];
  for (const [name, ort] of teile) {
    await expect(ort, name).toBeVisible();
    kaesten.push([name, (await ort.boundingBox())!]);
  }

  for (let i = 0; i < kaesten.length; i++) {
    for (let j = i + 1; j < kaesten.length; j++) {
      const [na, a] = kaesten[i]!;
      const [nb, b] = kaesten[j]!;
      const ueberlappt =
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(ueberlappt, `${na} überlappt ${nb}`).toBe(false);
    }
  }
});
