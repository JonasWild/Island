# Datenstand und offene Punkte

Stand: 01.09.2026. Grundlage: `data/reise.json`, geprüft mit `pnpm geocode`
gegen OpenStreetMap (Nominatim primär, Overpass als Rückfall) und ergänzt um
Web-Recherche für die Fälle, die OSM nicht beantwortet.

**Die Hausblätter des Vermieters — seit dem 01.09.2026 vollständig.** Für
Þrasastaðir (N3018), Hlíðarendi (O402), Hlíðarholt (S503) und nun auch
Birkiskógar (W276) liegen die Hausinformationen von Viator Summerhouses vor.
Sie beantworten die offenen Fragen dieser Datei — und zwar besser als jede
Recherche, weil der Vermieter weiß, wo sein Haus steht: Jedes Blatt trägt
einen Kartenlink auf die Parzelle. Alle vier Ferienhäuser sind damit
**punktgenau** verortet (`quelle: 'anbieter'`), und was sonst auf dem Blatt
steht — Anfahrt, Betten, Ausstattung, die Handgriffe bei Ankunft und Abreise —
steht als `hausblatt` am Haus und im Kontextblatt der App.

Codes stehen dort **nicht**: Alarmcode, Torcode und WLAN-Passwort bleiben in
den PDFs. Die App ist öffentlich erreichbar, das Hausblatt nicht. Der Text
sagt jeweils, dass es einen Code gibt und wo er steht.

Diese Datei ist der Ort für Fragen an den Reiseplan. Die App selbst zeigt
keinen Fließtext — was hier steht, steht dort als Hinweis am jeweiligen Stopp.

---

## 1. Þrasastaðir — geklärt: am Ljósavatn, 65.705667 / −17.703667

**Frage war:** Der Übernachtungsplan nennt Akureyri, der Reiseplan behandelt die
Station als Basis im Mývatngebiet. Die Tagesausflüge (Diamond Circle 207 km,
Siglufjörður 150 km je Strecke) sind ab Mývatn gerechnet.

**Befund:** Keine der beiden Angaben stimmt. Das Hausblatt des Vermieters
verortet das Haus punktgenau im **Ljósavatnsskarð**, kurz vor dem See
Ljósavatn: 6 km bis Goðafoss, 43 km bis Akureyri, 50 km bis Mývatn. Die
Anbieterseite hatte das schon nahegelegt, das Blatt macht es zur Koordinate —
die frühere Bereichsangabe lag 2,8 km weiter östlich.

Die Anfahrt ist damit auch beschrieben: Ringstraße 1 hinter Akureyri Richtung
Egilsstaðir, nach dem Tunnel über die Fnjóská-Brücke, rund 10 km weiter am
Hotel Stórutjarnir vorbei, nach 1,3 km rechts am Schild „Arnarstapi" — zweites
Haus links, Steinfigur an der Einfahrt. Das steht in der App am Haus.

Quellen: Viator Summerhouses, Hausinformation „Þrasastaðir (N3018)", Rev. 10 ·
<https://www.viatis.is/en/accommodation/northeast-iceland/thrasastadir/>

**Folge für die Planung — unverändert offen:** Die Kilometerangaben der beiden
Tagesausflüge stimmen nicht. Ab Ljósavatn statt ab Mývatn:

| Ausflug | laut Reiseplan (ab Mývatn) | ab Ljósavatn, je Strecke (Valhalla) |
|---|---|---|
| Mývatn-Umrundung (31.08.) | Standtag vor der Tür | 57 km Anfahrt — aus dem Standtag wird ein Tagesausflug |
| Diamond Circle (01.09.) | 207 km Rundfahrt | Húsavík 51 km, Dettifoss 126 km — die Runde beginnt 57 km weiter westlich und wird dadurch länger |
| Siglufjörður (02.09.) | 150 km je Strecke | 104 km — rund 45 km kürzer, weil Akureyri näher liegt |

Dafür liegen Goðafoss (9 km) und Akureyri (27 km durch den Tunnel
Vaðlaheiðargöng) fast vor der Tür. Das Hausblatt rechnet Akureyri mit 43 km —
das ist die Strecke ohne Maut über den Pass Víkurskarð; nachgerechnet sind es
43,0 km. Der Tunnel spart 16 km und kostet Gebühr.

Der 31.08. ist der Tag, der sich dadurch am stärksten ändert. Vor der Reise mit
Katla klären, ob die Etappenlogik des PDFs auf einer anderen Unterkunft beruht.

