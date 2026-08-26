# Island 2026 — Requirements

Interaktive 3D-Karten-App für den Reiseplan „Rund um die Insel" (Katla Travel,
Vorgang 15412, 27.08.–10.09.2026, 5 Personen).
Quelle: `data/reise.json` — 15 Tage, 6 Unterkünfte, 128 Stopps, ~2.450 km.

---

## 1. Leitsatz

Die Karte **ist** die App. Kein Sidebar-Listen-Layout, keine Tabs, keine
Dokumentansicht. Alles Weitere ist minimal: Zeitstrahl, Kartenlabels, eine
Vorschau-Blase am Ziel, ein Kontextblatt. Wenn eine Information nicht auf oder
an der Karte hängt, gehört sie nicht in v1.

Mobile first heißt hier wörtlich: 390 px ist die Bezugsgröße, nicht der
Sonderfall. Was dort nicht lesbar ist oder die Karte zudeckt, ist nicht fertig.

## 2. Kartentechnik — Entscheidung

**MapLibre GL JS v5** + **3D-Terrain**. Ersetzt Leaflet vollständig.

Begründung: WebGL-Vektorkarte, echtes DEM-Terrain (`raster-dem` + `setTerrain`),
Globus-Projektion, Pitch/Bearing/Kamera-Animation, Sky-Layer — kostenlos, kein
Token, kein Anbieter-Lock-in. Island ist Relief: Gletscher, Schluchten,
Vulkane. In 2D geht genau das verloren.

Zeichnen: **Terra Draw** über `@watergis/maplibre-gl-terradraw` (Toolbar-Control,
Undo/Redo, Snapping). Ersetzt leaflet-geoman.

Verworfene Alternativen:

| Option | Warum nicht |
|---|---|
| **CesiumJS / Resium** | Echter 3D-Globus, aber Ion-Token, schweres Bundle, eigene Styling-Welt. Overkill für 128 Punkte. |
| **Mapbox GL JS v3** | Technisch top (Standard-Style, 3D-Gebäude), aber Token + Preis pro Load. |
| **Google Photorealistic 3D Tiles** | Schönste Bilder, teuer, braucht Cesium als Renderer. |
| **deck.gl** | Kein Kartenrenderer, sondern Layer darüber. Optional in v2 für Etappen-Arcs. |
| **Leaflet + Geoman** | Solide, aber 2D. Erledigt.

DEM-Quelle: `https://demotiles.maplibre.org/terrain-tiles/tiles.json` (Start) →
Mapterhorn oder MapTiler-Terrain, wenn Auflösung/Kontingent nicht reicht.
Basiskarte: MapLibre-Demo-Style oder OpenFreeMap (kostenlos, kein Key).

## 3. Stack

- **Next.js** (aktuelles Stable, App Router) + **React** + **TypeScript strict**
- **MapLibre GL JS v5** direkt (kein react-map-gl — Kamerasteuerung bleibt imperativ)
- **@watergis/maplibre-gl-terradraw** (Terra Draw)
- **Tailwind CSS v4** — nur Tokens + Utilities, keine Komponenten-Bibliothek
- **Zustand** für Kartenzustand (Tag, Stopp, Kameramodus, Zeichnung)
- **@langchain/openai** + **@langchain/core** — ausschließlich serverseitig
- **Zod** — Schema für `reise.json`, validiert beim Build
- **Vitest** + **Playwright** (Smoke in zwei Breiten — Pixel 7 und Desktop —
  gegen einen netzfreien Stubstil: geprüft wird der eigene Code, nicht die
  Erreichbarkeit fremder Server)
- **pnpm**, ESLint, Prettier
- Deployment **Vercel**

## 4. Datenmodell + Geocoding

`data/reise.json` bleibt Single Source of Truth. Erweiterung pro Stopp:

```ts
pos:      [lat, lon]
posMeta:  { quelle: 'osm'|'wikidata'|'manuell', genauigkeit: 'punkt'|'bereich', geprueftAm: string, ref?: string }
bild?:    { url, breite?, hoehe?, urheber, lizenz, lizenzUrl?, seite? }
```

