# Island 2026 — Rund um die Insel

Karte zum Reiseplan von Katla Travel (Vorgang 15412, 27.08.–10.09.2026,
5 Personen, Mietwagen, Ferienhäuser). 15 Tage, 6 Unterkünfte, 128 Stopps.

Die Karte ist die App. Daneben gibt es genau drei Dinge: einen Zeitstrahl
unten, eine Vorschau-Blase am angeklickten Ziel und ein Kontextblatt, wenn man
mehr wissen will.

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
| `pnpm test` | Vitest |
| `pnpm e2e` | Playwright in zwei Breiten (Pixel 7 und Desktop) |
| `pnpm typecheck` / `pnpm lint` | statische Prüfung |

Container und CI-Images mit vorinstalliertem Chromium brauchen für die
E2E-Tests den Pfad:
`PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm e2e`.

Die E2E-Tests laufen gegen einen netzfreien Stubstil (`e2e/stub.ts`): Basiskarte
und DEM werden im Browser abgefangen und lokal beantwortet — der Stil ist
gültig, aber leer, das DEM eine flache Kachel auf Meereshöhe. Geprüft wird der
eigene Code, nicht die Erreichbarkeit fremder Server.

Zum Ansehen des Ergebnisses:

```bash
pnpm build && npx next start -p 3210 &
VP=mobil URL="http://127.0.0.1:3210/?tag=2026-08-28" OUT=/tmp/m.png \
  PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium \
  NODE_USE_ENV_PROXY=1 node scripts/screenshot.mjs
```

`scripts/screenshot.mjs` holt die Kartenanfragen über Node und reicht sie an den
Browser durch — in abgeschotteten Umgebungen kommt nur Node an die Kachel-Hosts
heran. Ohne das sieht man eine leere Karte und hält funktionierenden Code für
kaputt.

## Bedienung

| Eingabe | Wirkung |
|---|---|
| Klick auf einen Tag | Kameraflug auf die Etappe |
| `←` / `→` | Tag zurück / vor |
| Klick auf ein Symbol | Vorschau-Blase am Ziel: kurzer Text, Weg ins Kontextblatt |
| „Mehr dazu" in der Blase | Kontextblatt — auf dem Handy unten, ab `sm:` rechts |
| Klick auf die Zusammenfassungszeile | Tagesablauf als Vollbild |
| Klick auf leere Karte | schließt erst die Auswahl; ohne Auswahl „Was ist hier?" ans Modell |
| `Esc` | eine Stufe zurück: Tagesablauf → Kontextblatt → Blase → nichts |

Deep Links: `/?tag=2026-09-05&stopp=8` — teilbar und reload-fest. Sie öffnen
direkt das Kontextblatt, nicht die Blase: wer einem geteilten Link folgt, hat
den Kontext nicht, den ein eigener Klick aufbaut.

### Zeitstrahl statt Tagesreihe

Die Leiste unten ist eine durchlaufende Achse, auf der die Tage als Knoten
sitzen, gegliedert in die sieben Standzeiten (sechs Quartiere plus
Abreisetag, `src/lib/etappe.ts`). Ein Tag gehört zu der Unterkunft, in der man
an seinem **Abend** schläft — der Fahrtag nach Mývatn zählt also schon dorthin.

Jeder Knoten trägt die **Tagesart** als Symbol (fünf Werte: Anreise, Standtag,
Tagesausflug, Etappe, Abreise). Das sind eigene SVG-Pfade in
`TagTypSymbol.tsx`; die Canvas-Zeichner in `src/map/icons.ts` geben dafür
nichts her, denn sie zeichnen die **Zielart** (16 Werte) für MapLibre. Die
Farbe allein trug die Unterscheidung nicht: sie ist auf der Karte schon mit der
Route belegt.

Der Streifen beantwortet zwei Fragen — wo bin ich in der Reise, und was für ein
Tag ist das. Mehr steht bewusst nicht darin: Stopps in Fahrreihenfolge,
Gehzeiten, Hinweise und das Quartier des Abends stehen im **Tagesablauf**, den
die Zusammenfassungszeile öffnet. Sie ist selbst die Schaltfläche — kein
angeklebter Knopf daneben.

