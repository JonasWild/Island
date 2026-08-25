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

test('alle erwarteten Layer entstehen', async ({ page }) => {
  // Ungültige Layer-Ausdrücke schlagen in MapLibre still fehl: der Layer wird
  // nicht hinzugefügt, es erscheint nur eine Konsolenmeldung. Deshalb wird die
  // Existenz geprüft, nicht das Aussehen.
  await stilStubben(page);
  await page.goto('/?tag=2026-08-31');
  await page.waitForFunction(() => window.__islandKarte?.getLayer('stopp-symbol') != null);

  const zustand = await page.evaluate(() => ({
    layer: [
      'route-linie',
      'route-wahlweise',
      'route-luftlinie',
      'route-pfeil',
      'stopp-symbol',
      'stopp-wanderung',
      'stopp-label',
      'ort-symbol',
    ].filter((id) => window.__islandKarte!.getLayer(id) != null),
    terrain: window.__islandKarte!.getTerrain() != null,
    pitch: window.__islandKarte!.getPitch(),
    // Die Karte lädt genau einen fremden Kartenhost. Es gab einmal eine
    // DEM-Quelle für eine zuschaltbare Schummerung; sie ist wieder raus.
    quellen: Object.keys(window.__islandKarte!.getStyle().sources).sort(),
  }));

  expect(zustand.layer).toEqual([
    'route-linie',
    'route-wahlweise',
    'route-luftlinie',
    'route-pfeil',
    'stopp-symbol',
    'stopp-wanderung',
    'stopp-label',
    'ort-symbol',
  ]);
  // Kein Terrain, keine Neigung — die Karte ist 2D.
  expect(zustand.terrain).toBe(false);
  expect(zustand.pitch).toBe(0);
  expect(zustand.quellen).not.toContain('terrain-dem');
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

  const pruefen = async () => {
    const teile = {
      theme: await kasten(page.getByTestId('schalter-theme')),
      zoom: await kasten(page.locator('.maplibregl-ctrl-zoom-in')),
      herkunft: await kasten(page.locator('.maplibregl-ctrl-attrib')),
      streifen: await kasten(page.getByRole('tablist', { name: 'Reisetage' })),
    };

    // Trefferflächen groß genug und vollständig im Bild.
    for (const id of ['theme', 'zoom'] as const) {
      const b = teile[id];
      expect(b.height, id).toBeGreaterThanOrEqual(44);
      expect(b.width, id).toBeGreaterThanOrEqual(44);
      expect(b.y + b.height, id).toBeLessThanOrEqual(seite.height);
      expect(b.x, id).toBeGreaterThanOrEqual(0);
    }

    // Nichts verdeckt etwas anderes. Die Herkunftsangabe der Basiskarte ist
    // Bedingung der Nutzung, kein Zierrat — sie muss lesbar bleiben.
    const paare: Array<[keyof typeof teile, keyof typeof teile]> = [
      ['herkunft', 'theme'],
      ['herkunft', 'zoom'],
      ['herkunft', 'streifen'],
      ['zoom', 'streifen'],
      ['zoom', 'theme'],
      ['theme', 'streifen'],
    ];
    for (const [a, b] of paare) {
      expect(ueberlappt(teile[a], teile[b]), `${a} überlappt ${b}`).toBe(false);
    }
  };

  await pruefen();
});

test('die Route liegt auf Straßen, getrennt nach Pflicht und Kür', async ({ page }) => {
  await stilStubben(page);
  await page.goto('/?tag=2026-08-30');
  await page.waitForFunction(() => window.__islandKarte?.getLayer('route-linie') != null);

  const daten = await page.evaluate(() => {
    const map = window.__islandKarte!;
    const quelle = map.getStyle().sources['route'] as { data?: GeoJSON.FeatureCollection };
    const fc = quelle.data as GeoJSON.FeatureCollection<GeoJSON.LineString>;
    return {
      layer: ['route-linie', 'route-wahlweise', 'route-luftlinie', 'route-pfeil'].filter(
        (id) => map.getLayer(id) != null,
      ),
      punkte: fc.features.map((f) => f.geometry.coordinates.length),
      arten: [...new Set(fc.features.map((f) => f.properties?.art))].sort(),
      tage: new Set(fc.features.map((f) => f.properties?.datum)).size,
      pfeilBild: map.hasImage('route-pfeil'),
    };
  });

  // Ungültige Layer-Ausdrücke schlagen in MapLibre still fehl — deshalb wird
  // die Existenz geprüft, nicht das Aussehen.
  expect(daten.layer).toEqual([
    'route-linie',
    'route-wahlweise',
    'route-luftlinie',
    'route-pfeil',
  ]);
  expect(daten.pfeilBild).toBe(true);
  expect(daten.tage).toBe(15);
  for (const art of daten.arten) expect(['pflicht', 'optional', 'luftlinie']).toContain(art);
  // Pflicht und Kür müssen beide vorkommen, sonst trennt die Karte nichts.
  expect(daten.arten).toContain('pflicht');
  expect(daten.arten).toContain('optional');

  /*
    Eine Luftlinie über die Stopps eines Tages hätte höchstens eine Handvoll
    Stützpunkte — über alle 15 Tage keine 150. Eine gefahrene Route hat
    Tausende.
  */
  expect(daten.punkte.reduce((a, b) => a + b, 0)).toBeGreaterThan(3000);

  // Der Tagestitel zeigt die gefahrene Strecke, nicht die Plan-Etappe.
  await expect(page.getByTestId('tagestitel')).toContainText(/\d+ km/);
});

