import { expect, test } from '@playwright/test';

/**
 * Smoke: Karte lädt, ein Stopp ist anklickbar, der SSE-Stream kommt an.
 * Mehr will der Requirements-Punkt nicht — es geht um „läuft überhaupt".
 */

test('Karte lädt mit Terrain und Stopps', async ({ page }) => {
  await page.goto('/?tag=2026-08-31');
  await expect(page.getByTestId('map')).toBeVisible();
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();

  // Warten, bis MapLibre den Style und das Terrain hat.
  await page.waitForFunction(
    () => document.querySelectorAll('.maplibregl-ctrl-attrib').length > 0,
    null,
    { timeout: 30_000 },
  );

  await expect(page.getByRole('heading', { name: /Island 2026/ })).toBeVisible();
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

test('Deep Link öffnet das Kontextblatt und streamt eine LLM-Antwort', async ({ page }) => {
  await page.goto('/?tag=2026-08-31&stopp=0');
  const blatt = page.getByTestId('kontextblatt');
  await expect(blatt).toBeVisible();
  await expect(blatt.getByText('LLM-Ausgabe')).toBeVisible();
  // Der Mock streamt Fixtures — irgendein Text muss ankommen.
  await expect(blatt.getByText(/Lage|Im Reiseplan|Gebiet/)).toBeVisible({ timeout: 30_000 });
  await expect(blatt.getByText(/Mock-Antwort aus Fixtures/)).toBeVisible({ timeout: 30_000 });

  await page.locator('body').press('Escape');
  await expect(blatt).toBeHidden();
});

test('API liefert einen SSE-Stream', async ({ request }) => {
  const res = await request.post('/api/ask', {
    data: { art: 'ort', pos: [64.5, -21.2], tagDatum: '2026-08-30' },
  });
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/event-stream');
  const body = await res.text();
  expect(body).toContain('"typ":"start"');
  expect(body).toContain('"typ":"delta"');
  expect(body).toContain('"typ":"ende"');
});

test('API weist ungültige Anfragen ab', async ({ request }) => {
  const res = await request.post('/api/ask', { data: { art: 'unfug' } });
  expect(res.status()).toBe(400);
});
