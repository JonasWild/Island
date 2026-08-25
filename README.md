# Island 2026 — Rund um die Insel

Karte zum Reiseplan von Katla Travel (Vorgang 15412, 27.08.–10.09.2026,
5 Personen, Mietwagen, Ferienhäuser). 15 Tage, 6 Unterkünfte, 128 Stopps.

Die Karte ist die App. Daneben gibt es genau zwei Dinge: einen Tagesstreifen
unten und ein Kontextblatt rechts, wenn man etwas anklickt.

## Loslegen

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

| Befehl | Wirkung |
|---|---|
| `pnpm dev` | Entwicklungsserver |
| `pnpm build` | validiert `reise.json` und baut |
| `pnpm geocode` | Geocoding-Pipeline (Build-Zeit, nicht Laufzeit) |
| `pnpm wissen` | Wikipedia-Hintergrundtexte (Build-Zeit, nicht Laufzeit) |
| `pnpm test` | Vitest |
| `pnpm e2e` | Playwright-Smoke |
| `pnpm typecheck` / `pnpm lint` | statische Prüfung |

Container und CI-Images mit vorinstalliertem Chromium brauchen für die
E2E-Tests den Pfad:
`PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm e2e`.

## Bedienung

| Eingabe | Wirkung |
|---|---|
| Klick auf einen Tag | Kameraflug auf die Etappe |
| `Relief` | Schummerung an/aus — lädt das DEM erst dann |
| `←` / `→` | Tag zurück / vor |
| Klick auf einen Stopp | Kontextblatt rechts |
| Klick auf leere Karte | Koordinate im Kontextblatt |
| `Esc` | schließt das Kontextblatt |

Deep Links: `/?tag=2026-09-05&stopp=8` — teilbar und reload-fest.

## Karte

MapLibre GL JS v5 direkt, ohne `react-map-gl` — die Kamera bleibt imperativ.
Basiskarte OpenFreeMap (kein Key), hell als Standard, dunkel per Schalter über
einen echten Style-Wechsel statt eines CSS-Filters.

**Kein Terrain.** `setTerrain` ist raus. Das 3D-Gelände war der teure Teil —
Mesh-Aufbau, Depth-Buffer und je Bild eine Höhenabfrage pro Marker — und sah
dabei nicht gut aus. Mit ihm fielen `setSky`, `maxPitch` und der Kamera-Pitch:
die Karte ist 2D, Norden bleibt oben. Die Drehung in Fahrtrichtung ging
gleich mit; sie trug nur, solange es ein Relief zu betrachten gab, und kostet
auf einer flachen Karte bloß Orientierung.

**Relief als Schalter.** Ein `hillshade`-Layer auf denselben
[AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)
(Terrarium-Kodierung) liest die Höhendaten, baut daraus aber keine Geometrie.
Quelle und Layer entstehen erst beim Einschalten und verschwinden beim
Ausschalten — im Normalmodus geht **keine einzige Anfrage** an den DEM-Host.
Die Farben sind weich gehalten: eine Schummerung soll das Gelände andeuten,
nicht die Basiskarte überschreiben.

Die beiden Alternativen wurden geprüft und verworfen:

- **Esri World Hillshade** liefert zwar Kacheln (HTTP 200, echte JPEGs), über
  Island aber ein nahezu weißes Bild. Es ist ein Multiply-Overlay für ArcGIS;
  MapLibre-Raster-Layer kennen keinen Multiply-Blendmodus, das Ergebnis wäre
  ein weißer Schleier statt Relief.
- **OpenTopoMap** ist keine Schummerung, sondern eine vollständige Basiskarte
  mit eigenen Farben, Gewässern und Beschriftungen. Sie würde OpenFreeMap
  ersetzen statt ergänzen, kollidiert mit dem Hell/Dunkel-Wechsel und ist
  ausdrücklich nicht für beliebige Last gedacht.

Nicht `demotiles.maplibre.org`: dessen Kachelsatz deckt nur einen Ausschnitt
der Alpen ab und liefert über Island nichts.

**Die Route ist durchgehend.** Ein Segment je Tag, aber jedes beginnt beim
letzten Stopp des Vortags, sodass keine Lücke entsteht. Alle Tage sind immer
sichtbar; der gewählte Tag ist nur breiter und kräftiger. Die Farbe steht für
die Art des Tages (Anreise, Standtag, Tagesausflug, Etappe, Abreise). Es ist
eine Schematik, keine Navigationsroute — echtes Routing wäre v2.

**Symbole statt Punkte.** Jeder Stopp bekommt ein Piktogramm für seine Art:
Wasserfall, heiße Quelle, Vulkan, Gletscher, Schlucht, Höhle, Strand, Berg,
See, Tiere, Museum, Historie, Wanderung, Ort, unterwegs, Unterkunft. Die
Symbole werden zur Laufzeit auf ein Canvas gezeichnet — kein Sprite, kein
weiterer Netzaufruf — und sitzen auf einer schattierten Platte, damit sie über
der Karte als Objekte lesbar sind.