**Achtung Namensdopplung:** In OSM gibt es einen Hof *Þrasastaðir* in
Fljót/Skagafjörður (65.937, −18.926) und ein Gästehaus gleichen Namens bei
Arnarstapi. Beides sind andere Objekte.

## 2. Hafnarhólmi am 04.09. — bestätigt: keine Papageitaucher mehr

Die Kolonie am Hafnarhólmi brütet von Mitte April bis Anfang August; die Vögel
sind bis Mitte August weg. Am 04.09.2026 ist die Saison sicher vorbei.

Der Stopp bleibt trotzdem sinnvoll: Bakkagerði, der Fjord und die
Rhyolithberge der Straße 94 tragen den Tag auch ohne Vögel. Der Hinweis steht
am Stopp.

Quellen: <https://www.borgarfjordureystri.is/en/puffins> ·
<https://www.east.is/en/place/hafnarholmi>

## 3. Hlíðarendi — 5 Plätze für 5 Reisende, Haus Nr. 20 hinter einer Schranke

Unverändert: Das Ferienhaus ist für 5 Personen ausgelegt, die Reisegruppe hat
5 Personen, die Zimmerbelegung nennt 1 Appartement. Das ist Vollbelegung ohne
Reserve — und die einzige Station der Reise, an der ein Zusatzbett nicht
möglich ist (die anderen Häuser sind für 6 bzw. 8 Personen). Das Hausblatt
bestätigt die Zahl und nennt die Betten: 64 m², Doppelbett 160, zwei
Etagenbetten (2 × 80), ein Einzelbett 120.

Das ist keine Frage, die sich recherchieren lässt: Sie gehört vor Reisebeginn
an Katla Travel, mit der Buchungsnummer 55009.

**Neu geklärt ist die Lage:** 65.169650 / −14.497833 — Haus Nr. 20 in der
Ferienhaussiedlung **Úlfstaðaskógur** an der Straße 95 Richtung Hallormsstaður,
11 km südlich von Egilsstaðir. Die bisherige Bereichsangabe lag auf Egilsstaðir
selbst, also 11,7 km daneben; der Tagesausflug am 04.09. wächst dadurch von
154 auf 178 km.

**Praktisch wichtig:** Die Zufahrt zur Siedlung hat eine **Schranke mit
PIN-Code**. Den Code schickt Viator vor der Anreise — er steht nicht in dieser
App. Wer ihn nicht dabeihat, steht abends vor einem geschlossenen Tor.

Quelle: Viator Summerhouses, Hausinformation „Hlíðarendi (O402)", Rev. 10

## 4. Hlíðarholt — geklärt: bei Reykholt, nicht bei Flúðir

Der Reiseplan führt die letzte Ferienhausstation durchgehend als „Flúðir": im
Etappentitel des 06.09., in den Tagesausflügen am 07. und 08.09. und in der
Abfahrt am 09.09. Das Hausblatt nennt eine andere Gemeinde — **Bláskógabyggð**,
Adresse **Hlíðarholt 12** im Ferienhausgebiet Holtahverfi, rund 1,5 km hinter
Reykholt. OSM bestätigt den Punkt: Die Koordinate 64.179650 / −20.422917 liegt
auf der Straße *Hlíðarholt* in 846 Reykholt.

Zwischen der bisherigen Annahme und dem Haus liegen 7,3 km. Für den Goldenen
Kreis ist das günstig: Ab dem Haus sind es 19 km bis Geysir, 30 km bis Gullfoss
und 58 km bis Þingvellir — ab Flúðir wären es 27, 34 und 68 km. Die Kilometer
der drei Tage im Reiseplan sind trotzdem ab Flúðir gerechnet; die gerouteten
Werte in `route.json` sind nachgezogen.

Die Anfahrt ist die heikelste der Reise: 1,5 km hinter Reykholt nach der
Tankstelle rechts Richtung „Holtahverfi", **sehr kleines Schild**, dann noch
zweimal abbiegen. Sie steht vollständig in der App am Haus.

**Codes:** Das Haus hat eine Alarmanlage, die direkt nach dem Aufschließen
bedient werden will, und ein WLAN mit Passwort. Beides steht im PDF von Viator
und bewusst nicht in dieser App.

Quelle: Viator Summerhouses, Hausinformation „Hlíðarholt (S503)", Rev. 25

## 5. Earth Lagoon Mývatn am 31.08. — geklärt: geöffnet