test('Unterkünfte tragen ihr eigenes Symbol mit der Zahl der Nächte', async ({ page }) => {
  await stilStubben(page);
  await page.goto('/?tag=2026-08-27');
  await page.waitForFunction(() => window.__islandKarte?.getLayer('stopp-symbol') != null);

  const daten = await page.evaluate(() => {
    const map = window.__islandKarte!;
    const quelle = map.getStyle().sources['stopps'] as { data?: GeoJSON.FeatureCollection };
    const fc = quelle.data as GeoJSON.FeatureCollection<GeoJSON.Point>;
    const haeuser = fc.features.filter((f) =>
      String(f.properties?.id ?? '').startsWith('unterkunft:'),
    );
    return {
      anzahl: haeuser.length,
      bilder: haeuser.map((f) => String(f.properties?.icon)),
      naechte: haeuser.map((f) => f.properties?.naechte),
      vorhanden: haeuser.every((f) => map.hasImage(String(f.properties?.icon))),
    };
  });

  expect(daten.anzahl).toBe(6);
  expect(daten.vorhanden, 'ein Unterkunftsbild fehlt in der Karte').toBe(true);
  for (const name of daten.bilder) expect(name).toMatch(/^sym-unterkunft-[1-7]$/);
  // Die Nächtezahl steht am Feature und im Bildnamen — beides muss passen.
  for (let i = 0; i < daten.bilder.length; i++) {
    expect(daten.bilder[i]).toBe(`sym-unterkunft-${daten.naechte[i]}`);
  }
});

test('Wanderungen sind am Ziel gekennzeichnet und beziffert', async ({ page }) => {
  await stilStubben(page);
  // 31.08. ist ein Standtag mit vier Wanderungen.
  await page.goto('/?tag=2026-08-31');
  await page.waitForFunction(() => window.__islandKarte?.getLayer('stopp-wanderung') != null);

  const daten = await page.evaluate(() => {
    const map = window.__islandKarte!;
    const quelle = map.getStyle().sources['stopps'] as { data?: GeoJSON.FeatureCollection };
    const fc = quelle.data as GeoJSON.FeatureCollection<GeoJSON.Point>;
    return {
      bild: map.hasImage('sym-fussweg'),
      mitWanderung: fc.features.filter((f) => f.properties?.wanderung === true).length,
      filter: JSON.stringify(map.getFilter('stopp-wanderung')),
    };
  });
  expect(daten.bild, 'das Wanderabzeichen fehlt in der Karte').toBe(true);
  expect(daten.mitWanderung).toBe(16);
  expect(daten.filter).toContain('wanderung');

  // Die Gehzeit des Tages steht im Streifen, nicht nur im Kontextblatt.
  await expect(page.getByTestId('tagestitel')).toContainText(/zu Fuß/);
  // Ein Standtag hat keine Pflichtstrecke — start und Ziel sind dieselbe Unterkunft.
  await expect(page.getByTestId('tagestitel')).toContainText('alles freiwillig');
  await expect(page.getByTestId('tagestitel')).toContainText('Standtag');
});

test('das Kontextblatt zeigt Nächte und Wanderdaten', async ({ page }) => {
  await stilStubben(page);
  // 31.08., Stopp 3 ist die Wanderung Námafjall mit allen drei Angaben.
  await page.goto('/?tag=2026-08-31&stopp=3');
  const blatt = page.getByTestId('kontextblatt');
  await expect(blatt.getByText('Zu Fuß')).toBeVisible();
  await expect(blatt.getByText('2,9 km')).toBeVisible();
  await expect(blatt.getByText('130 m')).toBeVisible();

  await page.goto('/?unterkunft=thrasastadir');
  await expect(blatt.getByText('Übernachtung')).toBeVisible();
  await expect(blatt.getByText('Nächte')).toBeVisible();
  await expect(blatt.getByText('4', { exact: true })).toBeVisible();
});

