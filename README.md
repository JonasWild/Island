# Island 2026 — Rund um die Insel

Karte zum Reiseplan von Katla Travel (Vorgang 15412, 27.08.–10.09.2026,
5 Personen, Mietwagen, Ferienhäuser). 15 Tage, 6 Unterkünfte, 128 Stopps.

Die Karte ist die App: 3D-Gelände mit Schummerung, die Route als Ganzes, jeder
Stopp als 3D-Modell seiner Art. Dazu ein Tagesstreifen unten und — auf Klick —
eine Infobox am Marker, aus der sich eine ausführliche Leiste öffnen lässt.

## Loslegen

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Ohne `OPENAI_API_KEY` läuft die App vollständig, antwortet aber mit festen
Beispieltexten — und sagt das im Kontextblatt und in der Server-Konsole
deutlich. Für echte Antworten den Schlüssel in `.env.local` setzen
(siehe `.env.example`). Einen Modus-Schalter gibt es nicht.

| Befehl | Wirkung |
|---|---|
| `pnpm dev` | Entwicklungsserver |
| `pnpm build` | validiert `reise.json` und baut |
| `pnpm geocode` | Geocoding-Pipeline (Build-Zeit, nicht Laufzeit) |
| `pnpm bilder` | ordnet Fotos aus Wikipedia zu (Build-Zeit) |
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
| `←` / `→` | Tag zurück / vor |
| Klick auf einen Marker | Infobox direkt am Marker |
| „Details" in der Infobox | Detailleiste rechts, mit Foto und Modellantwort |
| Klick auf leere Karte | „Was ist hier?" — Infobox mit Koordinate, von dort die Frage ans Modell |
| `Esc` | schließt erst die Detailleiste, dann die Infobox |

Deep Links: `/?tag=2026-09-05&stopp=8` — teilbar und reload-fest.

## Karte

MapLibre GL JS v5 direkt, ohne `react-map-gl` — die Kamera bleibt imperativ.
Basiskarte OpenFreeMap (kein Key), hell als Standard, dunkel per Schalter über
einen echten Style-Wechsel statt eines CSS-Filters.

**Terrain** über `raster-dem` + `setTerrain` mit den
[AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) in
Terrarium-Kodierung. Nicht `demotiles.maplibre.org`: dessen Terrain-Kachelsatz
enthält nur einen Ausschnitt der Alpen und liefert über Island nichts.

Dazu ein **Hillshade-Layer** aus derselben Quelle, eingehängt unter den
Beschriftungen. Ohne ihn ist das Terrain praktisch unsichtbar: die
Geländeverformung fällt im Landesmaßstab nicht auf, die Schummerung dagegen
sofort.

**Die Route ist durchgehend.** Ein Segment je Tag, aber jedes beginnt beim
letzten Stopp des Vortags, sodass keine Lücke entsteht. Alle Tage sind immer
sichtbar; der gewählte Tag ist nur breiter und kräftiger. Die Farbe steht für
die Art des Tages (Anreise, Standtag, Tagesausflug, Etappe, Abreise). Es ist
eine Schematik, keine Navigationsroute — echtes Routing wäre v2.

**Marker sind 3D-Modelle**, kein Bildchen: ein MapLibre-Custom-Layer
(`renderingMode: '3d'`) mit three.js zeichnet je Zielart einen eigenen Körper —
Vulkankegel, Berg mit Schneekappe, Gletscher, Wasserfall über einer Kante,
Becken, Höhle, Wal, Museum mit Giebel, Kirche mit Turmkreuz, Haus, Fahrzeug.
Sie stehen auf der Geländehöhe, neigen sich mit der Kamera und werden vom
Terrain verdeckt.

Die Formen entstehen im Code statt als glTF-Dateien: bei sechzehn einfachen
Körpern ist das kleiner, schneller und braucht weder eine externe Datei noch
eine CSP-Ausnahme. Sichtbare Größe und Deckkraft hängen am gewählten Tag, die
Größe zusätzlich am Zoom, damit die Modelle auf dem Schirm gleich groß bleiben.

Weil `queryRenderedFeatures` einen Custom-Layer nicht kennt, liegt unter den
Modellen ein unsichtbarer Kreis-Layer als Klick- und Hover-Ziel.

Deshalb läuft die Karte in **Mercator statt als Globus**: Custom-Layer rechnen
in Mercator-Weltkoordinaten.

Die Zielart wird in `src/lib/kategorie.ts` **allein aus dem Namen** abgeleitet,
nicht aus dem Beschreibungstext. Isländische Namen tragen ihre Art im Wort
(`-foss`, `-jökull`, `hver`, `-gljúfur`, `-vatn`), während der Text in die
Irre führt: Stykkishólmur hat ein Vulkanmuseum, Akranes einen Hot Pot,
Egilsstaðir ein Schwimmbad. Für die Handvoll bekannter Ziele, deren Name
nichts verrät (Dimmuborgir, Herðubreið, Ásbyrgi …), steht eine kurze Liste
davor. Ohne Treffer bleibt es ein Ort — nichts wird geraten.

