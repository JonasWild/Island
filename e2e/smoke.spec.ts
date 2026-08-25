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

test('Tagesauswahl ist auf jeder Breite bedienbar', async ({ page }) => {
  await stilStubben(page);
  await page.goto('/?tag=2026-08-27');

  // Jedes Tagesziel muss auf dem Handy die Touch-Mindestgröße erfüllen — auf
  // 390 px Breite wäre ein gleichmäßig aufgeteilter Streifen bei 26 px je Tag
  // gelandet. Ab `sm:` darf der Streifen wieder kompakt sein.
  const handy = page.viewportSize()!.width < 640;
  for (const datum of ['2026-08-27', '2026-09-03', '2026-09-10']) {
    const box = await page.getByTestId(`tag-${datum}`).boundingBox();
    expect(box, datum).not.toBeNull();
    expect(box!.width, datum).toBeGreaterThanOrEqual(44);
    if (handy) expect(box!.height, datum).toBeGreaterThanOrEqual(44);
  }

  // Der gewählte Tag rückt von selbst in den sichtbaren Bereich, auch wenn er
  // am anderen Ende des Streifens liegt.
  await page.locator('body').press('ArrowLeft');
  await page.getByTestId('tag-2026-09-10').click();
  await expect(page.getByTestId('tag-2026-09-10')).toBeInViewport();
});

test('Kontextblatt bleibt im Bild und lässt sich schließen', async ({ page }) => {
  await stilStubben(page);
  await page.goto('/?tag=2026-08-27&stopp=0');
  const blatt = page.getByTestId('kontextblatt');
  await expect(blatt).toBeInViewport();

  const seite = page.viewportSize()!;
  const kasten = (await blatt.boundingBox())!;
  expect(kasten.x).toBeGreaterThanOrEqual(0);
  expect(kasten.x + kasten.width).toBeLessThanOrEqual(seite.width + 1);
  // Auf dem Handy über die volle Breite, auf dem Desktop die Spalte rechts.
  if (seite.width < 640) expect(kasten.width).toBe(seite.width);
  else expect(kasten.width).toBeLessThan(seite.width * 0.4);

  const knopf = page.getByTestId('kontextblatt-schliessen');
  const kb = (await knopf.boundingBox())!;
  expect(kb.width).toBeGreaterThanOrEqual(44);
  expect(kb.height).toBeGreaterThanOrEqual(44);
  await knopf.click();
  await expect(blatt).toBeHidden();
});

test('die Bedienelemente überlagern einander nicht', async ({ page }) => {
  await stilStubben(page);
  await page.goto('/');
  const seite = page.viewportSize()!;

  const kasten = async (loc: ReturnType<typeof page.locator>) => (await loc.boundingBox())!;
  const ueberlappt = (a: Awaited<ReturnType<typeof kasten>>, b: typeof a) =>
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

  const pruefen = async (wo: string) => {
    const teile = {
      theme: await kasten(page.getByTestId('schalter-theme')),
      relief: await kasten(page.getByTestId('schalter-relief')),
      zoom: await kasten(page.locator('.maplibregl-ctrl-zoom-in')),
      herkunft: await kasten(page.locator('.maplibregl-ctrl-attrib')),
      streifen: await kasten(page.getByRole('tablist', { name: 'Reisetage' })),
    };

    // Trefferflächen groß genug und vollständig im Bild.
    for (const id of ['theme', 'relief', 'zoom'] as const) {
      const b = teile[id];
      expect(b.height, `${id} ${wo}`).toBeGreaterThanOrEqual(44);
      expect(b.width, `${id} ${wo}`).toBeGreaterThanOrEqual(44);
      expect(b.y + b.height, `${id} ${wo}`).toBeLessThanOrEqual(seite.height);
      expect(b.x, `${id} ${wo}`).toBeGreaterThanOrEqual(0);
    }

    // Nichts verdeckt etwas anderes. Die Herkunftsangabe der Basiskarte ist
    // Bedingung der Nutzung, kein Zierrat — sie muss lesbar bleiben.
    const paare: Array<[keyof typeof teile, keyof typeof teile]> = [
      ['herkunft', 'theme'],
      ['herkunft', 'relief'],
      ['herkunft', 'zoom'],
      ['herkunft', 'streifen'],
      ['zoom', 'streifen'],
      ['zoom', 'theme'],
      ['theme', 'streifen'],
      ['relief', 'streifen'],
    ];
    for (const [a, b] of paare) {
      expect(ueberlappt(teile[a], teile[b]), `${a} überlappt ${b} ${wo}`).toBe(false);
    }
  };

  await pruefen('(Relief aus)');
  // Mit Relief wächst die Herkunftsangabe um den DEM-Anbieter und bricht um —
  // genau der Fall, der die Stapelung vorher zerlegt hat.
  await page.getByTestId('schalter-relief').click();
  await page.waitForFunction(() => window.__islandKarte?.getLayer('relief') != null);
  await pruefen('(Relief an)');
});
