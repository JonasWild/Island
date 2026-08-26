# Island 2026 — Requirements

Karten-App für den Reiseplan „Rund um die Insel" (Katla Travel, Vorgang 15412,
27.08.–10.09.2026, 5 Personen).
Quelle: `data/reise.json` — 15 Tage, 6 Unterkünfte, 128 Stopps.

Dieses Dokument trägt die Entscheidungen **mit ihren Begründungen** — auch die
zurückgenommenen. Was einmal falsch war, soll nicht ein zweites Mal gebaut
werden.

---

## 1. Leitsatz

Die Karte **ist** die App. Kein Sidebar-Listen-Layout, keine Tabs, keine
Dokumentansicht. Alles Weitere ist minimal: Tagesstreifen, Kartenlabels, ein
Kontextblatt. Wenn eine Information nicht auf oder an der Karte hängt, gehört
sie nicht hinein.

**Gebaut fürs Handy.** Der Desktop ist der Sonderfall. Die App wird unterwegs
im Auto benutzt, nicht am Schreibtisch — Trefferflächen ab 44 px, alles
Bedienbare in Daumenreichweite, `h-dvh` gegen die Adressleiste.

**Nichts wird geraten.** Jede Position, jeder Hintergrundtext und jede Route
trägt ihre Herkunft. Was sich nicht eindeutig belegen lässt, bleibt leer und
steht mit Begründung in einer Datei daneben. Eine Lücke ist ehrlich, eine
erfundene Angabe nicht.

## 2. Kartentechnik — Entscheidung

**MapLibre GL JS v5**, direkt und in **2D**. Kein `react-map-gl` — die Kamera
bleibt imperativ. Basiskarte OpenFreeMap (kostenlos, kein Key), hell und dunkel
über einen echten Style-Wechsel statt eines CSS-Filters.

### Zurückgenommen: 3D-Terrain

Ursprünglich war 3D-Terrain (`raster-dem` + `setTerrain`) der Kern der
Entscheidung: „Island ist Relief, in 2D geht das verloren." Gebaut und wieder
ausgebaut. Die Begründung stimmte in der Sache, das Ergebnis nicht:

- `setTerrain` ist der teure Teil — Mesh-Aufbau, Depth-Buffer und **je Bild
  eine Höhenabfrage pro Marker**. Auf dem Handy ist das der Unterschied
  zwischen flüssig und zäh.
- Es sah nicht gut aus. Die Symbole standen schief im Gelände, die Route
  verschwand hinter Hügeln, und der Nutzen — erkennen, wo man langfährt — war
  in 2D größer.

Mit dem Terrain fielen `setSky`, `maxPitch` und der Kamera-Pitch. Auch die
Drehung in Fahrtrichtung ging mit: sie trug nur, solange es ein Relief zu
betrachten gab, und kostet auf einer flachen Karte bloß Orientierung. Norden
bleibt oben.

### Zurückgenommen: die Relief-Schummerung

Nach dem Terrain blieb eine zuschaltbare Schummerung übrig — ein
`hillshade`-Layer auf denselben AWS Terrain Tiles, der die Höhendaten liest,
ohne Geometrie daraus zu bauen. Auch die ist wieder raus: sie wurde nicht
gebraucht. Damit lädt die Karte genau einen fremden Host.

Für die Nachwelt, falls die Frage wiederkommt: Esri World Hillshade liefert
über Island ein nahezu weißes Multiply-Overlay, das MapLibre ohne
Multiply-Blendmodus nicht verwerten kann; OpenTopoMap ist keine Schummerung,
sondern eine vollständige Basiskarte; `demotiles.maplibre.org` deckt nur einen
Ausschnitt der Alpen ab.

### Zurückgenommen: 3D-Modelle

Ein three.js-Custom-Layer mit glTF-Modellen je Zielart war einmal angedacht und
ist es nicht mehr wert: ein zweiter Renderer im Bundle für einen Effekt, den
2D-Piktogramme besser tragen. Die Symbole werden zur Laufzeit auf ein Canvas
gezeichnet (`src/map/icons.ts`) — kein Sprite, kein weiterer Netzaufruf.