Die früheren Mývatn Nature Baths (Jarðböðin) wurden abgerissen und neu gebaut.
Die Wiedereröffnung unter dem Namen **Earth Lagoon Mývatn** war für Frühjahr
2026 angekündigt und ist am **9. Juli 2026** erfolgt — also gut sieben Wochen
vor dem Reisetermin. Die neue Anlage hat eine größere Lagune (36–40 °C), zwei
zusätzliche Hot Pots und eine Dampfhöhle. Eintritt ab ca. 7.900 ISK.

Öffnungszeiten trotzdem kurz vor der Reise prüfen — neue Betriebe ändern in der
ersten Saison häufig die Zeiten.

Quellen: <https://www.earthlagoon.is/> ·
<https://www.icelandreview.com/news/myvatn-nature-baths-to-reopen-as-earth-lagoon-in-2026/>

## 6. Grindavík / Fagradalsfjall am 09.09. — bleibt tagesaktuell

Der letzte Ausbruch an der Sundhnúkur-Kraterreihe endete am 5. August 2025.
Seit März 2026 gibt es keine Eruption im Gebiet, die Hebung bei Svartsengi
hält aber an — das System ist weiter aktiv.

Was sich daraus für den 09.09. ableiten lässt:

- Ringstraße, Keflavík und die Straße 41 sind durchgehend offen. Der
  Reisetag als solcher ist nicht gefährdet.
- Die jüngste Ausbruchszone bei Grindavík ist gesperrt. Der Ort selbst ist
  seit Oktober 2024 unter Auflagen zugänglich, kann aber jederzeit wieder
  geräumt werden.
- Die Wanderwege am Fagradalsfjall wechseln mit jeder Eruption ihren
  Ausgangspunkt; Parkplätze und Gassprognose ändern sich täglich.

Das ist keine Information, die sich im Datensatz festschreiben lässt. Beide
Stopps tragen deshalb den Hinweis, die Lage am Reisetag auf
<https://safetravel.is> zu prüfen. Alternative für denselben Tag ohne
Vulkanrisiko: Krýsuvík/Seltún und Kleifarvatn, beide bereits im Plan.

## 7. Flugzeiten fehlen weiterhin

In keinem der beiden PDFs stehen Flugnummern oder Zeiten. Ohne sie lassen sich
zwei Dinge nicht beurteilen:

- **27.08.** — ob 130 km Keflavík → Borgarfjörður plus Blaue Lagune am
  Ankunftstag realistisch sind. Die Blaue Lagune liegt 20 Minuten vom
  Flughafen; wer nach 16 Uhr landet, sollte sie auf den 09.09. legen, wo sie
  ohnehin im Plan steht.
- **10.09.** — wie viel Puffer zwischen Konvin Hotel, Volltanken,
  Mietwagenrückgabe und Check-in bleibt. Katla empfiehlt 2–3 Stunden vor
  Abflug am Schalter.

Auch das ist eine Frage an den Veranstalter, keine an OSM.

## 8. Birkiskógar — geklärt: bei Munaðarnes, 64.703683 / −21.655453

Das erste Haus der Reise war das letzte ohne Hausblatt und damit die letzte
Bereichsangabe unter den Unterkünften. Das Blatt (W276, Rev. 19) nennt die
Adresse, die viatis.is schuldig blieb: **Birkiskógar 17**, das erste Haus
rechts in der Ferienhaussiedlung bei **Munaðarnes** — nicht bei Bifröst, wo
die Näherung lag.

Zwischen alter und neuer Position liegen **8,8 km nach Südwesten**. Das Blatt
bestätigt den Punkt mit seiner eigenen Entfernungsangabe: Es rechnet 22 km bis
Borgarnes, und die neue Koordinate liegt 22,3 km Luftlinie davon entfernt. Von
der alten wären es 31,1 km gewesen — die Angabe des Vermieters passte also zur
Näherung gar nicht.

Die vier Tage, die an diesem Haus hängen, sind in `route.json` nachgezogen —
und nur diese vier; die übrigen elf sind unverändert:

| Tag | vorher | nachher |
|---|---|---|
| 27.08. Anreise | 183,4 km · 3 h 1 min | 176,1 km · 2 h 56 min |
| 28.08. Borgarfjörður | 216,9 km · 3 h 47 min | 202,3 km · 3 h 38 min |
| 29.08. Snæfellsnes | 410,2 km · 8 h 11 min | 407,5 km · 8 h 9 min |
| 30.08. nach Mývatn | 353,4 km · 4 h 37 min | 362,0 km · 4 h 44 min |

