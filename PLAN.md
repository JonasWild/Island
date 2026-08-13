# Plan: Reiseplan „Rund um die Insel" als Website

Minimaler, aber vollständiger Umsetzungsplan, um den Katla-Travel-Reiseplan
(Vorgang 15412, 27.08.–10.09.2026) und den Übernachtungsplan als Website
darzustellen.

---

## 1. Ziel und Nutzungssituation

Die beiden PDFs enthalten alles, sind aber im Urlaub unbrauchbar: 25 Seiten
Fließtext, Tagesinfos und Unterkunftsdaten in getrennten Dateien, Querlesen am
Handy nicht möglich.

Die Website muss genau drei Dinge besser können:

1. **„Was ist heute?"** – ein Tag, eine Karte: Etappe, Kilometer, Fahrzeit,
   Unterkunft, Highlights.
2. **„Wo schlafen wir und wie heißt die Buchungsnummer?"** – Unterkünfte als
   eigene, sofort erreichbare Liste mit Telefon und Link.
3. **„Was muss vorab gebucht werden?"** – die im Reiseplan verstreuten
   Vorausbuchungs-Hinweise an einer Stelle.

Nutzung: 5 Personen, überwiegend Smartphone, im Mietwagen, teils ohne Netz
(isländisches Hochland/Ostfjorde). Daraus folgt: **offline-fähig, eine Seite,
kein Login, kein Server.**

## 2. Prinzipien (das macht den Plan „minimal")

| Entscheidung | Begründung |
|---|---|
| Eine JSON-Datei als einzige Wahrheit (`data/reise.json`) | Inhalt vom Layout getrennt; Korrekturen ohne Code-Änderung |
| Eine statische Seite, kein Framework, kein Build-Step | Kein `npm install`, kein Deploy-Pipeline-Risiko, in 5 Jahren noch lauffähig |
| Vanilla JS + CSS (ca. 300 Zeilen) | Reicht für Timeline, Filter, Detail-Aufklappen |
| GitHub Pages als Hosting | Repo ist schon da, Push = Deploy, kostenlos |
| Karte erst in v2 | Eine Karte kostet mehr Aufwand als der ganze Rest und ersetzt kein Navi |

## 3. Informationsarchitektur

Eine Seite, vier Ansichten über eine Tab-Leiste – keine Unterseiten, keine
Navigation, kein Router.

```
┌─ Kopf ──────────────────────────────────────────────┐
│ Rund um die Insel · 27.08.–10.09.2026 · 15 Tage     │
│ 5 Reisende · Ford Transit 9-Sitzer · ca. 2.450 km   │
├─ Tabs ──────────────────────────────────────────────┤
│ [ Tage ] [ Unterkünfte ] [ Vorab buchen ] [ Infos ] │
└─────────────────────────────────────────────────────┘

Ansicht „Tage" = vertikale Timeline, 15 Tageskarten:

  Do 27.08.  Willkommen in Island                    ▸
  ────────────────────────────────────────────────────
  🚗 Keflavík → Borgarfjörður · 130 km · ca. 2 Std
  🏠 Birkiskógar (Nacht 1 von 3)
  ▸ aufgeklappt: Highlights mit Gehzeit/Distanz + Links

  Fr 28.08.  Aufenthalt Borgarfjörður                ▸
  ...
```

Regeln für die Tageskarte:

- **Zugeklappt** nur, was man beim Frühstück wissen muss: Datum, Titel, Etappe
  (km + Fahrzeit) oder Kennzeichnung „Standtag", Unterkunft.
- **Aufgeklappt** die Highlights als Liste. Jedes Highlight: Name, Straße/Nr.,
  ein Satz, ggf. `Gehzeit · Distanz · Höhenmeter`, ggf. Link.
- **Farbcode** für den Tagestyp: Etappentag (Fahrt), Standtag, Tagesausflug,
  An-/Abreise. Drei der 15 Tage sind im PDF ausdrücklich als „kann sehr lang
  werden" markiert (30.08., 05.09., Snæfellsnes am 29.08.) – die bekommen einen
  Warnhinweis.
- Der aktuelle Tag wird beim Laden hervorgehoben und angesprungen
  (`new Date()` gegen `date` im JSON) – die einzige „Logik" der Seite.

Ansicht **Unterkünfte**: 6 Karten, chronologisch, je mit Zeitraum, Nächten,
Ort, Zimmer-/Haustyp, Buchungsnummer, Telefon (als `tel:`-Link), Website,
Verpflegung.

Ansicht **Vorab buchen**: eine einzige Liste der Dinge, die laut PDF vor
Reisebeginn erledigt sein müssen – Jökulsárlón-Bootsfahrt (zwingend), Blaue
Lagune, Krauma, Langjökull-Gletschertunnel, Víðgelmir, Vatnshellir,
Walbeobachtung, Silfra. Plus die Tunnel-Registrierung Vaðlaheiðargöng, die nur
im Zeitfenster ±3 Std. um die Durchfahrt möglich ist.