### Nicht gebaut

| Option | Warum nicht |
|---|---|
| **CesiumJS / Resium** | Ion-Token, schweres Bundle, eigene Styling-Welt. Overkill für 128 Punkte. |
| **Mapbox GL JS v3** | Technisch top, aber Token und Preis pro Load. |
| **Google Photorealistic 3D Tiles** | Schönste Bilder, teuer, braucht Cesium als Renderer. |
| **deck.gl** | Kein Kartenrenderer, sondern Layer darüber. |
| **Terra Draw** | Zeichnen war an die LLM-Flächenfrage gebunden. Ohne die trägt es nichts. |
| **Leaflet + Geoman** | Solide, aber ohne Vektorstyling und Kamerakontrolle. |

## 3. Stack

- **Next.js** (aktuelles Stable, App Router) + **React** + **TypeScript strict**
- **MapLibre GL JS v5** direkt (kein react-map-gl — Kamerasteuerung bleibt imperativ)
- **@watergis/maplibre-gl-terradraw** (Terra Draw)
- **Tailwind CSS v4** — nur Tokens + Utilities, keine Komponenten-Bibliothek
- **Zustand** für Kartenzustand (Tag, Stopp, Kameramodus, Zeichnung)
- **Zod** — Schema für `reise.json`, validiert beim Build
- **Vitest** + **Playwright** in zwei Breiten (Pixel 7 und Desktop). Die
  E2E-Tests ersetzen den Basisstil durch einen minimalen lokalen Stil und
  laufen ohne Netz: geprüft wird der eigene Code, nicht die Erreichbarkeit
  fremder Server.
- **Keine LLM-Abhängigkeit**, kein Serverpfad, keine Umgebungsvariablen
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
4. Stand: 128 von 128 belegt — 89 punktgenau aus OSM, 39 als Bereich.

Ferienhäuser (viatis.is) haben keine öffentliche Adresse → bleiben
`genauigkeit: 'bereich'` und werden in der UI als solche gezeichnet.

**Hintergrundtexte** (`pnpm wissen`, Build-Zeit): Einleitungsabsatz des
passenden Artikels aus der deutschen Wikipedia, abgelegt als
`wissen: { text, quelle, url, geprueftAm }`. Übernommen wird nur Eindeutiges —
der Artikelname stimmt mit dem Stopp überein und ist der einzige dieses Namens
im Umkreis, oder er ist der einzige Artikel unter 400 m bei punktgenauer
Position. 69 von 128 Stopps haben Text; die übrigen stehen mit Begründung in
`data/wissen-offen.json`.

**Bilder** (`pnpm bilder`, Build-Zeit): Leitbild des zugeordneten
Wikipedia-Artikels, sonst ein georeferenziertes Commons-Bild, dessen
Dateiname den Stopp nennt. Lagekarten und Wappen fallen raus. 84 von 128
Stopps haben ein Bild; Urheber und Lizenz stehen dabei.

**Routing** (`pnpm route`, Build-Zeit): siehe Abschnitt 6.

## 5. Interaktion

- **Zeitstrahl** unten: eine durchgehende Achse, an der die Tage als Perlen
  sitzen, gruppiert nach **Standzeiten** — Zeiträumen zwischen zwei
  Unterkünften, mit Quartier und Nächtezahl als Klammer. Die Reise besteht aus
  sechs solchen Abschnitten, nicht aus fünfzehn gleichrangigen Tagen. Jede
  Perle trägt das Zeichen ihrer Tagesart; die Nächtezahl steht ausgeschrieben
  im Kopf der Gruppe. **Farbe trägt nur der gewählte Tag** — siehe unten.
  Darüber, nicht darunter, die Zusammenfassung des gewählten Tages: sie
  beschreibt, was auf der Karte zu sehen ist, und gehört deshalb an die Karte.
- **Vorschau vor Detail**: ein Klick auf ein Kartensymbol öffnet eine kleine
  Blase am Marker (Bild, Name, ein bis zwei Sätze), erst „Mehr" das
  Kontextblatt. Der Blick auf „was ist das?" soll nicht das halbe Bild kosten.
