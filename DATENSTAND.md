# Datenstand und offene Punkte

Stand: 13.08.2026. Grundlage: `data/reise.json`, geprüft mit `pnpm geocode`
gegen OpenStreetMap (Nominatim primär, Overpass als Rückfall) und ergänzt um
Web-Recherche für die Fälle, die OSM nicht beantwortet.

Diese Datei ist der Ort für Fragen an den Reiseplan. Die App selbst zeigt
keinen Fließtext — was hier steht, steht dort als Hinweis am jeweiligen Stopp.

---

## 1. Þrasastaðir — geklärt: weder Akureyri noch Mývatn

**Frage:** Der Übernachtungsplan nennt Akureyri, der Reiseplan behandelt die
Station als Basis im Mývatngebiet. Die Tagesausflüge (Diamond Circle 207 km,
Siglufjörður 150 km je Strecke) sind ab Mývatn gerechnet.

**Befund:** Die Anbieterseite verortet das Haus eindeutig — direkt am See
**Ljósavatn** im Ljósavatnsskarð, ca. 25 km östlich von Akureyri, 8 km von
Goðafoss. Damit ist keine der beiden Angaben aus den PDFs richtig; die Basis
liegt zwischen Akureyri und Mývatn.

Quelle: <https://www.viatis.is/en/accommodation/northeast-iceland/thrasastadir/>

**Folge für die Planung:** Die Kilometerangaben der beiden Tagesausflüge
stimmen nicht mehr. Ab Ljósavatn statt ab Mývatn:

| Ausflug | laut Reiseplan (ab Mývatn) | ab Ljósavatn |
|---|---|---|
| Diamond Circle | 207 km Rundfahrt | ähnlich lang, aber andere Reihenfolge — Húsavík liegt näher, Dettifoss weiter |
| Siglufjörður | 150 km je Strecke | rund 40 km kürzer je Strecke, weil Akureyri näher liegt |
| Mývatn-Umrundung (31.08.) | Standtag vor der Tür | rund 50 km Anfahrt je Strecke — aus dem Standtag wird ein Tagesausflug |

Der 31.08. ist der Tag, der sich dadurch am stärksten ändert. Vor der Reise mit
Katla klären, ob die Etappenlogik des PDFs auf einer anderen Unterkunft beruht.

**Achtung Namensdopplung:** In OSM gibt es einen Hof *Þrasastaðir* in
Fljót/Skagafjörður (65.937, −18.926) und ein Gästehaus gleichen Namens bei
Arnarstapi. Beides sind andere Objekte. Die Position im Datensatz ist deshalb
`quelle: 'anbieter'`, `genauigkeit: 'bereich'` — Südufer Ljósavatn, die genaue
Parzelle ist nicht öffentlich.

## 2. Hafnarhólmi am 04.09. — bestätigt: keine Papageitaucher mehr

Die Kolonie am Hafnarhólmi brütet von Mitte April bis Anfang August; die Vögel
sind bis Mitte August weg. Am 04.09.2026 ist die Saison sicher vorbei.

Der Stopp bleibt trotzdem sinnvoll: Bakkagerði, der Fjord und die
Rhyolithberge der Straße 94 tragen den Tag auch ohne Vögel. Der Hinweis steht
am Stopp.

Quellen: <https://www.borgarfjordureystri.is/en/puffins> ·
<https://www.east.is/en/place/hafnarholmi>

## 3. Hlíðarendi — 5 Plätze für 5 Reisende

Unverändert: Das Ferienhaus ist für 5 Personen ausgelegt, die Reisegruppe hat
5 Personen, die Zimmerbelegung nennt 1 Appartement. Das ist Vollbelegung ohne
Reserve — und die einzige Station der Reise, an der ein Zusatzbett nicht
möglich ist (die anderen Häuser sind für 6 bzw. 8 Personen).

Das ist keine Frage, die sich recherchieren lässt: Sie gehört vor Reisebeginn
an Katla Travel, mit der Buchungsnummer 55009.

## 4. Earth Lagoon Mývatn am 31.08. — geklärt: geöffnet

Die früheren Mývatn Nature Baths (Jarðböðin) wurden abgerissen und neu gebaut.
Die Wiedereröffnung unter dem Namen **Earth Lagoon Mývatn** war für Frühjahr
2026 angekündigt und ist am **9. Juli 2026** erfolgt — also gut sieben Wochen
vor dem Reisetermin. Die neue Anlage hat eine größere Lagune (36–40 °C), zwei
zusätzliche Hot Pots und eine Dampfhöhle. Eintritt ab ca. 7.900 ISK.

Öffnungszeiten trotzdem kurz vor der Reise prüfen — neue Betriebe ändern in der
ersten Saison häufig die Zeiten.

Quellen: <https://www.earthlagoon.is/> ·
<https://www.icelandreview.com/news/myvatn-nature-baths-to-reopen-as-earth-lagoon-in-2026/>

## 5. Grindavík / Fagradalsfjall am 09.09. — bleibt tagesaktuell

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

## 6. Flugzeiten fehlen weiterhin

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

**Hot Pot Krosslaug** war der eine Stopp ohne Position. OSM führt ihn als
`natural=hot_spring` in Lundarreykjadalur an der Straße 52, mit einem
Denkmal-Node daneben — historisches Taufbecken von 1000 n. Chr., Parkplatz mit
50 m Fußweg, über 40 °C, Platz für 3–4 Personen. Damit sind 128 von 128 Stopps
verortet.

### Was bewusst „Bereich" bleibt

Vier Kategorien lassen sich nicht punktgenau belegen, und die Pipeline tut
auch nicht so:

1. **Ferienhäuser** (Birkiskógar, Þrasastaðir, Hlíðarendi, Hlíðarholt) —
   viatis.is nennt keine Adresse. Bereichsangabe mit Verweis auf die
   Anbieterseite.
2. **Landschaftsräume** (Halbinsel Reykjanes, Mýrar, Skagafjörður /
   Öxnadalsheiði, Jökulsárgljúfur, Lagarfljót, Eldhraun) — ein Punkt ist hier
   nur ein Schwerpunkt.
3. **Streckenabschnitte** der Straße 94 am 04.09. (Ebene des Hérað,
   Héraðsflói, Passhöhe, grüne Talrinne) — das sind Beschreibungen einer
   Fahrt, keine Ziele.
4. **Sammeleinträge** wie „Küstenroute Stokkseyri, Eyrarbakki, Þorlákshöfn"
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
| Unterkünfte punktgenau | 2 von 6 (die beiden Hotels) |

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