`bild` ist optional; `urheber` und `lizenz` sind darin Pflicht — ein Bild ohne
Nennung soll gar nicht erst in die Daten kommen. Gezeigt wird die Nennung im
Kontextblatt, nicht in der Vorschau-Blase. `reise.json` führt derzeit kein
Bild; die UI läuft deshalb im bildlosen Fall, und der ist getestet.

**Geocoding-Pipeline** (`pnpm geocode`, Build-Zeit, nicht zur Laufzeit):

1. Jeden Stopp gegen Nominatim + Wikidata/Overpass auflösen (Name + Straßen-Nr.
   aus dem Reiseplan als Hinweis, `countrycodes=is`).
2. Treffer nur übernehmen, wenn eindeutig — sonst in `data/offen.json` schreiben
   und manuell klären. Kein stilles Raten.
3. Ergebnis mit Quelle und Prüfdatum zurückschreiben, Cache committen (Rate
   Limits, reproduzierbare Builds).
4. Aktueller Stand: 127 von 128 kuratiert, 1 offen (Hot Pot Krosslaug), 18 als
   Näherung markiert. Die Pipeline ersetzt alle Näherungen durch belegte Werte.

Ferienhäuser (viatis.is) haben keine öffentliche Adresse → bleiben
`genauigkeit: 'bereich'` und werden in der UI als solche gezeichnet.

## 5. Interaktion (das eigentliche Produkt)

- **Zeitstrahl** unten über der Karte: 15 Tage als Knoten auf einer
  durchlaufenden Achse, gegliedert in die sieben Standzeiten. Klick =
  Kameraflug auf die Etappe (`fitBounds` mit `pitch`, `bearing`).
- **Kamera-Tour**: Play fährt die Tagesetappe ab (`easeTo`-Kette entlang der
  Stopps, Terrain sichtbar). Der Ersatz für jede Textliste.
- **Stopps** als MapLibre-Symbol-Layer, nicht als DOM-Marker. Klick =
  Vorschau-Blase am Symbol; „Mehr dazu" öffnet das Kontextblatt.
- **Klick auf leere Karte** → schließt eine offene Auswahl; ohne Auswahl
  „Was ist hier?" an das LLM, mit Koordinate, Reisetag und nächstgelegenem
  Stopp als Kontext.
