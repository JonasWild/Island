# Island 2026 — Rund um die Insel

Karte zum Reiseplan von Katla Travel (Vorgang 15412, 27.08.–10.09.2026,
5 Personen, Mietwagen, Ferienhäuser). 15 Tage, 6 Unterkünfte, 128 Stopps.

Die Karte ist die App. Daneben gibt es genau zwei Dinge: einen Tagesstreifen
unten und ein Kontextblatt, wenn man etwas antippt.

**Gebaut fürs Handy.** Der Desktop ist der Sonderfall, nicht umgekehrt.

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
| `pnpm route` | Straßenrouten je Tag (Build-Zeit, nicht Laufzeit) |
| `pnpm test` | Vitest |
| `pnpm e2e` | Playwright-Smoke, in zwei Breiten (Pixel 7 und Desktop) |
| `pnpm typecheck` / `pnpm lint` | statische Prüfung |

Container und CI-Images mit vorinstalliertem Chromium brauchen für die
E2E-Tests den Pfad:
`PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm e2e`.

Um die gebaute App wirklich anzusehen — auch dort, wo der Browser die
Kachel-Hosts nicht erreicht, Node über `HTTPS_PROXY` aber schon:

```bash
pnpm build && npx next start -p 3210
VP=mobil RELIEF=1 NODE_USE_ENV_PROXY=1 node scripts/screenshot.mjs
```

Das lohnt sich. In diesem Projekt sind mehrere Fehler ausschließlich im
Screenshot aufgefallen — eine tote Karte durch Höhe 0, ungültige
Layer-Ausdrücke, verdeckte Bedienelemente.

## Bedienung

| Eingabe | Wirkung |
|---|---|
| Klick auf einen Tag | Kameraflug auf die Etappe |
| `Relief` | Schummerung an/aus — lädt das DEM erst dann |
| `Legende` | erklärt Linienarten, Tagesfarben und Marker |
| `←` / `→` | Tag zurück / vor |
| Klick auf einen Stopp | Kontextblatt (auf dem Handy unten, sonst rechts) |
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

**Die Route liegt auf echten Straßen** und ist durchgehend: jeder Tag beginnt
beim Endpunkt des Vortags. Sie sagt vier Dinge gleichzeitig:

| Zeichen | Bedeutung |
|---|---|
| Durchgezogen | **Pflichtstrecke** — so kommt man abends ins Bett |
| Gepunktet | **Abstecher** zu einem vorgeschlagenen Ziel, kann man weglassen |
| Grau gestrichelt | **Luftlinie** — nicht sauber routbar, keine Fahrempfehlung |
| Pfeile | **Fahrtrichtung** |

**Farbe trägt nur der gewählte Tag.** Sie steht für die Art des Tages (Anreise,
Standtag, Tagesausflug, Etappe, Abreise) — aber fünfzehn bunte Linien
gleichzeitig sind Konfetti, in dem die Farbe nichts mehr bedeutet. Die übrigen
Tage bleiben neutral grau als Zusammenhang stehen, und der Tagesstreifen nennt
die Art des gewählten Tages im Klartext neben seinem Farbpunkt. Der Schalter
**Legende** erklärt die ganze Zeichensprache.

