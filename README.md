# Island 2026 — Rund um die Insel

Karten-App zum Reiseplan von Katla Travel (Vorgang 15412, 27.08.–10.09.2026,
5 Personen, Mietwagen, Ferienhäuser).

**Die Karte ist die App.** Keine Sidebar-Listen, keine Tabs, keine
Dokumentansicht. Was nicht an der Karte hängt, ist nicht v1.
Die vollständige Begründung steht in [`REQUIREMENTS.md`](./REQUIREMENTS.md).

## Loslegen

```bash
pnpm install
pnpm dev            # http://localhost:3000 — LLM läuft gegen Fixtures
```

Ohne `.env` läuft alles im Mock-Modus: kein Schlüssel, kein Netzaufruf ans
Modell, deterministische Antworten. Für den echten Aufruf `.env.example` nach
`.env.local` kopieren und `LLM_MODE=live` setzen.

| Befehl | Wirkung |
|---|---|
| `pnpm dev` | Entwicklungsserver |
| `pnpm build` | validiert `reise.json` und baut |
| `pnpm validate` | prüft `reise.json` gegen das Zod-Schema |
| `pnpm geocode` | Geocoding-Pipeline (Build-Zeit, nicht Laufzeit) |
| `pnpm test` | Vitest |
| `pnpm e2e` | Playwright-Smoke |
| `pnpm typecheck` | `tsc --noEmit` |

In Umgebungen mit vorinstalliertem Chromium (Container, CI-Images) braucht
`pnpm e2e` den Pfad: `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm e2e`.

## Bedienung

| Eingabe | Wirkung |
|---|---|
| Klick auf einen Tag der Zeitachse | Kameraflug auf die Etappe |
| `Tour` / Leertaste | Kamera fährt die Stopps des Tages ab |
| `←` / `→` | Tag zurück / vor |
| Klick auf einen Stopp | Kontextblatt am rechten Rand |
| Klick auf leere Karte | „Was ist hier?" ans Modell, mit Koordinate, Tag und nächstem Stopp |
| `Zeichnen` → Fläche | Die Fläche ist die Frage: „Was liegt in diesem Gebiet?" |
| `Esc` | schließt das Kontextblatt |

Deep Links: `/?tag=2026-09-05&stopp=8` — teilbar und reload-fest.

## Aufbau

```
data/reise.json          Single Source of Truth (15 Tage, 6 Unterkünfte, 128 Stopps)
data/kuratiert.json      handgeprüfte Positionen mit Beleg — gewinnt gegen die Automatik
data/offen.json          was die Pipeline nicht eindeutig auflösen konnte
data/geocode-cache.json  committet: reproduzierbare Builds, keine Rate-Limit-Überraschungen
scripts/geocode.ts       Nominatim + Overpass, nur eindeutige Treffer
scripts/validate.ts      Zod-Prüfung, läuft vor jedem Build
src/map/                 Style, Terrain, Layer, Kamera, Icons — reines MapLibre
src/components/          Karte, Zeitachse, Kontextblatt, Zeichnen, HUD
src/lib/llm/             Adapter (Mock ⇄ OpenAI), Prompt, Typen
src/app/api/ask/         SSE-Route, Node-Runtime
```

### Kartentechnik

MapLibre GL JS v5 direkt, ohne `react-map-gl` — die Kamera bleibt imperativ.
3D-Terrain über `raster-dem` + `setTerrain`, Sky-Layer, Globus-Projektion.
Basiskarte OpenFreeMap, DEM von `demotiles.maplibre.org` (frei, kein Token).
Zeichnen über Terra Draw (`@watergis/maplibre-gl-terradraw`) mit Undo/Redo und
`localStorage`-Persistenz.

Stopps liegen in einem Symbol-Layer, nicht als DOM-Marker: bei 128 Punkten über
15 Tage ist das der Unterschied zwischen flüssig und ruckelig. Die Icons werden
zur Laufzeit auf ein Canvas gezeichnet — kein Sprite, kein weiterer Netzaufruf.

Hell/dunkel ist ein echter Style-Wechsel, kein CSS-Filter. Nach jedem Wechsel
werden Terrain, Icons, Quellen und Layer neu aufgebaut.

**Etappenlinien sind Schematik, keine Route.** Sie verbinden die Stopps eines
Tages in Reihenfolge, gestrichelt und am Weg als „schematisch — keine Route"
beschriftet. Echtes Routing (OSRM/Valhalla) ist v2.

MapLibre 6 ist inzwischen erschienen; die App bleibt bewusst auf 5, weil die
Requirements darauf entschieden wurden und Terra Draw beide unterstützt.

### Daten und Herkunft

Jede Position trägt ihren Nachweis:

```ts
pos:     [lat, lon]
posMeta: { quelle: 'osm'|'wikidata'|'anbieter'|'reiseplan'|'manuell',
           genauigkeit: 'punkt'|'bereich',
           geprueftAm: '2026-08-13',
           ref?: string, hinweis?: string }
```

Ohne `posMeta` gilt eine Position als unbelegt, und die UI zeigt das an — sie
erfindet keine Genauigkeit. Bereichsangaben werden als offener, gestrichelter
Ring gezeichnet, punktgenaue als gefüllter Kreis.

