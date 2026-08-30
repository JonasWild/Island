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
| `pnpm bilder` | Fotos mit Lizenz von Wikipedia/Commons (Build-Zeit) |
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
| Zeile über dem Zeitstrahl | der Tag als Ablauf von Bett zu Bett |
| Filterleiste oben | nach Tag und Zielart filtern, Gruppe tippen öffnet die Zielarten |
| `←` / `→` | Tag zurück / vor |
| Klick auf einen Stopp | Vorschau-Blase am Symbol |
| `Mehr` in der Blase | Kontextblatt (auf dem Handy unten, sonst rechts) |
| Klick auf leere Karte | Koordinate im Kontextblatt |
| `Esc` | schließt das Kontextblatt |

Deep Links: `/?tag=2026-09-05&stopp=8` — teilbar und reload-fest.

## Karte

MapLibre GL JS v5 direkt, ohne `react-map-gl` — die Kamera bleibt imperativ.
Basiskarte OpenFreeMap (kein Key), hell als Standard, dunkel per Schalter über
einen echten Style-Wechsel statt eines CSS-Filters.

**Kein Terrain, kein Relief.** `setTerrain` ist raus. Das 3D-Gelände war der
teure Teil — Mesh-Aufbau, Depth-Buffer und je Bild eine Höhenabfrage pro
Marker — und sah dabei nicht gut aus. Mit ihm fielen `setSky`, `maxPitch` und
der Kamera-Pitch: die Karte ist 2D, Norden bleibt oben. Die Drehung in
Fahrtrichtung ging gleich mit; sie trug nur, solange es ein Relief zu
betrachten gab, und kostet auf einer flachen Karte bloß Orientierung.

