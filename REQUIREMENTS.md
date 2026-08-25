# Island 2026 — Requirements

Interaktive 3D-Karten-App für den Reiseplan „Rund um die Insel" (Katla Travel,
Vorgang 15412, 27.08.–10.09.2026, 5 Personen).
Quelle: `data/reise.json` — 15 Tage, 6 Unterkünfte, 128 Stopps, ~2.450 km.

---

## 1. Leitsatz

Die Karte **ist** die App. Kein Sidebar-Listen-Layout, keine Tabs, keine
Dokumentansicht. Alles Weitere ist minimal: Zeitachse, Kartenlabels, ein
Kontextblatt. Wenn eine Information nicht auf oder an der Karte hängt, gehört
sie nicht in v1.

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
- **Zod** — Schema für `reise.json`, validiert beim Build
- **Vitest** + **Playwright** (Smoke: Karte lädt, Marker klickbar, Tag wechselt)
- **pnpm**, ESLint, Prettier
- Deployment **Vercel**

## 4. Datenmodell + Geocoding

`data/reise.json` bleibt Single Source of Truth. Erweiterung pro Stopp:

```ts
pos:      [lat, lon]
posMeta:  { quelle: 'osm'|'wikidata'|'manuell', genauigkeit: 'punkt'|'bereich', geprueftAm: string, ref?: string }
```

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

- **Zeitachse** unten über der Karte: 15 Tage, farbcodiert nach Typ. Klick =
  Kameraflug auf die Etappe (`fitBounds` mit `pitch`, `bearing`).
- **Kamera-Tour**: Play fährt die Tagesetappe ab (`easeTo`-Kette entlang der
  Stopps, Terrain sichtbar). Der Ersatz für jede Textliste.
- **Stopps** als MapLibre-Symbol-Layer, nicht als DOM-Marker. Hover = Label +
  Höhenprofil-Tooltip, Klick = Kontextblatt am Kartenrand (max. 1/3 Breite).
- **Klick auf leere Karte** → Koordinate und Reisetag im Kontextblatt.
- **Etappenlinien** als GeoJSON-Line-Layer, gestrichelt, klar als Schematik
  gelabelt — keine Navigationsroute. Echtes Routing erst, wenn ein
  Routing-Dienst dazukommt (v2, OSRM/Valhalla).
- Deep Links: `/?tag=2026-09-05&stopp=8` — teilbar, reload-fest.
- Tastatur: ←/→ Tag, Esc schließt, Leertaste Tour. Reduced-Motion respektieren.
- Hell/dunkel über MapLibre-Style-Wechsel, nicht per CSS-Filter.

## 7. Vercel

- Repo → Vercel-Projekt, Framework-Preset Next.js, Region `fra1`.
- Keine Umgebungsvariablen — die App hat keine Geheimnisse.
- Preview-Deploy pro Branch, Production auf `main`.
- Basiskarte/DEM extern → CSP `connect-src`/`img-src` entsprechend öffnen,
  sonst restriktiv.

## 8. Meilensteine

| # | Inhalt | Ergebnis |
|---|---|---|
| 0 | Next.js + Vercel + Zod-Schema für `reise.json` | grünes Deploy |
| 1 | MapLibre + Terrain + Stopps + Zeitachse | Karte trägt die Daten |
| 2 | Kamera-Tour, Kontextblatt, Deep Links | navigierbar ohne Listen |
| 3 | Geocoding-Pipeline, Näherungen ersetzt | belegte Positionen |

v2, nicht jetzt: echtes Routing, Offline/Service Worker, Wetter- und
Straßenzustand-Feeds (vedur.is, road.is), Fotos pro Stopp, deck.gl-Arcs.

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