`pnpm geocode` löst Stopps gegen Nominatim (primär) und Overpass (Rückfall)
auf, `countrycodes=is`. Übernommen wird nur, was eindeutig ist:

- Treffer weiter als 25 km von der Planposition zählen nicht.
- Eine kuratierte Position wird höchstens 8 km verschoben. Alles darüber ist
  keine Verfeinerung mehr, sondern ein anderer Ort — in Island heißen
  Wasserfälle und Höfe oft mehrfach gleich (Rjúkandi, Reykholt, Laugarvatn).
- Liegen mehrere getrennte Orte gleichen Namens in Reichweite, wird nur
  übernommen, wenn genau einer davon die kuratierte Planposition auf 3 km
  bestätigt — das ist Prüfung, nicht Raten.
- Alles andere landet mit seinen Kandidaten in `data/offen.json`.

`data/kuratiert.json` gewinnt immer. Dort stehen die von Hand belegten Fälle
mit Quelle und Begründung — vor allem die Ferienhäuser (viatis.is nennt keine
Adresse, also `genauigkeit: 'bereich'`) und die Landschaftsräume, bei denen ein
Punkt ohnehin nur ein Schwerpunkt ist.

Stand: **128 von 128 Stopps mit Beleg** — 89 punktgenau aus OSM, 39 als
Bereich, keiner mehr ohne Position. 22 Stopps stehen zusätzlich in
`offen.json`, weil OSM ihre Planposition nicht eindeutig bestätigt; sie
behalten die Koordinate aus dem Reiseplan, aber mit `quelle: 'reiseplan'`.

Datenstand, Korrekturen und die geklärten Streitfälle aus den PDFs:
[`DATENSTAND.md`](./DATENSTAND.md).

### LLM

Alles serverseitig in `app/api/ask/route.ts`, Node-Runtime, SSE-Stream. Der
Schlüssel liegt in der Vercel-Env und kommt nie in den Client.

Der Kontext kommt ausschließlich aus `reise.json`: Reisetag, Etappe,
Unterkunft, Koordinate, Veranstaltertext, nächstgelegene Stopps. Das Antwort­format
ist eng geführt — höchstens sechs Punkte, Zahlen wenn vorhanden, Unsicherheit
benennen, für Vulkane und Straßen auf safetravel.is / vedur.is / road.is
verweisen. Jede Antwort ist in der UI als LLM-Ausgabe markiert.

**`LLM_MODE=mock` ist der Standard.** Die ganze UI wurde gegen deterministische
Fixtures gebaut und getestet; der echte Aufruf ist ein Adapter-Tausch, kein
UI-Umbau.

**Bekannte Einschränkung:** Streaming zusammen mit dem eingebauten
`web_search`-Tool der Responses-API ist in LangChain JS fehleranfällig
([langchainjs#8283](https://github.com/langchain-ai/langchainjs/issues/8283)).
Der Adapter geht deshalb zwei Wege:

| `LLM_WEB_SEARCH` | Weg |
|---|---|
| `1` (Standard) | `invoke()` ohne Stream, Antwort wird serverseitig nachgestreamt |
| `0` | echtes Token-Streaming über `.stream()`, ohne Live-Suche |

Schlägt der Suchpfad fehl, wiederholt der Adapter ohne Suche. Der Client sieht
in beiden Fällen dieselben SSE-Ereignisse. Ein Tavily-Tool als dritter Weg ist
vorgesehen (`TAVILY_API_KEY`), aber nicht gebaut — erst der Spike, dann der Code.

Rate Limit: 10 Anfragen pro IP und Minute, im Prozessspeicher. Auf Vercel gilt
das je Instanz, nicht global; als Kostenbremse für eine Familien-App reicht das.
Jede Anfrage wird mit Modus, Modell, Art, Zeichenzahl und Dauer geloggt.

## Vercel

Framework-Preset Next.js, Region `fra1`, Production auf `main`, Preview pro
Branch. Env: `OPENAI_API_KEY`, `OPENAI_MODEL`, `LLM_MODE`, optional
`TAVILY_API_KEY`.

Die CSP in `next.config.ts` ist restriktiv und öffnet gezielt nur die Hosts für
Tiles, Glyphs und DEM (`connect-src`, `img-src`, `worker-src blob:`).

## Stand der Meilensteine

| # | Inhalt | Stand |
|---|---|---|
| 0 | Next.js + Zod-Schema + Validierung im Build | fertig |
| 1 | MapLibre + Terrain + Stopps + Zeitachse | fertig |
| 2 | Kamera-Tour, Kontextblatt, Deep Links | fertig |
| 3 | Geocoding-Pipeline, Näherungen ersetzt | fertig |
| 4 | LLM gemockt, SSE-Stream, Kartenklick-Frage | fertig |
| 5 | LangChain echt + `web_search` | Adapter gebaut, Spike offen |
| 6 | Terra Draw + Flächen-Frage | fertig |

v2, nicht jetzt: echtes Routing, Offline/Service Worker, Wetter- und
Straßenzustandsfeeds (vedur.is, road.is), Fotos pro Stopp, deck.gl-Arcs.