Die Anfahrt hat eine Stelle, an der man den Kilometerzähler braucht: Ab dem
Kiosk Baula sind es genau 3,7 km bis zum kleinen blauen Schild „Stapasel,
Múlakot, Jafnaskrað und Hreðavatn". Sie steht vollständig in der App am Haus.

**Keine Codes auf diesem Blatt** — anders als bei Hlíðarholt und Hlíðarendi
verlangt Birkiskógar weder Alarmcode noch Torcode. Es hat dafür zwei Regeln,
die im Haus hängen: Das Tor zur Siedlung ist immer zu schließen, sonst kommen
die Schafe aufs Gelände, und die Sicherungsanlage im Flur darf nie
ausgesteckt werden — über sie schaltet der Eigentümer den Strom aus der Ferne
ein. Auch der Hot Pot ist Arbeit: Er wird bei der Abreise geleert, geschrubbt
und wieder verschlossen, dann füllt er sich in rund 5 Stunden selbst.

Quelle: Viator Summerhouses, Hausinformation „Birkiskógar (W276)", Rev. 19

---

## Positionen: was die Pipeline geändert hat

Die 18 als Näherung markierten Stopps und die 9 näherungsweise verorteten
Unterkünfte sind ersetzt oder als Bereich belegt. Die auffälligsten
Korrekturen:

| Stopp | vorher | nachher | Verschiebung |
|---|---|---|---|
| Hot Pot Krosslaug | *keine Position* | 64.50486 / −21.20468 | der letzte offene Stopp, jetzt belegt |
| Fosshótel Núpar | 63.795 / −17.955 | 63.9237 / −17.7062 | ~30 km — die Näherung lag bei Kirkjubæjarklaustur statt bei Núpar |
| Gletschertunnel Langjökull | 64.7333 / −20.4667 | 64.62813 / −20.48855 | ~12 km — jetzt der Eisgang-Eingang statt der Gletschermitte |
| Eiðakirkja | 65.3833 / −14.4667 | 65.37506 / −14.35059 | ~12 km — die Näherung lag im freien Feld westlich der Straße 94 |
| Hof Ölkelda | 64.8547 / −23.1489 | 64.83661 / −22.97675 | ~8 km — die Mineralquelle liegt an der 54, nicht an der 571 |
| Tunnel Vaðlaheiðargöng | 65.6772 / −18.0181 | 65.71115 / −17.98593 | der Tunnel statt des Büros in Akureyri |
| Saltvík Reiterhof | 65.9975 / −17.34 | 66.00094 / −17.36455 | der Hof statt der Bucht |

Dazu die vier Häuser, die aus dem Hausblatt des Vermieters punktgenau wurden:

| Unterkunft | vorher (Bereich) | nachher (Hausblatt) | Verschiebung |
|---|---|---|---|
| Hlíðarendi | 65.2667 / −14.4 | 65.16965 / −14.497833 | ~12 km — die Näherung lag auf Egilsstaðir statt in Úlfstaðaskógur |
| Birkiskógar | 64.7686 / −21.5486 | 64.703683 / −21.655453 | ~9 km — die Parzelle bei Munaðarnes statt der Gegend um Bifröst/Hreðavatn |
| Hlíðarholt | 64.1333 / −20.3167 | 64.17965 / −20.422917 | ~7 km — Reykholt/Bláskógabyggð statt Flúðir |
| Þrasastaðir | 65.6963 / −17.6459 | 65.705667 / −17.703667 | ~3 km — die Parzelle am Ljósavatn statt des Seeufers |

**Hot Pot Krosslaug** war der eine Stopp ohne Position. OSM führt ihn als
`natural=hot_spring` in Lundarreykjadalur an der Straße 52, mit einem
Denkmal-Node daneben — historisches Taufbecken von 1000 n. Chr., Parkplatz mit
50 m Fußweg, über 40 °C, Platz für 3–4 Personen. Damit sind 128 von 128 Stopps
verortet.

### Was vor der Abreise zu buchen ist

Der Reiseplan nennt an 19 Stopps etwas Buchbares. Sie tragen `buchen: true`,
und wo der Plan eine Frist nennt, steht sie wörtlich in `buchenText`. Die App
zeigt beides: als bernsteinfarbenes Abzeichen am Kartensymbol (spiegelbildlich
zum Stiefel der Wanderungen), als Pille im Tagesablauf und als Block im
Kontextblatt. Vorher standen die beiden Felder zwar im Schema und gepflegt in
`reise.json` — gezeigt wurden sie nirgends. Eine Frist, die niemand sieht, ist
keine.