- **Die Kamera bewegt sich nur, wenn nötig**: ein Ziel, das frei im Bild
  liegt, wird nicht herangeholt. Geprüft wird die freie Fläche, nicht der
  Kartenausschnitt — die Kanten der eigenen Einbauten werden gemessen. Auf dem Handy
  horizontal scrollbar mit Snap, Ziele ab 44 px, der gewählte Tag zentriert
  sich selbst. Ab `sm:` die kompakte Pille. Klick = Kameraflug auf die Etappe.
  Das Wischen ist die native Scroll-Geste des Streifens; auf der Karte selbst
  bleibt der horizontale Wisch das Schwenken.
- **Stopps** als MapLibre-Symbol-Layer, nicht als DOM-Marker. Die Zielart wird
  **allein aus dem Namen** abgeleitet (`src/lib/kategorie.ts`) — isländische
  Namen tragen ihre Art im Wort, der Beschreibungstext führt in die Irre.
- **Kontextblatt**: auf dem Handy ein Bottom-Sheet über die volle Breite mit
  Ziehgriff, ab `sm:` die Spalte rechts. Zeigt Veranstaltertext und, wenn
  vorhanden, den Wikipedia-Hintergrund mit Quelle, Link und Prüfdatum.
- **Klick auf leere Karte** → Koordinate und Reisetag im Kontextblatt.
- **Routenlinien**: gefahrene Straßenrouten aus `data/route.json`, durchgehend
  verkettet. Durchgezogen = Pflichtstrecke, gepunktet = Abstecher, grau
  gestrichelt = Luftlinie ohne saubere Route. Pfeile zeigen die Fahrtrichtung.
  Farbe trägt **nur der gewählte Tag** — fünfzehn bunte Linien gleichzeitig
  sind Konfetti, in dem die Farbcodierung nichts mehr aussagt.
- **Filterleiste** oben: „Nur dieser Tag" plus drei Gruppen (Natur, Aktiv,
  Orte), die beim Tippen die einzelnen Zielarten aufklappen. 128 Symbole
  gleichzeitig sind keine Karte mehr. Unterkünfte lassen sich nicht
  wegfiltern.
- **Tagesablauf** als Vollbild: die Ziele als Zeitstrahl von Bett zu Bett, in
  der gefahrenen Reihenfolge aus `route.json`. Ziele ohne Wegpunkt stehen
  getrennt unter „Ohne festen Halt" — sie sind Vorschläge, kein Halt.
- **Marker**: eine Farbe je Zielart, damit sich sechzehn Arten auf Markergröße
  unterscheiden. Die Unterkunft hat eine eigene Silhouette und trägt die
  **Anzahl der Nächte als Zahl** — das ist die wichtigste Angabe des Tages.
  Stopps mit Wanderung tragen ein Abzeichen; der Wegverlauf wird nicht
  gezeichnet, weil er in keiner Quelle dieses Projekts steht.
- Deep Links: `/?tag=2026-09-05&stopp=8` — teilbar, reload-fest.
- Tastatur: ←/→ Tag, Esc schließt. Reduced-Motion respektieren.
- Hell/dunkel über MapLibre-Style-Wechsel, nicht per CSS-Filter.

### Zurückgenommen: fünfzehn farbige Perlen