Der Streifen meldet seine Höhe als `--streifen-hoehe`; die
MapLibre-Bedienelemente, die Herkunftsangabe der Basiskarte, die Vorschau-Blase
und die Kameraentscheidung rechnen damit. Das Kontextblatt meldet ebenso
`--blatt-rechts` / `--blatt-unten`, damit die Herkunftsangabe ihm ausweicht:
verdeckt werden darf sie nie.

### Vorschau-Blase

Ein Klick auf ein Symbol deckte früher sofort ein Drittel der Karte zu, um zwei
Sätze zu zeigen. Jetzt öffnet er eine Blase am Ziel — eigenes DOM über
`map.project()`, kein `maplibregl.Popup`: der Popup dreht bei Bedarf seinen
Anker um, aber er klemmt nicht, und auf 390 px steht er neben einem Ziel am
Rand halb außerhalb. Die Blase wird stattdessen in den frei sichtbaren
Ausschnitt geklemmt (`src/map/sicht.ts`); zeigt ihr Zeiger nach dem Klemmen
nicht mehr auf das Symbol, entfällt er, statt ins Leere zu deuten.

Der Text kommt aus `stopp.text` und wird auf ganze Sätze gekürzt
(`src/lib/text.ts`) — nie mitten im Satz, Abkürzungen und Ordnungszahlen
beenden dabei keinen Satz. Ein Bild zeigt die Blase **ohne** Urheber- und
Lizenzzeile; die vollständige Nennung steht im Kontextblatt, einen Tipp
entfernt.

### Kamera

Die Kamera fliegt nur, wenn das Ziel es nötig hat: liegt es im **frei
sichtbaren** Ausschnitt und ist der Zoom über 8, bleibt sie stehen. „Frei
sichtbar" ist dabei nicht `getBounds().contains()` — abgezogen werden
Zeitstrahl, Kontextblatt, Herkunftsangabe und Bedienelemente, gemessen am
echten DOM statt am nachgebauten Layout. Wird geflogen, dann so ruhig wie
möglich: der aktuelle Zoom bleibt (nur nach unten begrenzt), Neigung und
Drehung bleiben, verschoben wird die Mitte — und zwar in die Mitte des freien
Bereichs, nicht des Fensters.

Der Tageswechsel fliegt weiter (`fliegeZuTag`), Deep Links fliegen ebenfalls:
während des Tagesflugs ist „sichtbar" ein wandernder Begriff, deshalb gilt eine
bewegte Kamera als „nicht sichtbar".

## Karte

MapLibre GL JS v5 direkt, ohne `react-map-gl` — die Kamera bleibt imperativ.
Basiskarte OpenFreeMap (kein Key), hell als Standard, dunkel per Schalter über
einen echten Style-Wechsel statt eines CSS-Filters.

**Terrain** über `raster-dem` + `setTerrain` mit den
[AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) in
Terrarium-Kodierung. Nicht `demotiles.maplibre.org`: dessen Terrain-Kachelsatz
enthält nur einen Ausschnitt der Alpen und liefert über Island nichts — dort
blieb die Karte flach.

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
dem Relief als Objekte lesbar sind.

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

**Bilder sind optional und belegt.** `BildSchema` (`src/lib/schema.ts`) hängt an
Stopp und Unterkunft: `url`, optional Maße, dazu `urheber` und `lizenz` als
Pflicht — ein Bild ohne Nennung soll gar nicht erst in die Daten kommen.
`reise.json` führt derzeit **kein** Bild; die UI läuft deshalb im bildlosen
Fall, und genau der ist getestet. Kommen Bilder dazu, muss ihr Host in die CSP
(`img-src` in `next.config.ts`) aufgenommen werden.

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
Die CSP in `next.config.ts` öffnet gezielt nur `tiles.openfreemap.org` und
`s3.amazonaws.com`; alles andere bleibt zu.

## Nicht enthalten

Zeichnen/Editieren, Kamera-Tour, echtes Routing, Offline-Betrieb, Wetter- und
Straßenzustandsfeeds. Fotos pro Stopp: das Schema steht, belegte Bilder gibt es
noch keine.
