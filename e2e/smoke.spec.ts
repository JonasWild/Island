import { expect, test } from '@playwright/test';

/**
 * Smoke: Karte lädt, Zeitachse wechselt den Tag, der SSE-Stream kommt an.
 *
 * Der Basisstil wird durch einen minimalen lokalen Stil ersetzt und die
 * DEM-Kacheln laufen ins Leere. Der Test prüft damit den eigenen Code, nicht
 * die Erreichbarkeit fremder Kachelserver — und läuft ohne Netz.
 */
const STUB_STYLE = {
  version: 8,
  name: 'test',
  sources: {},
  layers: [{ id: 'hintergrund', type: 'background', paint: { 'background-color': '#e8eef3' } }],
};

test.beforeEach(async ({ context }) => {
  await context.route(/tiles\.openfreemap\.org/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUB_STYLE) }),
  );
  await context.route(/elevation-tiles-prod|upload\.wikimedia\.org/, (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
});

test('Karte lädt mit Relief, Route und 3D-Modellen', async ({ page }) => {
  await page.goto('/?tag=2026-08-31');
  await expect(page.getByTestId('map')).toBeVisible();
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
  await expect(page.getByTestId('tag-2026-08-31')).toHaveAttribute('aria-selected', 'true');

  await page.waitForFunction(() => !!window.__islandKarte?.isStyleLoaded(), null, {
    timeout: 30_000,
  });
  const layer = await page.evaluate(() =>
    ['relief', 'route-linie', 'stopp-treffer', 'stopp-modelle'].filter(
      (l) => !!window.__islandKarte!.getLayer(l),
    ),
  );
  expect(layer).toEqual(['relief', 'route-linie', 'stopp-treffer', 'stopp-modelle']);
});

test('Zeitachse wechselt den Tag, zeigt die Zusammenfassung und schreibt die URL', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('tag-2026-09-05').click();
  await expect(page.getByTestId('tag-2026-09-05')).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/tag=2026-09-05/);
  await expect(page.getByText('Fahrt von Ostisland zur Gletscherregion Vatnajökull')).toBeVisible();
  await expect(page.getByText('320 km')).toBeVisible();
});

test('Tastatur blättert durch die Tage', async ({ page }) => {
  await page.goto('/?tag=2026-08-28');
  await page.locator('body').press('ArrowRight');
  await expect(page).toHaveURL(/tag=2026-08-29/);
  await page.locator('body').press('ArrowLeft');
  await expect(page).toHaveURL(/tag=2026-08-28/);
});

test('Marker öffnet erst die Infobox, dann die Detailleiste', async ({ page }) => {
  await page.goto('/?tag=2026-08-31');
  await page.waitForFunction(() => !!window.__islandKarte?.isStyleLoaded(), null, {
    timeout: 30_000,
  });

  // Den Bildschirmpunkt eines Markers des Tages über den Trefferlayer finden.
  const treffer = await page.evaluate(() => {
    const m = window.__islandKarte!;
    const { width, height } = m.getCanvas().getBoundingClientRect();
    for (let y = 100; y < height - 160; y += 6) {
      for (let x = 40; x < width - 60; x += 6) {
        const f = m.queryRenderedFeatures([x, y], { layers: ['stopp-treffer'] })[0];
        if (f?.properties?.datum === '2026-08-31') return { x, y };
      }
    }
    return null;
  });
  expect(treffer).not.toBeNull();

  await page.mouse.click(treffer!.x, treffer!.y);
  const mini = page.getByTestId('mini-info');
  await expect(mini).toBeVisible();
  await expect(page.getByTestId('kontextblatt')).toBeHidden();

  await page.getByTestId('mini-details').click();
  await expect(page.getByTestId('kontextblatt')).toBeVisible();

  // Esc arbeitet sich zurück: erst die Leiste, dann die Infobox.
  await page.locator('body').press('Escape');
  await expect(page.getByTestId('kontextblatt')).toBeHidden();
  await expect(mini).toBeVisible();
  await page.locator('body').press('Escape');
  await expect(mini).toBeHidden();
});

test('Deep Link öffnet die Detailleiste und streamt eine Antwort', async ({ page }) => {
  await page.goto('/?tag=2026-08-31&stopp=0');
  const blatt = page.getByTestId('kontextblatt');
  await expect(blatt).toBeVisible();
  await expect(blatt.getByText(/Lage|Im Reiseplan/)).toBeVisible({ timeout: 30_000 });
});

test('ohne API-Schlüssel wird die Antwort als Beispieltext gekennzeichnet', async ({ page }) => {
  test.skip(!!process.env.OPENAI_API_KEY, 'läuft nur ohne Schlüssel');
  await page.goto('/?tag=2026-08-31&stopp=0');
  await expect(page.getByTestId('kontextblatt').getByText(/Kein OPENAI_API_KEY/)).toBeVisible({
    timeout: 30_000,
  });
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