Ansicht **Infos**: Mietwagen (Hertz, Kat. Q, Übernahme/Rückgabe, volltanken),
Check-in ab 15:00 / Anruf nach 19:00, Bettwäschepaket-Inhalt, Notfallnummern,
Reiseteilnehmer.

## 4. Datenmodell

Eine Datei, zwei Listen. `data/reise.json` liegt bereits vollständig aus den
PDFs befüllt im Repo – damit ist die Inhaltsarbeit erledigt und die Umsetzung
reines Rendering.

```jsonc
{
  "reise": { "titel", "vorgang", "von", "bis", "veranstalter",
             "teilnehmer": [...], "mietwagen": {...} },

  "unterkuenfte": [{
    "id", "name", "ort", "region", "von", "bis", "naechte",
    "typ", "buchungsnummer", "telefon", "website",
    "verpflegung", "beschreibung", "hinweis"
  }],

  "tage": [{
    "datum": "2026-08-27",
    "wochentag": "Do",
    "titel": "Willkommen in Island",
    "typ": "anreise | etappe | standtag | tagesausflug | abreise",
    "unterkunft": "birkiskogar",        // Referenz, keine Duplizierung
    "etappe": { "von", "nach", "km", "fahrzeit", "hinweis" },
    "lang": true,                        // → Warnhinweis „Tag kann lang werden"
    "highlights": [{
      "name", "strasse", "text",
      "wanderung": { "gehzeit", "distanz", "hoehenmeter" },
      "link", "buchen": true
    }]
  }]
}
```

Der Rendering-Code braucht dadurch nur drei Funktionen:
`renderTage()`, `renderUnterkuenfte()`, `renderBuchungen()` – letztere filtert
schlicht alle Highlights mit `buchen: true`.

## 5. Dateien

```
index.html          Grundgerüst + Tabs (ca. 60 Zeilen)
app.js              JSON laden, drei Render-Funktionen, Tab-Umschaltung
style.css           Timeline, Karten, Farbcode, mobile-first
data/reise.json     ✅ fertig, aus beiden PDFs extrahiert
```

Vier Dateien, kein `package.json`. Offline funktioniert es, weil die Seite nach
dem ersten Laden nichts mehr vom Netz braucht; für echte Offline-Garantie in v2
ein 20-zeiliger Service Worker.

## 6. Umsetzung

| Schritt | Inhalt | Aufwand |
|---|---|---|
| 1 | `data/reise.json` aus den PDFs (15 Tage, 6 Unterkünfte, 14 Vorab-Buchungen, ca. 2.450 km) | ✅ erledigt |
| 2 | `index.html` + `style.css` + `app.js`, Ansicht „Tage" | ~1,5 Std |
| 3 | Ansichten Unterkünfte / Vorab buchen / Infos | ~1 Std |
| 4 | GitHub Pages aktivieren (Branch, Ordner `/`) | 5 Min |

**v2, nur falls gewünscht:** Leaflet-Karte mit Etappen und Highlight-Pins,
Service Worker für garantiertes Offline, Wetter-Link pro Region,
Checkbox „gesehen" mit `localStorage`.

## 7. Nicht-Ziele

Kein CMS, keine Datenbank, kein Login, keine Buchungs-Integration, keine
Mehrsprachigkeit, keine Bilder-Galerie (Bilddaten liegen nicht vor), keine
Navi-Funktion – dafür ist Google Maps zuständig.

## 8. Offene Punkte

Diese Widersprüche stehen so in den PDFs und sollten vor Reisebeginn bei Katla
Travel geklärt werden; in der Website sind sie als Hinweis markiert, nicht
stillschweigend korrigiert:

1. **Þrasastaðir liegt laut Übernachtungsplan in „Akureyri"**, der Reiseplan
   beschreibt die Station dagegen als Basis im Mývatn-Gebiet („Fahrt von
   Borgarfjörður nach Mývatngebiet"). Die Tagesausflüge sind ab Mývatn
   gerechnet (Diamond Circle 207 km, Siglufjörður 150 km je Strecke) – ab
   Akureyri oder ab Fljót ergeben sich deutlich andere Fahrzeiten.
2. **Hafnarhólmi (Papageitaucher, 04.09.)** – Saison laut PDF Mai bis Anfang
   August, im September also ohne Vögel.
3. **Hlíðarendi ist für 5 Personen ausgelegt** und wird als „1 Appartement"
   belegt – bei 5 Reisenden knapp; alle anderen Häuser haben 6 oder 8 Plätze.
4. **Earth Lagoon Mývatn (31.08.)** – „Wiedereröffnung Sommer 2026", vor der
   Fahrt prüfen.
5. **Grindavík / Reykjanes (09.09.)** – Zugang abhängig von der Vulkanlage,
   tagesaktuell prüfen.
6. **Flugdaten fehlen** in beiden Dokumenten. Ankunftszeit am 27.08. bestimmt,
   ob die 130-km-Etappe plus Blaue Lagune am Anreisetag realistisch ist;
   Abflugzeit am 10.09. bestimmt den Puffer für Tanken und Mietwagenrückgabe
   (Empfehlung: 2–3 Std. vor Abflug am Check-in).