Echte 3D-Modelle (glTF) kann MapLibre nicht von sich aus: das wäre ein
three.js- oder deck.gl-Custom-Layer, also ein zweiter Renderer im Bundle. Für
den Zweck — erkennen, was für ein Ziel das ist — tragen die Piktogramme das
genauso, zu einem Bruchteil der Komplexität.

Die Art wird in `src/lib/kategorie.ts` **allein aus dem Namen** abgeleitet,
nicht aus dem Beschreibungstext. Isländische Namen tragen ihre Art im Wort
(`-foss`, `-jökull`, `hver`, `-gljúfur`, `-vatn`), während der Text in die
Irre führt: Stykkishólmur hat ein Vulkanmuseum, Akranes einen Hot Pot,
Egilsstaðir ein Schwimmbad. Für die Handvoll bekannter Ziele, deren Name
nichts verrät (Dimmuborgir, Herðubreið, Ásbyrgi …), steht eine kurze Liste
davor. Ohne Treffer bleibt es ein Ort — nichts wird geraten.

## Daten

`data/reise.json` ist die einzige Quelle. Jede Position trägt ihren Nachweis:

```ts
pos:     [lat, lon]
posMeta: { quelle: 'osm'|'wikidata'|'anbieter'|'reiseplan'|'manuell',
           genauigkeit: 'punkt'|'bereich',
           geprueftAm: '2026-08-13', ref?: string, hinweis?: string }
```

`pnpm geocode` löst gegen Nominatim (primär) und Overpass (Rückfall) auf,
`countrycodes=is`, und übernimmt nur Eindeutiges:

- Treffer weiter als 25 km von der Planposition zählen nicht.
- Eine kuratierte Position wird höchstens 8 km verschoben — alles darüber ist
  ein anderer Ort, nicht eine Verfeinerung (Rjúkandi, Reykholt und Laugarvatn
  gibt es in Island mehrfach).
- Bei mehreren gleichnamigen Orten nur, wenn genau einer die Planposition auf
  3 km bestätigt.
- Alles andere landet mit seinen Kandidaten in `data/offen.json`.

`data/kuratiert.json` gewinnt immer und enthält die von Hand belegten Fälle mit
Quelle und Begründung. Der Cache wird mitcommittet: reproduzierbare Builds,
keine Rate-Limit-Überraschungen.

## Hintergrundtexte

`pnpm wissen` holt zu jedem Stopp den Einleitungsabsatz des passenden Artikels
aus der deutschen Wikipedia (`prop=extracts&exintro=1&explaintext=1`) und legt
ihn als `wissen: { text, quelle, url, geprueftAm }` in `reise.json` ab. Das
Kontextblatt zeigt ihn mit Quelle, Link und Prüfdatum.

Der Artikel wird über die Geosuche im Umkreis von 10 km gefunden — mehr lässt
die API nicht zu, und weiter weg beschreibt ein Artikel ohnehin ein anderes
Objekt. Übernommen wird er nur, wenn er eindeutig ist:

- Sein Name stimmt (normalisiert, ohne Diakritika) mit dem Stopp überein und er
  ist der einzige Artikel dieses Namens im Umkreis, **oder**
- er ist der einzige Artikel unter 400 m — und der Stopp ist punktgenau
  verortet. Bei `genauigkeit: 'bereich'` ist die Position selbst auf 400 m nicht
  belastbar, dort zählt allein die Namensregel.

Begriffsklärungsseiten und Artikel ohne Einleitungstext fallen raus.

Stand: **69 von 128 Stopps mit Hintergrundtext.** Die übrigen 59 stehen mit
Begründung und Kandidatenliste in `data/wissen-offen.json` — darunter Einträge,
zu denen es korrekterweise keinen Artikel gibt („Volltanken", „Check-in",
„Lighthouse Route") und Landschaftsräume ohne Punktposition. Lieber eine leere
Stelle als ein Text über das Nachbardorf.

Stand Positionen: **128 von 128 Stopps mit Beleg** — 89 punktgenau aus OSM, 39 als
Bereich, keiner ohne Position. 22 stehen zusätzlich in `offen.json` zur
manuellen Klärung. Korrekturen und die geklärten Streitfälle aus den PDFs:
[`DATENSTAND.md`](./DATENSTAND.md).

## Vercel

Framework-Preset Next.js, Region `fra1`, Production auf `main`, Preview pro
Branch. Die App braucht keine Umgebungsvariablen — es gibt kein Geheimnis
mehr zu verwalten. Die CSP in `next.config.ts` öffnet gezielt nur
`tiles.openfreemap.org` und `s3.amazonaws.com`; alles andere bleibt zu.

## Nicht enthalten

Zeichnen/Editieren, Kamera-Tour, echtes Routing, Offline-Betrieb, Wetter- und
Straßenzustandsfeeds, Fotos pro Stopp.