Vier Ziele drängen im Plan ausdrücklich auf eine Buchung **vor Reisebeginn**:
Blaue Lagune (an beiden Tagen), Bootsfahrt Jökulsárlón („ist notwendig"),
Vatnshellir und Krauma. Der Tunnel Vaðlaheiðargöng trägt dasselbe Flag aus
demselben Grund: Die Maut will im Fenster ±3 Stunden um die Durchfahrt
registriert sein, sonst rechnet die Autovermietung ab.

An den übrigen Stopps nennt der Plan ein Angebot mit Anbieter, aber keine
Frist — Láki Tours, North Sailing, Arctic Sea Tours, Whale Watching Hauganes,
Dive.is, die Reiterhöfe Saltvík und Eldhestar, die geführten Höhlen und
Gletschertouren. Dort sagt der Satz genau das: buchbar, Frist unbekannt. Eine
geratene Frist wäre schlimmer als gar keine — nach ihr würde jemand planen.

**Nicht** geflaggt sind Bäder, zu denen der Plan keinen Buchungshinweis gibt
(GeoSea, Vök Baths, Bjórböðin, Secret Lagoon, Laugarás Lagoon, Earth Lagoon).
Dorthin geht man; die Grenze verläuft am Wortlaut des Plans, nicht am Gefühl.

### Was bewusst „Bereich" bleibt

Drei Kategorien lassen sich nicht punktgenau belegen, und die Pipeline tut
auch nicht so. **Ferienhäuser ohne Hausblatt** standen bis zum 31.08.2026 als
vierte hier — viatis.is nennt keine Adresse, es blieb bei der Siedlung. Seit
Birkiskógar (W276) am 01.09.2026 dazukam, liegt für alle vier Häuser das
Blatt des Vermieters mit Kartenziel vor; die Kategorie ist leer. Die Regel
gilt weiter, falls je ein Haus ohne Blatt dazukommt, und ein Test hält sie
fest. Diese vier Positionen rührt `pnpm geocode` auch mit `--all` nicht mehr
an: Ein Ortsmittelpunkt aus OSM wäre schlechter als die Angabe dessen, dem das
Haus gehört.
1. **Landschaftsräume** (Halbinsel Reykjanes, Mýrar, Skagafjörður /
   Öxnadalsheiði, Jökulsárgljúfur, Lagarfljót, Eldhraun) — ein Punkt ist hier
   nur ein Schwerpunkt.
2. **Streckenabschnitte** der Straße 94 am 04.09. (Ebene des Hérað,
   Héraðsflói, Passhöhe, grüne Talrinne) — das sind Beschreibungen einer
   Fahrt, keine Ziele.
3. **Sammeleinträge** wie „Küstenroute Stokkseyri, Eyrarbakki, Þorlákshöfn"
   oder die „Lighthouse Route" — die Einzelziele haben eigene Stopps.

Sie stehen im Datensatz als `genauigkeit: 'bereich'` und sind damit von den
punktgenauen Positionen unterscheidbar.

### Zahlen

| | |
|---|---|
| Stopps gesamt | 128 |
| davon punktgenau (`osm`) | 89 |
| davon Bereichsangabe | 39 |
| ohne Position | 0 |
| in `offen.json` zur Klärung | 22 |
| Unterkünfte punktgenau | 6 von 6 (beide Hotels aus OSM, alle vier Ferienhäuser aus dem Hausblatt) |
| Unterkünfte mit Hausblatt | 4 von 6 (die zwei Hotels haben keines) |

Vorher: 127 kuratiert, 1 ohne Position, 27 Näherungen ohne Beleg. Jetzt trägt
jede der 128 Positionen ein `posMeta` mit Quelle und Prüfdatum. Die 22 Einträge
in `offen.json` sind nicht positionslos — sie behalten die Position aus dem
Reiseplan, aber mit `quelle: 'reiseplan'` und `genauigkeit: 'bereich'`, weil OSM
sie nicht bestätigt hat. Der Unterschied ist im Kontextblatt sichtbar.

### Was in `offen.json` steht

`data/offen.json` listet, was die Pipeline **nicht** eindeutig auflösen
konnte — mit den gefundenen Kandidaten und dem Grund. Typischer Fall: In Island
heißen See, Hof, Ort und Kirche oft gleich, und OSM führt sie als getrennte
Objekte. Solange keiner der Kandidaten die kuratierte Position auf 3 km
bestätigt, wird nichts übernommen.

Das ist kein Mangel, sondern das Ergebnis: Der Datensatz sagt lieber „unklar"
als eine erfundene Koordinate.