Der Tagesstreifen färbte anfangs **jede** Perle in der Farbe ihrer Tagesart —
dieselben fünf Farben, die auch die Routen tragen. Die Absicht war richtig, die
Wirkung nicht: es war exakt die Konfetti-Falle, die für die Linien auf der
Karte schon entschieden war (Abschnitt „Routenlinien"). Wenn fünfzehn Perlen
Farbe tragen, unterscheidet Farbe nichts mehr — sie wird Dekoration, und der
gewählte Tag geht in ihr unter. Dazu kam, dass die inaktiven Perlen zur
Beruhigung auf 45 % Deckkraft standen: das nahm dem weissen Zeichen darin den
Kontrast, ohne die Buntheit wirklich zu nehmen.

Jetzt gilt im Streifen dieselbe Regel wie auf der Karte. Der gewählte Tag trägt
seine Farbe, die übrigen bleiben weiss mit grauem Zeichen. Dieselbe Regel traf
die rote Nächte-Ziffer und die grüne Gehzeit: beides war Farbe, die etwas
bedeuten sollte, ohne es zu sagen — ersetzt durch Wort und Form (Bett, Stiefel).

### Zurückgenommen: Halbwerte als Layout-Konstanten

Die Achse des Zeitstrahls lag auf `top-4` — der halben Perlenhöhe — und endete
bei `1.375rem`, der halben Tagesbreite. Beide Zahlen waren von Hand gegen die
Perlengrösse nachgeführt, und beide waren stumm: Änderte sich eine der
Grössen, löste sich die Achse von den Perlen, ohne dass etwas den Fehler
gemeldet hätte. Genau das passierte am Abreisetag — dessen Kopfzeile ohne
Nächte-Abzeichen vier Pixel flacher war, was die ganze letzte Gruppe samt Achse
nach oben zog.

Die Masse stehen jetzt einmal als CSS-Variablen (`--perle`, `--tag`,
`--luecke`), die Achse rechnet mit `calc()`, die Kopfzeile hat feste Höhe, und
ein E2E-Test prüft, dass Achse und Perlen aller sieben Gruppen auf **einer**
Höhe liegen. Nicht die Ursache wird geprüft, sondern die Geometrie — egal, was
künftig in der Kopfzeile steht.

## 6. Routing — Entscheidung

Die Linien waren zuerst Luftlinien zwischen den Stopps und liefen entsprechend
kreuz und quer über Seen und Gletscher. Ersetzt durch echte Straßenrouten.

**Zur Build-Zeit, nicht zur Laufzeit.** Beide infrage kommenden Dienste sind
Demo-Instanzen mit Fair-Use-Auflagen; ein Aufruf pro Seitenaufruf wäre
respektlos und langsam. `pnpm route` schreibt `data/route.json`, die App lädt
nur noch die Datei. Dasselbe Muster wie beim Geocoding.

**Valhalla (FOSSGIS), nicht OSRM** — wegen der F-Straßen. Die Gruppe fährt
einen 9-Sitzer **ohne Allrad**; führt eine Route über eine F-Straße, ist sie
falsch. Nachgemessen für Gullfoss → Blönduós:

| Dienst | Ergebnis |
|---|---|
| OSRM-Demo, Profil `driving` | 251 km über **F338 und F578**, quer durchs Hochland |
| Valhalla, `costing_options.auto.use_tracks = 0` | 327 km über die Ringstraße, keine F-Straße |

`use_tracks` deckt nur `highway=track` ab; viele F-Straßen sind anders getaggt.
Deshalb wird das Ergebnis zusätzlich auf F-Nummern in den Straßennamen geprüft,
ebenso auf Fähren.

Weitere Regeln der Pipeline:

- Die Reihenfolge der Stopps in `reise.json` ist **keine Fahrreihenfolge**,
  sondern die Vorschlagsliste des Veranstalters. Sie wird vor dem Routen
  sortiert (nächster Nachbar, dann 2-opt); Start und Ziel bleiben fest.
- Nur punktgenaue Stopps werden angefahren. Ein Landschaftsraum ist kein Ziel,
  das man ansteuert — sein Schwerpunkt würde auf eine beliebige Straße gezogen.
- Wegpunkte, die weiter als 2 km auf eine Straße gezogen werden, fliegen raus
  und der Tag wird neu geroutet.
- Die Kette über alle Tage bleibt durchgehend: jeder Tag beginnt beim
  Endpunkt des Vortags.
- Ein Tag, der nicht sauber gelingt, fällt auf die Luftlinie zurück **und wird
  als solche gekennzeichnet**. Eine falsche Straßenroute stillschweigend zu
  zeigen wäre schlimmer.
- Geometrie mit Douglas-Peucker auf 25 m vereinfacht: aus 53 000 Stützpunkten
  und 1,2 MB werden 6 600 und 139 KB. Bei maximalem Zoom 10,5 ist ein Pixel gut
  100 m breit.

Die gerouteten Kilometer liegen über `etappe.km` — 3648 gegen 2292. Das ist
kein Fehler: der Reiseplan zählt die direkte Fahrt von A nach B und sagt das
selbst („ca. 2 Stunden ohne Abstecher"), die Route fährt zusätzlich die
vorgeschlagenen Ziele an. Auffällige Tage stehen in der Prüfausgabe des
Skripts.

## 7. Zurückgenommen: das LLM

Ursprünglich Kern des Konzepts: eine SSE-Route mit `ChatOpenAI`, „Was ist
hier?" auf Kartenklick, Flächenfragen über Terra Draw. Vollständig entfernt.

Die Inhalte lassen sich direkt recherchieren, und das Ergebnis ist besser:
`pnpm wissen` liefert nachprüfbaren Text mit Quelle, Link und Prüfdatum, statt
einer generierten Antwort, die niemand belegen kann. Dazu entfielen ein
Serverpfad, ein Schlüssel, ein Rate Limit und eine bekannt fehlerhafte
Streaming-Variante (langchainjs#8283). Die App hat damit keine Geheimnisse
mehr und braucht keine Umgebungsvariablen.

## 8. Vercel

- Repo → Vercel-Projekt, Framework-Preset Next.js, Region `fra1`.
- Keine Umgebungsvariablen — die App hat keine Geheimnisse.
- Preview-Deploy pro Branch, Production auf `main`.
- Basiskarte extern → CSP öffnet genau `tiles.openfreemap.org` (Karte) und
  `upload.wikimedia.org` (Bilder, nur `img-src`), sonst restriktiv. Die
  Routing- und Wikipedia-APIs stehen bewusst **nicht** darin: sie werden nur
  zur Build-Zeit angefragt.

## 9. Meilensteine

| # | Inhalt | Ergebnis |
|---|---|---|
| 0 | Next.js + Vercel + Zod-Schema für `reise.json` | grünes Deploy |
| 1 | MapLibre + Terrain + Stopps + Zeitachse | Karte trägt die Daten |
| 2 | Kamera-Tour, Kontextblatt, Deep Links | navigierbar ohne Listen |
| 3 | Geocoding-Pipeline, Näherungen ersetzt | belegte Positionen |
| 4 | LLM entfernt, Wikipedia-Pipeline | belegte Hintergrundtexte |
| 5 | Terrain und 3D-Modelle ausgebaut | schnelle 2D-Karte, Relief zuschaltbar |
| 6 | Mobile first | auf dem Handy bedienbar |
| 7 | Routing zur Build-Zeit | Linien auf echten Straßen |

Nicht enthalten: Zeichnen/Editieren, Kamera-Tour, Offline-Betrieb, Wetter- und
Straßenzustand-Feeds (vedur.is, road.is), Fotos pro Stopp.

## 10. Offen — vor Reisebeginn klären

1. **Þrasastaðir**: Übernachtungsplan sagt Akureyri, Reiseplan behandelt die
   Station als Basis im Mývatngebiet. Tagesausflüge sind ab Mývatn gerechnet
   (Diamond Circle 207 km, Siglufjörður 150 km je Strecke). Die Position steht
   als Bereich im Mývatngebiet; alle Routen dieser vier Tage hängen daran.
2. **Hafnarhólmi** (04.09.): Papageitaucher-Saison endet laut Reiseplan Anfang
   August.
3. **Hlíðarendi**: für 5 Personen ausgelegt, 5 Reisende, 1 Appartement.
4. **Earth Lagoon Mývatn** (31.08.): „Wiedereröffnung Sommer 2026".
5. **Grindavík / Fagradalsfjall** (09.09.): Zugang je Vulkanlage.
6. **Flugzeiten fehlen** in beiden PDFs — bestimmen, ob 130 km + Blaue Lagune am
   Anreisetag realistisch sind und wie viel Puffer am 10.09. bleibt.