- **Zeichnen** (Terra Draw): Punkt / Route / Fläche. Eine Fläche ist eine Frage
  an das LLM („Was liegt in diesem Gebiet?"). Persistenz in `localStorage`.
- **Etappenlinien** als GeoJSON-Line-Layer, gestrichelt, klar als Schematik
  gelabelt — keine Navigationsroute. Echtes Routing erst, wenn ein
  Routing-Dienst dazukommt (v2, OSRM/Valhalla).
- Deep Links: `/?tag=2026-09-05&stopp=8` — teilbar, reload-fest.
- Tastatur: ←/→ Tag, Esc eine Stufe zurück, Leertaste Tour. Reduced-Motion
  respektieren.
- Hell/dunkel über MapLibre-Style-Wechsel, nicht per CSS-Filter.

### 5.1 Zwei Stufen zu einem Ziel — Entscheidung

Ein Klick auf ein Symbol öffnete direkt das Kontextblatt. Auf 390 px hieß das:
ein Drittel der Karte weg, um zwei Sätze zu lesen — im Widerspruch zu §1.

Jetzt gilt: **Blase zuerst, Blatt auf Wunsch.** Die Blase sitzt am Symbol, zeigt
Bild (wenn vorhanden), ein bis zwei ganze Sätze aus `stopp.text` und einen
benannten Weg ins Kontextblatt.

| Frage | Entscheidung | Begründung |
|---|---|---|
| `maplibregl.Popup` oder eigenes DOM? | eigenes DOM über `map.project()` | Der Popup dreht seinen Anker, klemmt aber nicht — am Rand steht er halb außerhalb. Auf 390 px ist das der Normalfall. |
| Bild mit Nennung in der Blase? | nein, nur im Kontextblatt | Bewusste Entscheidung des Nutzers für diesen Stand; die vollständige Nennung ist einen Tipp entfernt. Ohne Nennung kommt ein Bild gar nicht erst in die Daten (`BildSchema`). |
| Text kürzen? | nur an Satzgrenzen | Ein Schnitt nach Zeichenzahl trifft mitten ins Wort. Lieber ein Satz zu wenig als ein halber. |
| Deep Link → Blase oder Blatt? | Blatt | Wer einem geteilten Link folgt, hat den Kontext nicht, den ein eigener Klick aufbaut. |
| Esc | eine Stufe je Druck | Tagesablauf → Kontextblatt → Blase → nichts, in der Reihenfolge, in der die Schichten aufgingen. |

Das Kontextblatt ist mobile first: Bottom-Sheet bis `max-h-[75dvh]`, ab `sm:`
Spalte rechts. Als Spalte über die ganze Höhe blieben auf 390 px 90 px Karte
übrig — von §1 wäre nichts geblieben.

### 5.2 Zeitstrahl statt Tagesreihe — Entscheidung

Der Streifen war eine Reihe gleich großer Kästchen ohne Gliederung, breiter als
das Bild und ohne Scrollen — man sah nie die ganze Reise.

- **Durchlaufende Achse**, Tage als Knoten: eine Folge liest sich anders als
  eine Auswahl.
- **Standzeiten als Gliederung** (`src/lib/etappe.ts`): sechs Quartiere plus
  Abreisetag. Ein Tag gehört zu der Unterkunft, in der man an seinem Abend
  schläft. Nach Quartieren erinnert man eine Reise, nicht nach Datum.
- **Tagesart als Symbol**, fünf eigene SVG-Pfade. Die Canvas-Zeichner in
  `map/icons.ts` zeichnen die Zielart (16 Werte) für MapLibre; ein Umbau auf
  SVG-Ausgabe wäre viel Arbeit für Symbole, die es danach immer noch nicht
  gäbe. Winzige Canvas-Elemente im DOM wären für ein statisches Piktogramm ein
  Umweg. Farbe allein trug es nicht: sie ist mit der Route belegt.
- **Was der Streifen trägt**: Datum, Art, Ziele, Kilometer, Fahrzeit — die
  Zahlen, die einen Tag planbar machen. Reihenfolge der Stopps, Gehzeiten,
  Hinweise und Quartier stehen im **Tagesablauf**; über der Karte wären sie
  Lärm.
- **Der Weg in den Tagesablauf** ist die Zusammenfassungszeile selbst, benannt
  und mit der größten Trefferfläche des Streifens — kein angeklebter Knopf, und
  kein unsichtbares „zweites Tippen".
- Der Streifen meldet `--streifen-hoehe`, das Kontextblatt `--blatt-rechts` /
  `--blatt-unten`. Bedienelemente und Herkunftsangabe rechnen damit; verdeckt
  werden darf die Herkunftsangabe nie (Bedingung der Kartennutzung, geprüft im
  E2E paarweise).

### 5.3 Kamerafahrt nur, wenn nötig — Entscheidung

Jeder Klick auf ein Symbol flog mit festem Zoom 12 hin, auch wenn das Ziel
schon im Bild stand. Das riss den Ausschnitt weg, den man sich gerade aufgebaut
hatte.

- **„Sichtbar" ist nicht `getBounds().contains()`.** Gerechnet wird gegen den
  frei sichtbaren Ausschnitt (`src/map/sicht.ts`): Viewport minus Zeitstrahl,
  Kontextblatt, Herkunftsangabe, Bedienelemente und Rand. Die großen Einbauten
  werden am DOM **gemessen**, nicht aus Breakpoints nachgebaut — nachgebaute
  Annahmen gehen irgendwann auseinander.
- **Zoomschwelle**: unter Zoom 8 wird trotzdem geflogen. Ein Punkt kann
  sichtbar und seine Umgebung trotzdem unlesbar sein.
- **Ruhig fliegen**: aktueller Zoom bleibt (nach unten begrenzt auf 10,5),
  Neigung und Drehung bleiben, verschoben wird nur die Mitte — und zwar in die
  Mitte des freien Bereichs.
- **Unterkünfte** lösen dieselbe Regel aus wie Stopps. Dass sie früher gar
  keinen Flug auslösten, war willkürlich.
- **Nicht angetastet**: der Tageswechsel fliegt weiter, Deep Links fliegen
  weiter. Während eines laufenden Fluges gilt ein Ziel als „nicht sichtbar" —
  sonst entscheidet man auf einem wandernden Ausschnitt.
- `reduziert()` (prefers-reduced-motion) bleibt in allen Wegen.

## 6. LLM

- **Nur serverseitig**: `app/api/ask/route.ts`, Streaming per SSE. Schlüssel als
  Vercel-Env `OPENAI_API_KEY`, nie im Client.
- `ChatOpenAI` aus `@langchain/openai`, Modell per Env (`OPENAI_MODEL`).
- Live-Daten über das eingebaute `web_search`-Tool der Responses-API.
  **Bekannte Einschränkung:** Streaming + `web_search` ist in LangChain JS
  fehleranfällig (langchainjs#8283) → Fallback: Suchanfragen ohne Stream
  beantworten, oder Tavily-Tool statt `web_search`. Vor dem Bau in einem
  Spike prüfen.
- **Zuerst Mock**: `LLM_MODE=mock` liefert deterministische, gestreamte
  Beispielantworten aus Fixtures. Die ganze UI wird gegen den Mock gebaut und
  getestet; der echte Aufruf ist ein Adapter-Tausch.
- Prompt-Kontext kommt aus `reise.json`: Reisetag, Etappe, Unterkunft,
  Koordinate, Veranstaltertext. Antwortformat: max. 6 Punkte, Zahlen wenn
  vorhanden, Unsicherheit benennen.
- Rate Limit pro IP, Antwortlänge begrenzt, Kosten pro Anfrage geloggt.
- Jede Antwort sichtbar als LLM-Ausgabe markiert.

## 7. Vercel

- Repo → Vercel-Projekt, Framework-Preset Next.js, Region `fra1`.
- Env: `OPENAI_API_KEY`, `OPENAI_MODEL`, `LLM_MODE`, optional `TAVILY_API_KEY`.
- Preview-Deploy pro Branch, Production auf `main`.
- Route Handler als Node-Runtime (LangChain-Kompatibilität vor Edge-Kaltstart).
- Basiskarte/DEM extern → CSP `connect-src`/`img-src` entsprechend öffnen,
  sonst restriktiv.

## 8. Meilensteine

| # | Inhalt | Ergebnis |
|---|---|---|
| 0 | Next.js + Vercel + Zod-Schema für `reise.json` | grünes Deploy |
| 1 | MapLibre + Terrain + Stopps + Zeitachse | Karte trägt die Daten |
| 2 | Kamera-Tour, Kontextblatt, Deep Links | navigierbar ohne Listen |
| 3 | Geocoding-Pipeline, Näherungen ersetzt | belegte Positionen |
| 4 | LLM gemockt, SSE-Stream, Kartenklick-Frage | UI fertig testbar |
| 5 | LangChain echt + web_search-Spike | Live-Infos |
| 6 | Terra Draw + Flächen-Frage | eigene Zeichnung als Kontext |
| 7 | Vorschau-Blase, Zeitstrahl, ruhige Kamera | auf 390 px bedienbar (§5.1–5.3) |

v2, nicht jetzt: echtes Routing, Offline/Service Worker, Wetter- und
Straßenzustand-Feeds (vedur.is, road.is), deck.gl-Arcs. Fotos pro Stopp: das
Schema steht (`bild`, §4), belegte Bilder gibt es noch keine.

## 9. Offen — vor Reisebeginn klären

1. **Þrasastaðir**: Übernachtungsplan sagt Akureyri, Reiseplan behandelt die
   Station als Basis im Mývatngebiet. Tagesausflüge sind ab Mývatn gerechnet
   (Diamond Circle 207 km, Siglufjörður 150 km je Strecke). Position bis dahin
   `null` — die App zeigt das als Lücke, statt sie zu erfinden.
2. **Hafnarhólmi** (04.09.): Papageitaucher-Saison endet laut Reiseplan Anfang
   August.
3. **Hlíðarendi**: für 5 Personen ausgelegt, 5 Reisende, 1 Appartement.
4. **Earth Lagoon Mývatn** (31.08.): „Wiedereröffnung Sommer 2026".
5. **Grindavík / Fagradalsfjall** (09.09.): Zugang je Vulkanlage.
6. **Flugzeiten fehlen** in beiden PDFs — bestimmen, ob 130 km + Blaue Lagune am
   Anreisetag realistisch sind und wie viel Puffer am 10.09. bleibt.
