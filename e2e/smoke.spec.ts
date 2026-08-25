import { expect, test } from '@playwright/test';

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
