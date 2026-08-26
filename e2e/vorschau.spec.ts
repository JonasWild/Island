import { expect, test } from '@playwright/test';
import { klickeStopp, oeffneKarte, ruhigeKamera, sichtbarerStopp, symbolziele } from './stub';

/** Aufgabe 1: Klick auf ein Symbol öffnet eine Blase, nicht das Kontextblatt. */

test('Klick auf ein Symbol öffnet die Vorschau, nicht das Kontextblatt', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-31');
  const ziel = await sichtbarerStopp(page);
  await klickeStopp(page, ziel);

  const blase = page.getByTestId('vorschau');
  await expect(blase).toBeVisible();
  await expect(blase).toContainText(ziel.name);
  await expect(page.getByTestId('kontextblatt')).toBeHidden();
});

test('die Blase führt ins Kontextblatt', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-31');
  await klickeStopp(page, await sichtbarerStopp(page));

  await page.getByTestId('vorschau-mehr').click();
  await expect(page.getByTestId('kontextblatt')).toBeVisible();
  // Zwei Blätter übereinander wären Unsinn — die Blase tritt ab.
  await expect(page.getByTestId('vorschau')).toBeHidden();
});

test('Esc geht Stufe für Stufe zurück', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-31');
  await klickeStopp(page, await sichtbarerStopp(page));
  await page.getByTestId('vorschau-mehr').click();
  await expect(page.getByTestId('kontextblatt')).toBeVisible();

  await page.locator('body').press('Escape');
  await expect(page.getByTestId('kontextblatt')).toBeHidden();
  await expect(page.getByTestId('vorschau')).toBeVisible();

  await page.locator('body').press('Escape');
  await expect(page.getByTestId('vorschau')).toBeHidden();
});

test('Klick auf die leere Karte schließt die Blase', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-31');
  const ziel = await sichtbarerStopp(page);
  await klickeStopp(page, ziel);
  await expect(page.getByTestId('vorschau')).toBeVisible();

  // Eine Stelle ohne Symbol: weit weg vom gewählten Ziel, aber im Bild.
  const leer = await page.evaluate(() => {
    const m = window.__islandKarte!;
    const { width, height } = m.getCanvas().getBoundingClientRect();
    for (let x = 12; x < width - 12; x += 9) {
      for (let y = Math.round(height * 0.45); y < height * 0.6; y += 9) {
        if (m.queryRenderedFeatures([x, y], { layers: ['stopp-symbol'] }).length === 0) {
          return { x, y };
        }
      }
    }
    return null;
  });
  expect(leer, 'eine leere Stelle auf der Karte').not.toBeNull();
  await page.mouse.click(leer!.x, leer!.y);
  await expect(page.getByTestId('vorschau')).toBeHidden();
});

test('die Blase bleibt vollständig im Bild — auch am Rand', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-31');
  const fenster = page.viewportSize()!;

  /*
   * Vier Ziele nacheinander, jedes Mal frisch bestimmt: ein Klick auf ein
   * Symbol bewegt heute noch die Kamera, damit verschieben sich alle
   * Bildschirmkoordinaten. Genommen wird jeweils das Symbol am äußersten
   * linken oder rechten Rand — dort scheitert eine Blase, die nicht klemmt.
   * Ausgespart bleibt, was unter den eigenen Bedienelementen liegt: dort
   * trifft der Klick den Schalter, nicht die Karte.
   */
  const streifen = await page.evaluate(() =>
    Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--streifen-hoehe'),
    ),
  );

  for (let runde = 0; runde < 4; runde++) {
    const ziel = (await symbolziele(page))
      .filter((p) => p.y > 70 && p.y < fenster.height - streifen - 12)
      .sort((a, b) => Math.min(a.x, fenster.width - a.x) - Math.min(b.x, fenster.width - b.x))[0];
    expect(ziel, `Runde ${runde}: ein Symbol am Rand`).toBeTruthy();

    await page.mouse.click(ziel!.x, ziel!.y);
    const blase = page.getByTestId('vorschau');
    await expect(blase).toBeVisible();
    // Erst messen, wenn die Kamera steht: solange sie fliegt, wandert die
    // Blase mit dem Symbol.
    await ruhigeKamera(page);
    const kasten = (await blase.boundingBox())!;
    expect(kasten.x, `${ziel!.name} links`).toBeGreaterThanOrEqual(0);
    expect(kasten.y, `${ziel!.name} oben`).toBeGreaterThanOrEqual(0);
    expect(kasten.x + kasten.width, `${ziel!.name} rechts`).toBeLessThanOrEqual(fenster.width);
    expect(kasten.y + kasten.height, `${ziel!.name} unten`).toBeLessThanOrEqual(fenster.height);

    await page.locator('body').press('Escape');
    await expect(blase).toBeHidden();
  }
});

test('ohne Bild und ohne Text bleibt die Blase brauchbar', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-31');
  const ziel = await sichtbarerStopp(page);
  await klickeStopp(page, ziel);

  // Kein Stopp der Reise trägt heute ein Bild — die Blase steht trotzdem, mit
  // Titel und Weg ins Kontextblatt. Genau das ist der Regelfall, nicht die
  // Ausnahme: 44 der 128 Stopps hätten auch dann keines.
  await expect(page.getByTestId('vorschau').locator('img')).toHaveCount(0);
  await expect(page.getByTestId('vorschau-mehr')).toBeVisible();
});

test('Deep Links öffnen weiterhin das Kontextblatt', async ({ page }) => {
  await oeffneKarte(page, '/?tag=2026-08-31&stopp=0');
  await expect(page.getByTestId('kontextblatt')).toBeVisible();
  await expect(page.getByTestId('vorschau')).toBeHidden();
});
