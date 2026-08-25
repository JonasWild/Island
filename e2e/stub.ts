import type { Page } from '@playwright/test';

/**
 * Minimaler Kartenstil ohne Netzabhängigkeit. Die E2E-Tests ersetzen den
 * Basisstil bewusst dadurch: geprüft wird der eigene Code, nicht die
 * Erreichbarkeit fremder Server. Ohne das feuert `style.load` in einer
 * Umgebung ohne Netz nie — und dann werden die eigenen Layer nie angelegt,
 * was jede Layer-Prüfung wertlos macht.
 *
 * Der Stil enthält einen Symbol-Layer, damit `reliefSetzen` seine Einfügemarke
 * unter den Beschriftungen findet — wie im echten Stil auch.
 */
export const STUB_STYLE = {
  version: 8,
  name: 'stub',
  sources: {
    // Mit Herkunftsangabe, damit das Attribution-Bedienelement auch im Stub
    // eine Ausdehnung hat — sonst lässt sich nicht prüfen, dass die eigenen
    // Schalter es nicht verdecken. Sie ist so lang wie die echte, weil genau
    // die Länge den Fall erzeugt: auf 390 px bricht sie um.
    leer: {
      type: 'geojson',
      attribution: 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
      data: { type: 'FeatureCollection', features: [] },
    },
  },
  layers: [
    { id: 'hintergrund', type: 'background', paint: { 'background-color': '#eef2f6' } },
    { id: 'stub-beschriftung', type: 'symbol', source: 'leer' },
  ],
} as const;

/** Basiskarte und DEM abfangen: hell wie dunkel liefern denselben Stubstil. */
export async function stilStubben(page: Page): Promise<void> {
  await page.route(/tiles\.openfreemap\.org\/styles\/.*/, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(STUB_STYLE) }),
  );
  // Ein 1x1-PNG genügt: geprüft wird, dass der Layer existiert und Kacheln
  // anfordert, nicht wie die Schummerung aussieht.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  await page.route(/elevation-tiles-prod/, (route) =>
    route.fulfill({ contentType: 'image/png', body: png }),
  );
}
