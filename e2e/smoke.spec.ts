import { expect, test } from '@playwright/test';
import { stilStubben } from './stub';

/** Smoke: Karte lädt, Zeitachse wechselt den Tag, Deep Links greifen. */

test('Karte lädt', async ({ page }) => {
  await page.goto('/?tag=2026-08-31');
  await expect(page.getByTestId('map')).toBeVisible();
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
  await expect(page.getByTestId('tag-2026-08-31')).toHaveAttribute('aria-selected', 'true');
});

test('Zeitachse wechselt den Tag und schreibt ihn in die URL', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('tag-2026-09-05').click();
  await expect(page.getByTestId('tag-2026-09-05')).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/tag=2026-09-05/);
});

test('Tastatur blättert durch die Tage', async ({ page }) => {
  await page.goto('/?tag=2026-08-28');
  await page.locator('body').press('ArrowRight');
  await expect(page).toHaveURL(/tag=2026-08-29/);
  await page.locator('body').press('ArrowLeft');
  await expect(page).toHaveURL(/tag=2026-08-28/);
});

test('Deep Link öffnet das Kontextblatt', async ({ page }) => {
  await page.goto('/?tag=2026-08-31&stopp=0');
  const blatt = page.getByTestId('kontextblatt');
  await expect(blatt).toBeVisible();

  await page.locator('body').press('Escape');
  await expect(blatt).toBeHidden();
});

test('Hintergrundtext nennt Quelle und Link', async ({ page }) => {
  // 27.08., Stopp 0 ist die Blaue Lagune — dort hat die Pipeline einen
  // eindeutigen Artikel gefunden.
  await page.goto('/?tag=2026-08-27&stopp=0');
  const blatt = page.getByTestId('kontextblatt');
  await expect(blatt.getByRole('heading', { name: 'Hintergrund' })).toBeVisible();
  await expect(blatt.getByText(/Wikipedia \(de\):/)).toBeVisible();
  await expect(blatt.getByRole('link', { name: 'Artikel öffnen' })).toHaveAttribute(
    'href',
    /de\.wikipedia\.org\/wiki\//,
  );
});

test('alle erwarteten Layer entstehen — und Relief nur auf Wunsch', async ({ page }) => {
  // Ungültige Layer-Ausdrücke schlagen in MapLibre still fehl: der Layer wird
  // nicht hinzugefügt, es erscheint nur eine Konsolenmeldung. Deshalb wird die
  // Existenz geprüft, nicht das Aussehen.
  await stilStubben(page);
  await page.goto('/?tag=2026-08-31');
  await page.waitForFunction(() => window.__islandKarte?.getLayer('stopp-symbol') != null);

  const vorher = await page.evaluate(() => ({
    layer: ['route-linie', 'stopp-symbol', 'stopp-label', 'ort-symbol'].filter(
      (id) => window.__islandKarte!.getLayer(id) != null,
    ),
    relief: window.__islandKarte!.getLayer('relief') != null,
    dem: window.__islandKarte!.getSource('terrain-dem') != null,
    terrain: window.__islandKarte!.getTerrain() != null,
    pitch: window.__islandKarte!.getPitch(),
  }));
  expect(vorher.layer).toEqual(['route-linie', 'stopp-symbol', 'stopp-label', 'ort-symbol']);
  // Kein Terrain, keine Neigung — die Karte ist 2D.
  expect(vorher.terrain).toBe(false);
  expect(vorher.pitch).toBe(0);
  // Ausgeschaltet heißt: die DEM-Quelle existiert gar nicht erst.
  expect(vorher.relief).toBe(false);
  expect(vorher.dem).toBe(false);

  await page.getByTestId('schalter-relief').click();
  await page.waitForFunction(() => window.__islandKarte?.getLayer('relief') != null);
  expect(await page.evaluate(() => window.__islandKarte!.getSource('terrain-dem') != null)).toBe(
    true,
  );

  // Und wieder weg, samt Quelle.
  await page.getByTestId('schalter-relief').click();
  await page.waitForFunction(() => window.__islandKarte?.getSource('terrain-dem') == null);
});
