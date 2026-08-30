import { expect, type Page, test } from '@playwright/test';
import { stilStubben } from './stub';

/**
 * Bildschirmposition eines Stopps, der frei in der Mitte liegt.
 *
 * `queryRenderedFeatures()[0]` reicht nicht: das erste Symbol kann unter der
 * Filterleiste oben oder dem Tagesstreifen unten stecken, und der Klick träfe
 * dann die Bedienleiste statt die Karte.
 */
async function freiesSymbol(page: Page, name?: string) {
  return page.evaluate((n) => {
    const m = window.__islandKarte!;
    const c = m.getContainer().getBoundingClientRect();
    const kandidaten = m
      .queryRenderedFeatures(undefined, { layers: ['stopp-symbol'] })
      .filter((f) => (n ? String(f.properties?.name ?? '').includes(n) : true));
    for (const f of kandidaten) {
      if (f.geometry.type !== 'Point') continue;
      const p = m.project(f.geometry.coordinates as [number, number]);
      // Grosszügig von allen Rändern weg: oben die Filterleiste, unten der
      // Streifen, rechts die Zoom-Knöpfe.
      if (p.x > 90 && p.x < c.width - 90 && p.y > 130 && p.y < c.height - 230) {
        return { x: p.x, y: p.y, name: String(f.properties?.name ?? '') };
      }
    }
    return null;
  }, name);
}

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
  expect(daten.layer).toEqual(['route-linie', 'route-wahlweise', 'route-luftlinie', 'route-pfeil']);
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

  // Die Zusammenfassung zeigt die gefahrene Strecke, nicht die Plan-Etappe.
  await expect(page.getByTestId('tageszusammenfassung')).toContainText(/\d+ km/);
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
  const zusammenfassung = page.getByTestId('tageszusammenfassung');
  await expect(zusammenfassung).toContainText(/zu Fuß/);
  await expect(zusammenfassung).toContainText('Standtag');
  // Ein Standtag hat keine Pflichtstrecke — Start und Ziel sind dieselbe
  // Unterkunft. Der Tagesablauf sagt es in Worten.
  await page.getByTestId('tagestitel').click();
  await expect(page.getByTestId('tagesdetails')).toContainText('alles freiwillig');
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
  // Exakt: der Hinweis am Haus spricht vom „Übernachtungsplan".
  await expect(blatt.getByText('Übernachtung', { exact: true })).toBeVisible();
  await expect(blatt.getByText('Nächte')).toBeVisible();
  await expect(blatt.getByText('4', { exact: true })).toBeVisible();
});