Eine zuschaltbare Schummerung auf denselben DEM-Kacheln gab es danach noch
eine Weile. Sie ist ebenfalls raus — sie wurde nicht gebraucht. Damit lädt die
Karte genau einen fremden Host, `tiles.openfreemap.org`, und die CSP hat einen
Eintrag weniger.

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
die Art des gewählten Tages im Klartext neben seinem Farbpunkt. Details: [Routing](#routing).

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
wichtigste Angabe des Tages, also bekommt sie eine eigene Silhouette: eine
rote **Nadel** mit Bett, deren Spitze auf den Ort zeigt, und der Anzahl der
Nächte als Abzeichen an der Ecke. Schon die Form unterscheidet sie von jedem
runden Zielsymbol, auch stark verkleinert; sie liegt immer über den anderen
Markern und lässt sich nicht wegfiltern. Kontextblatt und Tagesablauf
wiederholen die Zahl groß, mit Zeitraum und Verpflegung.

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

## Zwei Stufen statt einer

Ein Klick auf ein Kartensymbol öffnet zuerst eine **Vorschau-Blase** direkt am
Marker: das Leitbild, Name, ein bis zwei Sätze, ein Zeiger auf das Symbol. Erst
„Mehr" führt ins Kontextblatt mit dem Bilderstreifen, Wanderdaten,
Veranstaltertext und Wikipedia-Hintergrund samt Abschnitten. Der Blick auf „was ist das überhaupt?" soll nicht das
halbe Bild kosten.

Der Text wird an **Satzgrenzen** gekürzt, nie mitten im Satz — ein
abgeschnittener Halbsatz liest sich wie ein Fehler.

Bewusst kein `maplibregl.Popup`, sondern ein eigenes Element: dessen Styles
aus `maplibre-gl.css` müssten sonst Stück für Stück überschrieben werden, und
dieselbe Datei gewinnt bei gleicher Spezifität gegen `globals.css`.

**Die Kamera bleibt dabei stehen**, wenn das Ziel schon frei im Bild liegt.
Geprüft wird nicht der Kartenausschnitt, sondern die tatsächlich freie Fläche:
ein Punkt kann im Ausschnitt liegen und trotzdem unter dem Kontextblatt oder
dem Tagesstreifen stecken. Deren Kanten werden gemessen, nicht geraten.

Eine Zoom-Schwelle („unter Zoom X lohnt das Heranfahren trotzdem") gibt es
absichtlich nicht: der Kameraflug auf einen Tag landet je nach Ausdehnung der
Etappe zwischen Zoom 6 und 10,5. Jede Schwelle in dieser Spanne hätte fast
jeden Klick aus der normalen Tagesansicht wieder zu einer Fahrt gemacht.

## Filtern

128 Symbole gleichzeitig sind auf einem Handy keine Karte mehr, sondern ein
Teppich. Die Leiste oben entlastet sie über zwei Achsen, beide mit einem
Tippen:

- **Nur dieser Tag** blendet die Ziele der anderen vierzehn Tage aus — die
  stärkste Entlastung, deshalb vorn und durch einen Trenner abgesetzt.
- **Drei Gruppen** in der Leiste: Natur, Aktiv, Orte. Mehr passt nicht
  nebeneinander, ohne dass man scrollen muss, um überhaupt zu sehen, was es
  gibt.
- **Die Zielart im Aufklapper.** Tippen auf eine Gruppe öffnet die Liste ihrer
  Zielarten, jede einzeln wählbar und mit der Zahl der Ziele dahinter. Wer nur
  Wasserfälle will, bekommt sie — und die Leiste bleibt trotzdem schmal.
  „Alles in Natur" schaltet die ganze Gruppe.

Keine Auswahl heißt alles sichtbar — der Normalfall braucht keinen Zustand,
und „Alle" bringt jederzeit zurück. Gemessen: aus 43 sichtbaren Markern
werden 6.

**Unterkünfte lassen sich nicht wegfiltern.** Wo man schläft, ist der Anker
des Tages; sie tragen deshalb keinen Gruppenschlüssel und bleiben immer
stehen — auch über die ganze Standzeit, nicht nur am Anreisetag. Am 28.08.
schläft man in dem Haus, das man am 27.08. bezogen hat.

## Etappen statt fünfzehn Tage

Die Reise besteht nicht aus fünfzehn gleichrangigen Tagen, sondern aus **sechs
Standzeiten**: Zeiträumen zwischen zwei Unterkünften. Man packt einmal aus,
bleibt eine bis vier Nächte, packt wieder ein. Daran hängt, was ein Tag
überhaupt sein kann — ein Umzugstag mit Gepäck im Auto oder ein Tag, an dem
man abends ins selbe Bett zurückkehrt.

Der Streifen unten ist deshalb ein **Zeitstrahl**: eine durchgehende Achse, an
der die Tage als Perlen sitzen, gruppiert nach Standzeiten. Jede Gruppe trägt
den Namen ihres Quartiers und die Zahl der Nächte. Ein Tag gehört zu der
Unterkunft, in der man an seinem **Abend** schläft; der Abreisetag hat keine
und bildet die letzte Gruppe.

Jede Perle trägt das **Zeichen ihrer Tagesart**. Alle fünf folgen einer
Grammatik: der gefüllte Punkt ist das Quartier, der Pfeil die Bewegung. Anreise
ist ein Pfeil von der Kante in den Punkt, Abreise einer vom Punkt über die
Kante hinaus, Etappe führt von Punkt zu **zweitem** Punkt, der Standtag ist ein
Punkt und sonst nichts, der Tagesausflug derselbe Punkt mit einem Pfeil
drumherum. Damit sagt die Leiste ohne ein einziges Wort, wie der Tag aussieht:
unterwegs oder vor Ort.

**Farbe trägt auch hier nur der gewählte Tag** — dieselbe Regel wie für die
Linien auf der Karte, und aus demselben Grund. Fünfzehn eingefärbte Perlen
waren dieselbe Konfetti-Falle: wenn alles Farbe trägt, trägt Farbe keine
Aussage mehr. Die gewählte Perle steht in der Farbe ihrer Tagesart, die
übrigen bleiben weiss mit grauem Zeichen, und der Strahl bleibt lesbar.

Die Zeichen liegen in `src/components/TagSymbol.tsx` als eigene SVG-Pfade.
Die Zielart-Piktogramme in `src/map/icons.ts` werden für MapLibre auf ein
Canvas gezeichnet und stehen im DOM nicht zur Verfügung; fünf Zeichen sind als
SVG billiger zu pflegen, als den Canvas-Weg für den DOM umzubauen — und auf
18 px optimiert, wo Platte und Ring der Kartensymbole nicht mehr lesbar wären.

Unterschieden wird über die **Silhouette**, nicht über Details. Die erste
Fassung war das nicht: Etappe und Abreise waren beide Kreis, Linie, Pfeilspitze
und unterschieden sich um weniger als zwei Pixel — auf Perlengrösse dasselbe
Zeichen. Der zweite Punkt bei der Etappe trägt die Unterscheidung jetzt allein.
Standtag und Tagesausflug teilen sich umgekehrt **denselben Punkt**, weil sie
sich dasselbe Bett teilen; der Unterschied ist nur die Fahrt drumherum.

Die Zahl der Nächte steht im Kopf der Gruppe **ausgeschrieben**, mit Bett und
Wort: „3 Nächte · Birkiskógar". Als blanke Ziffer in einem roten Abzeichen
sagte sie nicht, was sie zählt — Tage, Stopps, die wievielte Etappe? Rot bleibt
damit der Unterkunftsnadel auf der Karte vorbehalten, wo es etwas bedeutet.

**Was in der Leiste nicht steht**, steht im Tagesablauf: Pflicht- und
Kür-Anteil, die wievielte Nacht es ist, die Reihenfolge der Ziele. Die Leiste
beantwortet „wann und wie", nicht „was genau".

## Der Tag als Ablauf

Die **Zusammenfassungszeile** über dem Zeitstrahl öffnet die Ziele als Ablauf
von Bett zu Bett, in der **gefahrenen** Reihenfolge. Die ganze Zeile ist die
Schaltfläche, mit Winkel am rechten Rand — die übliche Geste für „hier geht es
weiter". Ein aufgesetzter dunkler Knopf daneben war der Fremdkörper. Darin blättert man durch die
Tage **derselben Standzeit** — der Sprung ins nächste Quartier ist ein anderer
Schritt und passiert über den Streifen.

Sie steht **über** dem Strahl, nicht darunter: sie beschreibt den Tag, den man
gerade auf der Karte sieht, und gehört deshalb an die Karte. Der Strahl gehört
an den unteren Rand, wo der Daumen ihn wischt. Abgesetzt sind die beiden nicht
durch einen dicken Strich, sondern durch den Grund — die Zeile auf Weiss, der
Strahl auf Grau, dazwischen eine Haarlinie.

Die ist nicht die aus `reise.json` — dort stehen die Vorschläge des
Veranstalters, teils mehrfach genannt, teils in beliebiger Folge. Die
Fahrreihenfolge entsteht erst in `pnpm route` und steht dort als
`reihenfolge`. Jeder Schritt zeigt Bild, Zielart und, wenn es eine gibt, die
Wanderung. Am Ende die Übernachtung mit der Zahl der Nächte.

Ziele, die die Route nicht anfährt — Landschaftsräume ohne Punktposition,
Streckenabschnitte, Doppelnennungen — stehen darunter unter **„Ohne festen
Halt"**. Sie stehen im Reiseplan und gehören deshalb dazu, aber nicht als
Halt, den es so nicht gibt.

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

### Hausblätter

Für drei der vier Ferienhäuser liegt die Hausinformation des Vermieters vor
(Viator Summerhouses). Sie schlägt jede Recherche, weil sie den Zielpunkt der
Parzelle mitbringt — Þrasastaðir, Hlíðarendi und Hlíðarholt stehen deshalb als
`quelle: 'anbieter'`, `genauigkeit: 'punkt'` im Datensatz. `pnpm geocode`
lässt diese Positionen auch mit `--all` in Ruhe: Ein Ortsmittelpunkt aus OSM
wäre schlechter als die Angabe dessen, dem das Haus gehört. Bei Hlíðarholt lag
der Datensatz vorher 7 km daneben — der Reiseplan nennt Flúðir, das Haus steht
bei Reykholt.

Was sonst auf dem Blatt steht, hängt als `hausblatt` an der Unterkunft und
erscheint im Kontextblatt: Anfahrt bis zum Schild an der Einfahrt, Betten,
Ausstattung, Check-in-Zeiten, die isländische Notfallnummer des Hauses und die
Handgriffe bei Ankunft und Abreise. Die langen Listen liegen als `<details>`
eingeklappt — sie werden genau zweimal gebraucht, beim Ankommen und beim Gehen.

**Ohne Codes.** Alarmcode, Torcode und WLAN-Passwort stehen nicht im
Datensatz. Diese App ist öffentlich erreichbar, das PDF des Vermieters nicht;
der Text sagt nur, dass es einen Code gibt und wo er steht. Ein Test in
`tests/daten.test.ts` hält das fest.

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

## Bilder

Ein Ort ist mehr als ein Blickwinkel: Goðafoss im Sommer, im Winter und aus der
Luft sagen zusammen etwas, das ein Foto nicht sagt. `pnpm bilder` sucht
deshalb **bis zu sechs** Bilder je Stopp und legt sie als `bilder` ab — das
erste ist das Leitbild für Vorschau-Blase und Tagesablauf, alle zusammen sind
der Streifen im Kontextblatt.

Vier Quellen, in der Reihenfolge ihrer Belegkraft:

1. **Das Leitbild des Wikipedia-Artikels**, den `pnpm wissen` bereits eindeutig
   zugeordnet hat. Damit gehören Text und Bild garantiert zum selben Objekt —
   der einzige Fall, in dem der Dateiname nichts beweisen muss.
2. **Weitere Bilder aus demselben Artikel** (`prop=images`).
3. **Die Commons-Kategorie** des Artikels, über Wikidata `P373` — der
   kuratierte Bilderordner zum Objekt und die ergiebigste der vier Quellen.
4. **Georeferenzierte Bilder auf Commons** im Umkreis von 1,5 km.

Für 2 bis 4 gilt dieselbe Schranke wie bisher: Der **Dateiname muss den Stopp
nennen**. Das ist nötig, weil alle drei Quellen Fremdes mitführen — im Artikel
Goðafoss steckt ein Bild der Kirche von Akureyri, in seiner Commons-Kategorie
liegen Fotos des Sees Ljósavatn. Ohne Namensbeleg bleibt der Stopp ohne Bild:
ein hübsches Foto vom Nachbartal ist schlechter als gar keins, weil es etwas
behauptet.

Zwei Filter halten den Streifen sauber:

- **Kein Bild ohne Foto-Charakter.** Die deutsche Wikipedia setzt bei
  Gemeinden gern eine Lagekarte oder ein Wappen an den Anfang, und jeder
  Artikel schleppt Symbole wie `Blue_pog.svg` mit. Ein Kartenausschnitt in
  einer Karten-App ist nutzlos. Ebenso raus: Dateien unter 800 px Breite und
  alles, was kein JPEG/PNG/TIFF ist (in den Kategorien liegen auch Videos).
- **Höchstens zwei Bilder je Urheber.** Wer einmal an der Blauen Lagune
  stand, hat dort zwanzig Aufnahmen gemacht und alle hochgeladen; sechs davon
  nebeneinander sind kein Streifen, sondern eine Wiederholung.

Zu jedem Bild kommt die **Bildbeschreibung** von Commons mit
(`iiextmetadatalanguage=de`, auf den ersten Satz gekürzt) — sie sagt, was auf
genau diesem Bild zu sehen ist. Nicht-lateinische Schriften bleiben draussen:
Eine hebräische Bildunterschrift hilft dieser Reisegruppe nicht.

Stand: **84 von 128 Stopps mit Bild, 410 Bilder, 78 Stopps zum
Durchblättern** — 141 aus dem Artikel, 192 aus der Commons-Kategorie, 77 über
die Geosuche. Die übrigen 44 Stopps stehen mit Begründung in
`data/bilder-offen.json`.

Urheber und Lizenz stehen an **jedem** Bild und wechseln mit ihm; bei CC-BY-SA
ist die Nennung Bedingung, nicht Höflichkeit. Die Dateien liegen auf
`upload.wikimedia.org` und werden von dort geladen statt ins Repo kopiert —
das wären mehrere hundert MB Fotos in der Versionsverwaltung. Der Host steht
dafür in der CSP, aber nur unter `img-src`.

Die Bildnachweise wiegen etwas: `reise.json` wächst dadurch von 190 auf
520 KB, der Datenteil des Bundles um rund 250 KB (gzip deutlich weniger).
Gegen die 1 MB von MapLibre ist das vertretbar, und geladen werden die Fotos
erst beim Wischen (`loading="lazy"` ab dem zweiten Bild).

## Hintergrundtexte

`pnpm wissen` holt zu jedem Stopp den Artikeltext aus der deutschen Wikipedia
(`prop=extracts&explaintext=1&exsectionformat=wiki`) und legt ihn als
`wissen: { text, abschnitte, quelle, url, geprueftAm }` in `reise.json` ab. Das
Kontextblatt zeigt ihn mit Quelle, Link und Prüfdatum.

**Nicht nur der erste Absatz.** Die Einleitung der deutschen Wikipedia ist oft
ein einziger Satz — „Der Goðafoss ist einer der bekanntesten Wasserfälle
Islands." —, und das, was man am Wasserfall stehend wissen will, steht darunter:
dass Þorgeir Ljósvetningagoði um das Jahr 1000 die heidnischen Götterbilder
hineingeworfen haben soll, daher der Name. Übernommen werden deshalb die
Einleitung **und die ersten bis zu drei Sachabschnitte**, zusammen höchstens
1600 Zeichen, jeder Abschnitt mit seiner Überschrift. Verzeichnisse
(`Weblinks`, `Literatur`, `Einzelnachweise`, `Siehe auch`, `Bilder`) bleiben
draussen, ebenso Verweiszeilen wie `→ Hauptartikel: …` — das ist Apparat, kein
Inhalt. Gekürzt wird an Satzgrenzen; ein Abschnitt, der nur noch angerissen
würde, bleibt ganz weg.

Stand: **58 der 69 Texte tragen Abschnitte**, im Mittel rund 1500 Zeichen
statt der 240 von vorher.

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
`tiles.openfreemap.org` für die Karte und `upload.wikimedia.org` für die
Bilder; alles andere bleibt zu.

## Nicht enthalten

Zeichnen/Editieren, Kamera-Tour, Offline-Betrieb, Wetter- und
Straßenzustandsfeeds (vedur.is, road.is), Fotos pro Stopp, 3D-Gelände.

Warum die drei zuletzt entfernten Dinge nicht wiederkommen sollten — Terrain,
3D-Modelle und das LLM — steht mit Begründung in
[`REQUIREMENTS.md`](./REQUIREMENTS.md).