test('der Filter entlastet die Karte und lässt die Unterkünfte stehen', async ({ page }) => {
  await stilStubben(page);
  await page.goto('/?tag=2026-08-28');
  /*
    Erst den Kameraflug abwarten. `queryRenderedFeatures` liefert nur, was
    gerade im Bild ist — misst man währenddessen, vergleicht man hinterher
    verschiedene Ausschnitte statt verschiedener Filter. Und auf den Layer
    allein zu warten reicht nicht: Symbole werden erst beim nächsten Bild
    platziert.
  */
  await page.waitForFunction(() => window.__islandKarte?.getLayer('stopp-symbol') != null);
  await page.waitForTimeout(2500);
  // Danach die ganze Insel ins Bild setzen: sonst zählt der Test den
  // Kartenausschnitt mit, und der ist auf dem Handy ein anderer als auf dem
  // Desktop. Ab hier ändert sich nur noch der Filter.
  await page.evaluate(() => window.__islandKarte!.jumpTo({ center: [-18.9, 64.9], zoom: 5.2 }));
  await page.waitForTimeout(1200);
  await page.waitForFunction(
    () =>
      (window.__islandKarte?.queryRenderedFeatures(undefined, { layers: ['stopp-symbol'] })
        ?.length ?? 0) > 0,
  );

  const sichtbar = () =>
    page.evaluate(() => {
      const f = window.__islandKarte!.queryRenderedFeatures(undefined, { layers: ['stopp-symbol'] });
      return {
        gesamt: f.length,
        haeuser: f.filter((x) => String(x.properties?.id ?? '').startsWith('unterkunft:')).length,
      };
    });

  /*
    Keine absolute Zahl: `queryRenderedFeatures` liefert nur den sichtbaren
    Ausschnitt, und der ist auf dem Handy ein anderer als auf dem Desktop.
    Geprüft wird, dass die Filter die Zahl **verringern** — darum geht es.
  */
  const alle = await sichtbar();
  expect(alle.gesamt).toBeGreaterThan(5);

  // Nur dieser Tag — die stärkste Entlastung.
  await page.getByTestId('filter-nurtag').click();
  await page.waitForTimeout(400);
  const einTag = await sichtbar();
  expect(einTag.gesamt).toBeLessThan(alle.gesamt);

  // Zusätzlich nach Zielart.
  await page.getByTestId('filter-wasser').click();
  await page.waitForTimeout(400);
  const nurWasser = await sichtbar();
  expect(nurWasser.gesamt).toBeLessThan(einTag.gesamt);

  // „Alle" nimmt die Zielart-Auswahl zurück, nicht den Tagesfilter.
  await page.getByTestId('filter-alle').click();
  await page.waitForTimeout(400);
  expect((await sichtbar()).gesamt).toBe(einTag.gesamt);

  /*
    Unterkünfte tragen keinen Gruppenschlüssel und dürfen sich nicht
    wegfiltern lassen — wo man schläft, ist der Anker des Tages.
  */
  await page.getByTestId('filter-nurtag').click(); // Tagesfilter wieder aus
  await page.getByTestId('filter-berge').click();
  await page.waitForTimeout(400);
  expect((await sichtbar()).haeuser).toBe(alle.haeuser);

  /*
    Und mit Tagesfilter bleibt die Unterkunft der Nacht stehen, obwohl man sie
    am Vortag bezogen hat: sie gilt über ihre ganze Standzeit, nicht nur am
    Anreisetag.
  */
  await page.getByTestId('filter-nurtag').click();
  await page.waitForTimeout(400);
  const dieseNacht = await page.evaluate(() =>
    window
      .__islandKarte!.queryRenderedFeatures(undefined, { layers: ['stopp-symbol'] })
      .filter((x) => String(x.properties?.id ?? '').startsWith('unterkunft:'))
      .map((x) => x.properties?.id),
  );
  expect(dieseNacht).toContain('unterkunft:birkiskogar');
});