Details: [Routing](#routing).

**Symbole statt Punkte, und jede Art in ihrer Farbe.** Jeder Stopp bekommt ein
Piktogramm für seine Art — Wasserfall, heiße Quelle, Vulkan, Gletscher,
Schlucht, Höhle, Strand, Berg, See, Tiere, Museum, Kirche, Wanderung, Ort,
unterwegs. Sechzehn Piktogramme in identischem Grau sind auf Markergröße nicht
auseinanderzuhalten; deshalb trägt jede Art ihren Farbton, und die Zuordnung
ist nicht dekorativ: Wasser blau, Vulkanisches rot, Eis kühl und hell,
Gebautes warmgrau, Grün für Lebendiges. Der farbige Ring trägt die
Unterscheidung auch dann noch, wenn das Piktogramm zu klein zum Entziffern ist.
Gezeichnet wird zur Laufzeit auf ein Canvas — kein Sprite, kein weiterer
Netzaufruf.

**Die Unterkunft ist die Ausnahme.** Wo man schläft und wie lange ist die
wichtigste Angabe des Tages, also bekommt sie eine eigene Silhouette: ein
rotes abgerundetes Rechteck mit Bett **und der Anzahl der Nächte als Zahl**.
Schon die Form unterscheidet sie von jedem Ziel, auch stark verkleinert. Das
Kontextblatt wiederholt die Zahl groß, mit Zeitraum und Verpflegung.

**Wandern ist keine Zielart, sondern eine Eigenschaft.** Dettifoss bleibt ein
Wasserfall, auch wenn man 2,8 km hinläuft. Die 16 Stopps mit Wanderung tragen
deshalb ein grünes Abzeichen neben ihrem Symbol; Gehzeit, Strecke und Anstieg
stehen im Kontextblatt, die Summe der Gehzeiten im Tagesstreifen.

**Was die Karte nicht zeigt: den Verlauf der Wanderwege.** Der steht in keiner
Quelle dieses Projekts. Der Reiseplan liefert Gehzeit, Distanz und Höhenmeter,
aber keine Geometrie, und wo der Weg vom Parkplatz aus langführt, ließe sich
nur raten. Ein erfundener Pfad auf einer Karte, die sonst jede Position belegt,
wäre der schlechteste Tausch. Gefahren wird auf der Route, gelaufen wird an den
markierten Zielen.

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

## Mobile first

Fünfzehn Tage nebeneinander ergeben auf 390 px Breite je 26 px — unter jeder
brauchbaren Trefferfläche. Der Tagesstreifen scrollt deshalb horizontal mit
`snap-x snap-mandatory`, die Ziele sind mindestens 44 px breit, und der
gewählte Tag rückt per `scrollIntoView({ inline: 'center' })` von selbst ins
Bild — auch, wenn er über die Tastatur oder einen Deep Link gesetzt wurde. Ab
`sm:` bleibt derselbe Streifen die kompakte Pille von vorher.

Das Wischen ist damit die native Scroll-Geste des Streifens. Auf der Karte
selbst wäre ein horizontaler Wisch das Schwenken — die wichtigere Geste, die
nicht überschrieben wird.

Das Kontextblatt ist auf dem Handy ein Bottom-Sheet über die volle Breite mit
Ziehgriff; ab `sm:` wieder die Spalte rechts. Der Schließen-Knopf hat 44 px
Trefferfläche bei kleinem Kreuz.

Unten stapeln sich drei Dinge, von unten nach oben: Tagesstreifen, eigene
Schalter, Herkunftsangabe der Basiskarte. Der Streifen meldet seine gemessene
Höhe als CSS-Variable `--streifen-hoehe`, alles darüber rechnet damit statt mit
geratenen Zahlen. Die Herkunftsangabe steht ganz oben, weil sie als einzige mit
dem Inhalt wächst — mit eingeschaltetem Relief kommt der DEM-Anbieter dazu und
sie bricht um. Verdeckt werden darf sie nicht.

Zwei Fallen, die dabei aufgefallen sind und die ein E2E-Test festhält:
`maplibre-gl.css` wird erst in `MapCanvas` importiert und gewinnt bei gleicher
Spezifität gegen `globals.css` — deshalb sind die Regeln über `.maplibregl-map`
verschachtelt. Und die Herkunftsangabe hat seitliches Padding ohne
`border-box`, sodass `max-width` allein sie nicht schmal genug hält.

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

## Routing

`pnpm route` legt je Tag eine Route über echte Straßen und schreibt sie nach
`data/route.json`. **Zur Build-Zeit, nicht zur Laufzeit:** beide infrage
kommenden Dienste sind Demo-Instanzen mit Fair-Use-Auflagen, ein Aufruf pro
Seitenaufruf wäre respektlos und langsam. Zur Laufzeit lädt die App nur die
Datei — dieselbe Regel wie beim Geocoding.

**Valhalla (FOSSGIS), nicht OSRM** — wegen der F-Straßen. Die Gruppe fährt einen
9-Sitzer **ohne Allrad**; führt eine Route über eine F-Straße, ist sie falsch.
Nachgemessen für Gullfoss → Blönduós:

| Dienst | Ergebnis |
|---|---|
| OSRM-Demo, Profil `driving` | 251 km über **F338 und F578**, quer durchs Hochland |
| Valhalla, `costing_options.auto.use_tracks = 0` | 327 km über die Ringstraße, keine F-Straße |

`use_tracks` deckt nur `highway=track` ab, und viele F-Straßen sind anders
getaggt. Das Ergebnis wird deshalb zusätzlich auf F-Nummern in den
Straßennamen geprüft, ebenso auf Fähren — Gürtel und Hosenträger.

Weiter gilt:

- **Die Reihenfolge der Stopps in `reise.json` ist keine Fahrreihenfolge**,
  sondern die Vorschlagsliste des Veranstalters. Sie wird vor dem Routen
  sortiert (nächster Nachbar, dann 2-opt); Start und Ziel bleiben fest.
- Nur punktgenaue Stopps werden angefahren. Ein Landschaftsraum ist kein Ziel,
  das man ansteuert — sein Schwerpunkt landet auf einer beliebigen Straße. Als
  Marker bleiben diese Stopps natürlich auf der Karte.
- Wegpunkte, die weiter als 2 km auf eine Straße gezogen werden, fliegen raus
  und der Tag wird neu geroutet.
- **Pflicht und Kür werden getrennt.** Jeder Tag wird zweimal geroutet: einmal
  direkt von Start zu Ziel — die Strecke, die man fahren *muss* — und einmal
  über die vorgeschlagenen Ziele. Wo die zweite Route auf der ersten liegt, ist
  sie Pflicht; wo sie abzweigt, ist sie ein Abstecher. Die Karte zeichnet
  beides verschieden, die Kilometer stehen getrennt in `route.json`. An einem
  Standtag beginnt und endet der Tag an derselben Unterkunft — dann gibt es
  keine Pflichtstrecke und der ganze Tag ist Kür. Das ist keine Lücke, sondern
  die Aussage.
- Ein Tag, der nicht sauber gelingt, fällt auf die Luftlinie zurück **und wird
  als solche gekennzeichnet**: gestrichelte Linie, „Luftlinie" im
  Tagesstreifen, Begründung in `route.json`. Eine falsche Straßenroute
  stillschweigend als echte auszugeben wäre schlimmer. Aktuell betrifft das
  keinen Tag — 15 von 15 sind geroutet.
- Die Geometrie wird mit Douglas-Peucker auf 25 m vereinfacht: aus 53 000
  Stützpunkten und 1,2 MB werden 6 600 und 139 KB. Bei maximalem Zoom 10,5 ist
  ein Pixel gut 100 m breit, die Toleranz also unsichtbar.

**Zu den Kilometern:** geroutet sind es 3648 km, im Reiseplan stehen 2292 km.
Beide Zahlen stimmen, sie messen Verschiedenes. `etappe.km` ist die direkte
Fahrt von A nach B — der Reiseplan sagt das selbst („ca. 2 Stunden ohne
Abstecher"). Die Route fährt zusätzlich die vorgeschlagenen Ziele an. Der
Tagesstreifen zeigt die gefahrene Strecke, weil sie die Frage beantwortet, wie
lang der Tag wird. Auffällige Tage listet `pnpm route` in einer Prüfausgabe,
statt sie stillschweigend in die Daten zu schreiben.

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

Zeichnen/Editieren, Kamera-Tour, Offline-Betrieb, Wetter- und
Straßenzustandsfeeds (vedur.is, road.is), Fotos pro Stopp, 3D-Gelände.

Warum die drei zuletzt entfernten Dinge nicht wiederkommen sollten — Terrain,
3D-Modelle und das LLM — steht mit Begründung in
[`REQUIREMENTS.md`](./REQUIREMENTS.md).