test('das Kontextblatt zeigt das Hausblatt des Vermieters', async ({ page }) => {
  await stilStubben(page);
  await page.goto('/?unterkunft=thrasastadir');
  const blatt = page.getByTestId('kontextblatt');

  // Der Widerspruch zwischen Reiseplan und Vermieter steht am Haus, nicht in
  // einer Datei daneben.
  await expect(blatt.getByTestId('kontextblatt-hinweis')).toContainText('Ljósavatn');

  const hausblatt = blatt.getByTestId('kontextblatt-hausblatt');
  await expect(hausblatt).toContainText('Hausblatt N3018');
  await expect(hausblatt).toContainText('216 1801');
  // Die letzten Meter sind der schwierige Teil: das Schild muss dastehen.
  await expect(hausblatt).toContainText('Arnarstapi');

  // Die langen Listen liegen eingeklappt und öffnen auf Tippen.
  const abreise = hausblatt.getByTestId('hausblatt-abreise');
  await expect(abreise.getByText('Schlüsselkasten')).toBeHidden();
  await abreise.getByText('Bei Abreise').click();
  await expect(abreise.getByText(/Schlüsselkasten/)).toBeVisible();
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
      const f = window.__islandKarte!.queryRenderedFeatures(undefined, {
        layers: ['stopp-symbol'],
      });
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

  // Zusätzlich nach Zielart — über den Aufklapper der Gruppe.
  await page.getByTestId('filter-natur').click();
  await page.getByTestId('kategorie-wasserfall').click();
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
  await page.getByTestId('filter-natur').click();
  await page.getByTestId('kategorie-berg').click();
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
  await page.getByTestId('filter-natur').click();
  await page.getByTestId('kategorie-wasserfall').click();
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

test('der Aufklapper wählt einzelne Zielarten', async ({ page }) => {
  await stilStubben(page);
  await page.goto('/');
  const aufklapper = page.getByTestId('aufklapper-natur');
  await expect(aufklapper).toBeHidden();

  await page.getByTestId('filter-natur').click();
  await expect(aufklapper).toBeVisible();
  // Alle acht Zielarten der Gruppe stehen einzeln darin, jede mit ihrer Zahl.
  for (const k of [
    'wasserfall',
    'vulkan',
    'berg',
    'see',
    'gletscher',
    'schlucht',
    'strand',
    'hoehle',
  ]) {
    await expect(aufklapper.getByTestId(`kategorie-${k}`)).toBeVisible();
  }

  // Eine Art wählen: der Chip zeigt danach 1 von 8.
  await page.getByTestId('kategorie-wasserfall').click();
  await expect(page.getByTestId('filter-natur')).toContainText('1/8');
  await expect(page.getByTestId('filter-natur')).toHaveAttribute('aria-pressed', 'true');

  // „Alles in Natur" nimmt bei gemischter Auswahl die ganze Gruppe heraus.
  await page.getByTestId('aufklapper-alles-natur').click();
  await expect(page.getByTestId('filter-natur')).toHaveAttribute('aria-pressed', 'false');

  // Und wählt sie beim nächsten Tippen komplett.
  await page.getByTestId('aufklapper-alles-natur').click();
  await expect(page.getByTestId('filter-natur')).toContainText('8/8');

  // Der Aufklapper muss ins Bild passen — sonst wählt man nichts aus.
  const seite = page.viewportSize()!;
  const kasten = (await aufklapper.boundingBox())!;
  expect(kasten.x).toBeGreaterThanOrEqual(0);
  expect(kasten.x + kasten.width).toBeLessThanOrEqual(seite.width + 1);

  await page.getByTestId('filter-alle').click();
  await expect(aufklapper).toBeHidden();
  await expect(page.getByTestId('filter-alle')).toHaveAttribute('aria-pressed', 'true');
});

test('der Streifen gliedert die Reise in Standzeiten', async ({ page }) => {
  await stilStubben(page);
  await page.goto('/?tag=2026-08-31');

  /*
    Sechs Unterkünfte plus der Abreisetag ohne Bett: sieben Blöcke. Jeder
    trägt den Namen seines Quartiers und die Zahl der Nächte — das ist die
    Klammer, ohne die fünfzehn Tage zusammenhanglose Kästchen sind.
  */
  const bloecke = page.locator('[data-testid^="etappe-"]');
  await expect(bloecke).toHaveCount(7);

  const thrasastadir = page.getByTestId('etappe-thrasastadir');
  await expect(thrasastadir).toContainText('Þrasastaðir');
  await expect(thrasastadir).toContainText('4');
  // Die vier Tage dieser Standzeit liegen in ihrem Block, kein anderer.
  for (const d of ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']) {
    await expect(thrasastadir.getByTestId(`tag-${d}`)).toBeVisible();
  }
  await expect(thrasastadir.getByTestId('tag-2026-09-03')).toHaveCount(0);

  /*
    Die Zusammenfassung nennt Art und Kennzahlen des Tages — die wievielte
    Nacht es ist, steht im Tagesablauf. Die Leiste beantwortet „wann und wie",
    nicht „was genau".
  */
  await expect(page.getByTestId('tageszusammenfassung')).toContainText('Standtag');
  await expect(page.getByTestId('tageszusammenfassung')).not.toContainText('Nacht');
});

test('der Tagesablauf ist ohne Suchen erreichbar und blättert in der Standzeit', async ({
  page,
}) => {
  await stilStubben(page);
  await page.goto('/?tag=2026-08-31');

  /*
    Eine beschriftete Zeile über die volle Breite, keine versteckte Titelzeile.
    Geprüft wird der zugängliche Name, nicht der Fliesstext: sichtbar steht
    dort „Ablauf ›", vorgelesen wird der ganze Satz.
  */
  const knopf = page.getByTestId('tagestitel');
  await expect(knopf).toHaveAttribute('aria-label', /Tagesablauf am .* ansehen/);
  await expect(knopf).toContainText('Ablauf');
  const box = (await knopf.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);

  await knopf.click();
  const details = page.getByTestId('tagesdetails');
  await expect(details).toBeVisible();
  // Zuerst die Standzeit, dann der Tag darin.
  await expect(details).toContainText('Þrasastaðir');
  await expect(details).toContainText('Nacht 2 von 4');
  await expect(details).toContainText('2 / 4');

  // Blättern bleibt innerhalb der Standzeit.
  await page.getByTestId('tagesdetails-vor').click();
  await expect(details).toContainText('3 / 4');
  await expect(details).toContainText('Nacht 3 von 4');
  await page.getByTestId('tagesdetails-zurueck').click();
  await page.getByTestId('tagesdetails-zurueck').click();
  await expect(details).toContainText('1 / 4');
  // Am Anfang der Standzeit ist Schluss — der Sprung ins nächste Quartier ist
  // ein anderer Schritt.
  await expect(page.getByTestId('tagesdetails-zurueck')).toBeDisabled();
});

test('ein Klick auf ein Symbol öffnet die Vorschau, nicht das Kontextblatt', async ({ page }) => {
  await stilStubben(page);
  await page.goto('/?tag=2026-08-28');
  await page.waitForFunction(
    () =>
      (window.__islandKarte?.queryRenderedFeatures(undefined, { layers: ['stopp-symbol'] })
        ?.length ?? 0) > 0,
  );
  await page.waitForTimeout(2500);

  const vorschau = page.getByTestId('vorschau');
  const blatt = page.getByTestId('kontextblatt');
  await expect(vorschau).toBeHidden();

  const punkt = await freiesSymbol(page);
  expect(punkt, 'kein frei liegendes Symbol im Bild').not.toBeNull();
  await page.mouse.click(punkt!.x, punkt!.y);

  await expect(vorschau).toBeVisible();
  await expect(blatt).toBeHidden();
  // Ein bis zwei Sätze, kein abgeschnittener Halbsatz.
  await expect(vorschau).not.toContainText(/[a-zäöüß] …$/);

  // Sie muss ins Bild passen — sonst zeigt sie nichts.
  const seite = page.viewportSize()!;
  const kasten = (await vorschau.boundingBox())!;
  expect(kasten.x).toBeGreaterThanOrEqual(0);
  expect(kasten.x + kasten.width).toBeLessThanOrEqual(seite.width + 1);

  // „Mehr" löst sie durch das Kontextblatt ab — beides gleichzeitig wäre doppelt.
  await page.getByTestId('vorschau-mehr').click();
  await expect(blatt).toBeVisible();
  await expect(vorschau).toBeHidden();
});

test('die Vorschau schliesst über Kreuz, Esc und Klick ins Leere', async ({ page }) => {
  await stilStubben(page);
  await page.goto('/?tag=2026-08-28');
  await page.waitForFunction(
    () =>
      (window.__islandKarte?.queryRenderedFeatures(undefined, { layers: ['stopp-symbol'] })
        ?.length ?? 0) > 0,
  );
  await page.waitForTimeout(2500);

  const vorschau = page.getByTestId('vorschau');
  const oeffnen = async () => {
    const p = await freiesSymbol(page);
    expect(p, 'kein frei liegendes Symbol im Bild').not.toBeNull();
    await page.mouse.click(p!.x, p!.y);
    await expect(vorschau).toBeVisible();
  };

  await oeffnen();
  await page.getByTestId('vorschau-schliessen').click();
  await expect(vorschau).toBeHidden();

  await oeffnen();
  await page.locator('body').press('Escape');
  await expect(vorschau).toBeHidden();
});

test('ein sichtbares Ziel lässt die Kamera stehen, ein entferntes nicht', async ({ page }) => {
  await stilStubben(page);
  await page.goto('/?tag=2026-08-28');
  await page.waitForFunction(
    () =>
      (window.__islandKarte?.queryRenderedFeatures(undefined, { layers: ['stopp-symbol'] })
        ?.length ?? 0) > 0,
  );
  await page.waitForTimeout(2500);

  const kamera = () =>
    page.evaluate(() => {
      const m = window.__islandKarte!;
      return { ...m.getCenter(), zoom: m.getZoom() };
    });

  /*
    Wer auf ein Symbol tippt, das er gerade ansieht, will nicht, dass die Karte
    darunter wegrutscht. Bewusst ohne Zoom-Schwelle: der Kameraflug auf einen
    Tag landet je nach Ausdehnung zwischen Zoom 6 und 10,5, und jede Schwelle
    darin hätte fast jeden Klick wieder zu einer Fahrt gemacht.
  */
  const punkt = await freiesSymbol(page);
  expect(punkt, 'kein frei liegendes Symbol im Bild').not.toBeNull();
  const vorher = await kamera();
  await page.mouse.click(punkt!.x, punkt!.y);
  await page.waitForTimeout(1500);
  const nachher = await kamera();

  expect(Math.abs(nachher.lng - vorher.lng), 'Kamera ist gewandert').toBeLessThan(0.001);
  expect(Math.abs(nachher.lat - vorher.lat), 'Kamera ist gewandert').toBeLessThan(0.001);
  expect(Math.abs(nachher.zoom - vorher.zoom), 'Zoom hat sich geändert').toBeLessThan(0.001);

  /*
    Ein Ziel ausserhalb des Bildes dagegen muss geholt werden. Dafür wird die
    Karte weit weggeschoben und danach ein Ziel über den Tagesablauf gewählt —
    derselbe Weg, den auch ein Nutzer nimmt.
  */
  await page.getByTestId('vorschau-schliessen').click();
  await page.evaluate(() => window.__islandKarte!.jumpTo({ center: [-15.0, 65.0], zoom: 9 }));
  await page.waitForTimeout(600);
  const weggeschoben = await kamera();

  await page.getByTestId('tagestitel').click();
  await page.getByTestId('tagesdetails').locator('ol > li button').nth(1).click();
  await page.waitForTimeout(1500);
  const geholt = await kamera();
  expect(
    Math.abs(geholt.lng - weggeschoben.lng) + Math.abs(geholt.lat - weggeschoben.lat),
    'Kamera blieb stehen, obwohl das Ziel ausserhalb lag',
  ).toBeGreaterThan(0.5);
});

test('der Streifen zeigt jede Tagesart als Symbol auf einer Achse', async ({ page }) => {
  await stilStubben(page);
  await page.goto('/?tag=2026-08-31');

  /*
    Jeder Tag trägt das Zeichen seiner Art. Fünf Arten, fünf Zeichen — die
    Leiste sagt damit ohne ein Wort, ob man unterwegs ist oder vor Ort bleibt.
  */
  for (const datum of ['2026-08-27', '2026-08-31', '2026-09-10']) {
    await expect(page.getByTestId(`tag-${datum}`).locator('svg')).toHaveCount(1);
  }

  // Trefferflächen bleiben touch-tauglich.
  const box = (await page.getByTestId('tag-2026-08-31').boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);

  /*
    Der Weg in den Tagesablauf ist die ganze Zeile, nicht ein Knopf daneben:
    sie spannt über die volle Breite des Streifens.
  */
  const zeile = (await page.getByTestId('tagestitel').boundingBox())!;
  const streifen = (await page.getByTestId('tagesstreifen').boundingBox())!;
  expect(zeile.width).toBeGreaterThan(streifen.width * 0.9);
  expect(zeile.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByTestId('tagestitel')).toContainText('Ablauf');
});

test('der Zeitstrahl läuft durch — auch am Abreisetag', async ({ page }) => {
  await stilStubben(page);
  await page.goto('/?tag=2026-08-31');
  await expect(page.getByTestId('tagesstreifen')).toBeVisible();

  /*
    Der Regressionstest zu einem echten Fehler: die Kopfzeile der letzten
    Gruppe trug kein Nächte-Abzeichen und war deshalb vier Pixel flacher als
    die übrigen sechs. Die Tagesreihe darunter rutschte mit, und der Strahl
    brach sichtbar vor der letzten Perle ab.

    Geprüft wird die Geometrie, nicht die Ursache: **eine** Achse über alle
    Gruppen, und jede Perle sitzt darauf. Egal, was künftig in der Kopfzeile
    steht.
  */
  const lagen = await page.evaluate(() => {
    const mitte = (el: Element) => {
      const r = el.getBoundingClientRect();
      return Math.round((r.top + r.height / 2) * 10) / 10;
    };
    return [...document.querySelectorAll('li[data-testid^="etappe-"]')].map((li) => ({
      id: (li as HTMLElement).dataset.testid,
      achse: mitte(li.querySelector('[data-testid^="achse-"]')!),
      perlen: [...li.querySelectorAll('[data-testid^="perle-"]')].map(mitte),
    }));
  });

  expect(lagen.length).toBe(7);
  const hoehen = new Set(lagen.flatMap((l) => [l.achse, ...l.perlen]));
  expect(
    [...hoehen],
    `Achse und Perlen liegen nicht auf einer Höhe: ${JSON.stringify(lagen)}`,
  ).toHaveLength(1);
});

test('Farbe trägt nur der gewählte Tag', async ({ page }) => {
  await stilStubben(page);
  await page.goto('/?tag=2026-08-31');
  // Erst wenn der Deep Link gegriffen hat, ist überhaupt der richtige Tag
  // gewählt — sonst misst der Test die Farbe des Vorgabetags.
  await expect(page.getByTestId('tag-2026-08-31')).toHaveAttribute('aria-selected', 'true');

  /*
    Fünfzehn eingefärbte Perlen waren dieselbe Konfetti-Falle wie fünfzehn
    bunte Linien auf der Karte. Der gewählte Tag trägt die Farbe seiner
    Tagesart, alle anderen Perlen bleiben weiss.
  */
  const bunte = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-testid^="perle-"]')]
        .filter((el) => getComputedStyle(el).backgroundColor !== 'rgb(255, 255, 255)')
        .map(
          (el) => `${(el as HTMLElement).dataset.testid} ${getComputedStyle(el).backgroundColor}`,
        ),
    );

  /*
    Nachgefasst statt einmal gemessen: die zuvor gewählte Perle blendet ihre
    Farbe über 150 ms aus. Ein einzelner Messpunkt fällt sonst mitten in den
    Übergang und sieht zwei farbige Perlen.

    Der Standtag ist Grün — die Farbe verschwindet nicht aus der App, sie wird
    nur sparsam. Es ist dieselbe, die auf der Karte die Route dieses Tages
    trägt.
  */
  await expect
    .poll(bunte, { message: 'mehr als der gewählte Tag trägt Farbe' })
    .toEqual(['perle-2026-08-31 rgb(5, 150, 105)']);
});

test('die Vorschau steht über dem Zeitstrahl und nennt die Nächte im Klartext', async ({
  page,
}) => {
  await stilStubben(page);
  await page.goto('/?tag=2026-08-31');
  await expect(page.getByTestId('tag-2026-08-31')).toHaveAttribute('aria-selected', 'true');

  // Die Vorschau des Tages liegt über der Achse, nicht darunter.
  const vorschau = (await page.getByTestId('tagestitel').boundingBox())!;
  const strahl = (await page.getByTestId('tag-2026-08-31').boundingBox())!;
  expect(vorschau.y + vorschau.height).toBeLessThanOrEqual(strahl.y);

  /*
    Die Nächtezahl stand als blanke Ziffer in einem roten Abzeichen und sagte
    nicht, was sie zählt. Jetzt steht das Wort dabei — mit Singular.
  */
  await expect(page.getByTestId('etappe-thrasastadir')).toContainText('4 Nächte');
  await expect(page.getByTestId('etappe-konvin')).toContainText('1 Nacht');
});