test('der Filter bewegt die Kamera nicht', async ({ page }) => {
  // Wer nach Wasserfällen filtert, will nicht, dass die Karte wegspringt.
  await stilStubben(page);
  await page.goto('/?tag=2026-08-28');
  await page.waitForFunction(() => window.__islandKarte?.getLayer('stopp-symbol') != null);
  await page.waitForTimeout(2500);

  const kamera = () =>
    page.evaluate(() => {
      const m = window.__islandKarte!;
      return { ...m.getCenter(), zoom: m.getZoom() };
    });
  const vorher = await kamera();
  await page.getByTestId('filter-wasser').click();
  await page.waitForTimeout(1200);
  const nachher = await kamera();

  expect(Math.abs(nachher.lng - vorher.lng)).toBeLessThan(0.001);
  expect(Math.abs(nachher.lat - vorher.lat)).toBeLessThan(0.001);
  expect(Math.abs(nachher.zoom - vorher.zoom)).toBeLessThan(0.001);
});

test('das Kontextblatt zeigt das Bild mit Urheber und Lizenz', async ({ page }) => {
  await stilStubben(page);
  // 28.08., Stopp 2 ist Hraunfossar — dort hat die Pipeline ein Bild gefunden.
  await page.goto('/?tag=2026-08-28&stopp=2');
  const blatt = page.getByTestId('kontextblatt');
  const bild = blatt.locator('figure img');
  await expect(bild).toHaveAttribute('src', /^https:\/\/upload\.wikimedia\.org\//);
  // Ohne Grössenangaben springt das Blatt beim Laden.
  await expect(bild).toHaveAttribute('width', /^\d+$/);
  await expect(bild).toHaveAttribute('height', /^\d+$/);
  // Bei CC-BY-SA ist die Nennung Bedingung, nicht Höflichkeit.
  await expect(blatt.locator('figcaption')).toContainText(/CC|Public domain/);
  await expect(
    blatt.locator('figcaption').getByRole('link', { name: 'Wikimedia Commons' }),
  ).toHaveAttribute('href', /commons\.wikimedia\.org/);
});

test('der Tagesablauf zeigt die gefahrene Reihenfolge und die Übernachtung', async ({ page }) => {
  await stilStubben(page);
  await page.goto('/?tag=2026-08-30');
  const details = page.getByTestId('tagesdetails');
  await expect(details).toBeHidden();

  await page.getByTestId('tagestitel').click();
  await expect(details).toBeVisible();

  // Kennzahlen des Tages, dieselben wie im Streifen.
  await expect(details).toContainText('Etappe');
  await expect(details).toContainText(/\d+ km/);
  await expect(details).toContainText('Davon Pflicht');

  /*
    Die Reihenfolge ist die gefahrene, nicht die aus reise.json. Am 30.08.
    fährt man von West nach Ost: Blönduós liegt vor Akureyri, Akureyri vor
    Goðafoss. In reise.json stehen sie in derselben Folge nicht garantiert.
  */
  const schritte = await details.locator('ol > li').allInnerTexts();
  const text = schritte.join('\n');
  const vor = (a: string, b: string) => text.indexOf(a) < text.indexOf(b);
  expect(text).toContain('Start:');
  expect(vor('Blönduós', 'Akureyri'), 'Blönduós vor Akureyri').toBe(true);
  expect(vor('Akureyri', 'Goðafoss'), 'Akureyri vor Goðafoss').toBe(true);

  // Die Übernachtung schliesst den Tag ab, mit der Zahl der Nächte.
  const bett = page.getByTestId('tagesdetails-unterkunft');
  await expect(bett).toContainText('Þrasastaðir');
  await expect(bett).toContainText('4');
  await expect(bett).toContainText('Nächte');

  // Ein Schritt führt zurück auf die Karte.
  await details.getByRole('button', { name: /Goðafoss/ }).click();
  await expect(details).toBeHidden();
  await expect(page.getByTestId('kontextblatt')).toContainText('Goðafoss');
});

test('der Tagesablauf trennt gefahrene Ziele von blossen Vorschlägen', async ({ page }) => {
  await stilStubben(page);
  await page.goto('/?tag=2026-08-30');
  await page.getByTestId('tagestitel').click();
  const details = page.getByTestId('tagesdetails');

  /*
    „Skagafjörður & Öxnadalsheiði" ist ein Landschaftsraum ohne punktgenaue
    Position — die Route fährt ihn nicht an. Er steht im Reiseplan und gehört
    deshalb in die Liste, aber nicht als Halt, den es so nicht gibt.
  */
  const ohneHalt = details.locator('section', { hasText: 'Ohne festen Halt' });
  await expect(ohneHalt).toContainText('Skagafjörður');

  await page.getByTestId('tagesdetails-schliessen').click();
  await expect(details).toBeHidden();

  // Esc schliesst ihn ebenfalls, und der Tageswechsel auch.
  await page.getByTestId('tagestitel').click();
  await expect(details).toBeVisible();
  await page.locator('body').press('Escape');
  await expect(details).toBeHidden();
});