## Zwei Stufen Detail

Ein Klick auf einen Marker öffnet eine **Infobox direkt daneben**: Foto, Datum,
Zielart, ein bis zwei Fakten. Das reicht meistens. Wer mehr will, klickt
„Details" und bekommt die **Leiste am rechten Rand** mit großem Bild, vollem
Veranstaltertext und der Modellantwort. `Esc` arbeitet sich rückwärts durch
beide Stufen.

## Bilder

`pnpm bilder` ordnet jedem Stopp zur Build-Zeit ein Foto zu — Geosuche in der
deutschen Wikipedia (Rückfall: englische) im Umkreis der belegten Position,
Lizenzangaben aus Commons. Übernommen wird nur, was eindeutig passt:

- der Artikeltitel passt zum Stoppnamen, **oder**
- der Artikel liegt näher als 400 m und ist der einzige mit Bild.

Sonst bleibt der Stopp ohne Bild; ein falsches Foto wäre schlimmer als keins.
Stand: 82 von 128 Stopps und 4 von 6 Unterkünften haben eins. Urheber und
Lizenz stehen unter jedem Bild, der Cache liegt in `data/bilder-cache.json`.

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

Stand: **128 von 128 Stopps mit Beleg** — 89 punktgenau aus OSM, 39 als
Bereich, keiner ohne Position. 22 stehen zusätzlich in `offen.json` zur
manuellen Klärung. Korrekturen und die geklärten Streitfälle aus den PDFs:
[`DATENSTAND.md`](./DATENSTAND.md).

## LLM

Alles serverseitig in `app/api/ask/route.ts`, Node-Runtime, SSE-Stream. Der
Schlüssel kommt nie in den Client.

Der Kontext stammt ausschließlich aus `reise.json`: Reisetag, Etappe,
Unterkunft, Koordinate, Veranstaltertext, nächstgelegene Stopps. Das
Antwortformat ist eng geführt — höchstens sechs Punkte, Zahlen wenn vorhanden,
Unsicherheit benennen, für Vulkane und Straßen auf safetravel.is, vedur.is und
road.is verweisen.

Ist `OPENAI_API_KEY` gesetzt, läuft der echte Aufruf über `ChatOpenAI`. Fehlt
er, antwortet ein fester Beispieltext, die Server-Konsole schreibt eine
Warnung, und das Kontextblatt sagt es dem Leser direkt.

**Bekannte Einschränkung:** Streaming zusammen mit dem eingebauten
`web_search`-Tool der Responses-API ist in LangChain JS fehleranfällig
([langchainjs#8283](https://github.com/langchain-ai/langchainjs/issues/8283)).
Der Adapter geht deshalb zwei Wege — mit `LLM_WEB_SEARCH=1` (Standard) per
`invoke()` und serverseitigem Nachstreamen, mit `LLM_WEB_SEARCH=0` per echtem
Token-Streaming ohne Suche. Schlägt der Suchpfad fehl, wiederholt er ohne
Suche. Der Client sieht in beiden Fällen dieselben SSE-Ereignisse. Verifiziert
ist der Suchpfad nicht — dafür fehlt ein Schlüssel.

Rate Limit: 10 Anfragen pro IP und Minute, im Prozessspeicher. Auf Vercel gilt
das je Instanz, nicht global; als Kostenbremse reicht das.

## Vercel

Framework-Preset Next.js, Region `fra1`, Production auf `main`, Preview pro
Branch. Env: `OPENAI_API_KEY`, `OPENAI_MODEL`, optional `LLM_WEB_SEARCH`.
Die CSP in `next.config.ts` öffnet gezielt nur `tiles.openfreemap.org`,
`s3.amazonaws.com` (DEM) und `upload.wikimedia.org` (Bilder); alles andere
bleibt zu.

## Farben

Die Farbe eines Routenabschnitts ist nicht zufällig, sondern steht für die Art
des Tages: Anreise, Standtag, Tagesausflug, Etappe, Abreise. Dasselbe Wort
steht in der Zusammenfassung unter dem Tagesstreifen neben dem farbigen Punkt,
damit die Farbe selbsterklärend ist.

Die Farbe der 3D-Modelle steht dagegen für die Zielart — Vulkane rot,
Gletscher weiß, Bäder türkis, Wanderungen grün.

## Nicht enthalten

Zeichnen/Editieren, Kamera-Tour, echtes Routing, Offline-Betrieb, Wetter- und
Straßenzustandsfeeds.
