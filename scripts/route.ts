/**
 * pnpm route — Build-Zeit-Pipeline, nie zur Laufzeit.
 *
 * Legt je Reisetag eine Route über echte Straßen und schreibt sie nach
 * data/route.json. Zur Laufzeit lädt die App nur noch diese Datei: beide
 * Routing-Dienste sind Demo-Instanzen mit Fair-Use-Auflagen, ein Aufruf pro
 * Seitenaufruf wäre respektlos und langsam.
 *
 * ## Warum Valhalla und nicht OSRM
 *
 * Die Gruppe fährt einen 9-Sitzer **ohne Allrad**. Führt eine Route über eine
 * F-Straße, ist sie falsch — Hochlandpisten sind für dieses Fahrzeug gesperrt
 * und meist nicht versichert.
 *
 * Der öffentliche OSRM-Demoserver antwortet zuverlässig, sein `driving`-Profil
 * fährt aber ungerührt über F-Straßen. Nachgemessen für Gullfoss → Blönduós:
 * 251 km über F338 und F578, quer durchs Hochland. Valhalla (FOSSGIS) legt
 * dieselbe Strecke mit `costing_options.auto.use_tracks = 0` über die
 * Ringstraße: 327 km, keine F-Straße. Das ist die Route, die diese Gruppe
 * fahren kann, auch wenn sie länger ist.
 *
 * `use_tracks` deckt allerdings nur `highway=track` ab. Viele F-Straßen sind
 * anders getaggt, deshalb wird das Ergebnis zusätzlich auf F-Nummern in den
 * Straßennamen geprüft — Gürtel und Hosenträger.
 *
 * ## Pflicht und Kür
 *
 * Jeder Tag wird **zweimal** geroutet: einmal direkt von Start zu Ziel — das
 * ist die Strecke, die gefahren werden *muss*, um abends im Bett zu liegen —
 * und einmal über die vorgeschlagenen Ziele. Wo die zweite Route auf der
 * ersten liegt, ist sie Pflicht; wo sie abzweigt, ist sie ein Abstecher, den
 * man auch sein lassen kann. Die Karte zeichnet beides verschieden, und die
 * Kilometer stehen getrennt in der Datei.
 *
 * An einem Standtag beginnt und endet der Tag an derselben Unterkunft. Dann
 * gibt es keine Pflichtstrecke — der ganze Tag ist Kür. Das ist keine Lücke,
 * sondern die Aussage.
 *
 * ## Was bei Zweifeln passiert
 *
 * Ein Tag, der nicht sauber gelingt, fällt auf die Luftlinie zurück **und wird
 * als solche gekennzeichnet** (`art: 'luftlinie'` mit Begründung). Die UI
 * zeichnet ihn gestrichelt. Eine falsche Straßenroute stillschweigend zu
 * zeigen wäre schlimmer als eine ehrliche Schematik.
 *
 * Flags:
 *   --offline   nur Cache verwenden, keine Netzaufrufe
 *   --dry       nichts schreiben, nur Bericht
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ReiseSchema, type Pos } from '../src/lib/schema';

const ROOT = resolve(import.meta.dirname, '..');
const P_REISE = resolve(ROOT, 'data/reise.json');
const P_ROUTE = resolve(ROOT, 'data/route.json');
const P_CACHE = resolve(ROOT, 'data/route-cache.json');

const DIENST = 'Valhalla (FOSSGIS)';
const ENDPUNKT = 'https://valhalla1.openstreetmap.de/route';
const UA = 'island-2026-route/1.0 (+https://github.com/JonasWild/Island)';
const HEUTE = new Date().toISOString().slice(0, 10);

const argv = new Set(process.argv.slice(2));
const OFFLINE = argv.has('--offline');
const DRY = argv.has('--dry');

/**
 * Weiter als das darf ein Wegpunkt nicht auf die nächste Straße gezogen
 * werden. 39 der 128 Positionen sind Bereichsangaben (Landschaftsräume,
 * Streckenabschnitte, Ferienhäuser ohne Adresse); der Router zieht sie auf
 * die nächstgelegene Straße, was weit danebengehen kann.
 */
const MAX_SNAP_M = 2000;
/** Ab dieser Abweichung von `etappe.km` wandert der Tag in die Prüfausgabe. */
const MAX_ABWEICHUNG = 0.35;
/** F-Straßen im Straßennamen: „F35", „F208" — nicht „Fossvegur". */
const F_STRASSE = /(^|[^\p{L}])F\d{2,4}(?![\p{L}\d])/u;
/**
 * Vereinfachung der Geometrie in Metern. Valhalla liefert Stützpunkte in
 * Fahrbahnauflösung — über alle 15 Tage rund 53 000 Punkte und 1,2 MB, die
 * jeder Besucher herunterladen müsste. Bei einem maximalen Kartenzoom von 10,5
 * ist ein Pixel gut 100 m breit; 25 m Toleranz sind dort unsichtbar.
 */
const VEREINFACHUNG_M = 25;
/**
 * So nah muss ein Punkt der vollen Route an der direkten Etappe liegen, um als
 * Pflichtstrecke zu gelten. Grosszuegig genug für getrennte Richtungsfahrbahnen
 * und leicht abweichendes Snapping, eng genug, um einen Abzweig zu erkennen.
 */
const PFLICHT_TOLERANZ_M = 60;
/**
 * Kürzere Wechsel als dieser werden geglättet. Ohne das zerfällt die Route an
 * jedem Kreisverkehr in ein Dutzend Schnipsel, und die Unterscheidung wird
 * unlesbar statt nützlich.
 */
const MIN_ABSCHNITT_M = 400;

type LngLat = [number, number];

const schlaf = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cache: Record<string, unknown> = existsSync(P_CACHE)
  ? JSON.parse(readFileSync(P_CACHE, 'utf8'))
  : {};
let cacheDirty = false;

function distanzM(a: Pos, b: Pos): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Valhalla kodiert die Geometrie als Polyline mit sechs Nachkommastellen. */
function polylineDekodieren(text: string, genauigkeit = 1e6): LngLat[] {
  const punkte: LngLat[] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < text.length) {
    for (const achse of ['lat', 'lon'] as const) {
      let ergebnis = 0;
      let schritt = 0;
      let byte: number;
      do {
        byte = text.charCodeAt(index++) - 63;
        ergebnis |= (byte & 0x1f) << schritt;
        schritt += 5;
      } while (byte >= 0x20);
      const delta = ergebnis & 1 ? ~(ergebnis >> 1) : ergebnis >> 1;
      if (achse === 'lat') lat += delta;
      else lon += delta;
    }
    punkte.push([lon / genauigkeit, lat / genauigkeit]);
  }
  return punkte;
}

/**
 * Douglas-Peucker. Rechnet den senkrechten Abstand in einer lokalen Ebene:
 * bei den Ausdehnungen eines Tages ist die Erdkrümmung kleiner als die
 * Toleranz, und ein Längengrad ist auf Islands Breite nur etwa 45 % eines
 * Breitengrads — das muss die Rechnung wissen, sonst vereinfacht sie in
 * Ost-West-Richtung zu grob.
 */
function vereinfachen(punkte: LngLat[], toleranzM: number): LngLat[] {
  if (punkte.length < 3) return punkte;
  const M_PRO_GRAD = 111_320;
  const kosLat = Math.cos((punkte[0]![1] * Math.PI) / 180);
  const x = (p: LngLat) => p[0] * M_PRO_GRAD * kosLat;
  const y = (p: LngLat) => p[1] * M_PRO_GRAD;

  const behalten = new Uint8Array(punkte.length);
  behalten[0] = 1;
  behalten[punkte.length - 1] = 1;

  const stapel: Array<[number, number]> = [[0, punkte.length - 1]];
  while (stapel.length > 0) {
    const [von, bis] = stapel.pop()!;
    if (bis - von < 2) continue;
    const a = punkte[von]!;
    const b = punkte[bis]!;
    const dx = x(b) - x(a);
    const dy = y(b) - y(a);
    const laenge = Math.hypot(dx, dy);
    let maxAbstand = -1;
    let maxIndex = von;
    for (let i = von + 1; i < bis; i++) {
      const p = punkte[i]!;
      const abstand =
        laenge === 0
          ? Math.hypot(x(p) - x(a), y(p) - y(a))
          : Math.abs(dy * (x(p) - x(a)) - dx * (y(p) - y(a))) / laenge;
      if (abstand > maxAbstand) {
        maxAbstand = abstand;
        maxIndex = i;
      }
    }
    if (maxAbstand > toleranzM) {
      behalten[maxIndex] = 1;
      stapel.push([von, maxIndex], [maxIndex, bis]);
    }
  }
  return punkte.filter((_, i) => behalten[i] === 1);
}

/**
 * Kürzester Abstand eines Punktes zu einer Polylinie, in Metern. Rechnet in
 * derselben lokalen Ebene wie `vereinfachen` — auf Tagesgrösse ist das genau
 * genug und um Grössenordnungen billiger als eine Kugelrechnung je Segment.
 */
function abstandZurLinie(punkt: LngLat, linie: LngLat[]): number {
  if (linie.length === 0) return Infinity;
  const M_PRO_GRAD = 111_320;
  const kosLat = Math.cos((punkt[1] * Math.PI) / 180);
  const px = punkt[0] * M_PRO_GRAD * kosLat;
  const py = punkt[1] * M_PRO_GRAD;

  let best = Infinity;
  for (let i = 1; i < linie.length; i++) {
    const ax = linie[i - 1]![0] * M_PRO_GRAD * kosLat;
    const ay = linie[i - 1]![1] * M_PRO_GRAD;
    const bx = linie[i]![0] * M_PRO_GRAD * kosLat;
    const by = linie[i]![1] * M_PRO_GRAD;
    const dx = bx - ax;
    const dy = by - ay;
    const quadrat = dx * dx + dy * dy;
    const t = quadrat === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / quadrat));
    const abstand = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (abstand < best) best = abstand;
    if (best === 0) break;
  }
  return best;
}

/** Länge einer Polylinie in Kilometern. */
function laengeKm(linie: LngLat[]): number {
  let m = 0;
  for (let i = 1; i < linie.length; i++) {
    m += distanzM([linie[i - 1]![1], linie[i - 1]![0]], [linie[i]![1], linie[i]![0]]);
  }
  return m / 1000;
}

/**
 * Teilt die volle Route in Pflicht- und Wahlabschnitte, indem jeder Stützpunkt
 * gegen die direkte Etappe gemessen wird. Aufeinanderfolgende Punkte gleicher
 * Art bilden einen Abschnitt; zu kurze Wechsel werden vorher geglättet.
 *
 * Benachbarte Abschnitte teilen sich ihren Grenzpunkt — sonst klafft in der
 * Karte an jedem Wechsel eine Lücke.
 */
function abschnitteBilden(voll: LngLat[], direkt: LngLat[]): Abschnitt[] {
  if (voll.length < 2) return [];
  if (direkt.length < 2) return [{ art: 'optional', punkte: voll }];

  const pflicht = voll.map((p) => abstandZurLinie(p, direkt) <= PFLICHT_TOLERANZ_M);

  // Glätten: Läufe unter MIN_ABSCHNITT_M an den Nachbarn angleichen. Von vorn
  // nach hinten, bis nichts mehr zu kurz ist.
  let geaendert = true;
  while (geaendert) {
    geaendert = false;
    let start = 0;
    while (start < pflicht.length) {
      let ende = start;
      while (ende + 1 < pflicht.length && pflicht[ende + 1] === pflicht[start]) ende++;
      const istRand = start === 0 || ende === pflicht.length - 1;
      const laenge = laengeKm(voll.slice(start, ende + 1)) * 1000;
      if (!istRand && laenge < MIN_ABSCHNITT_M) {
        for (let i = start; i <= ende; i++) pflicht[i] = !pflicht[start]!;
        geaendert = true;
        break;
      }
      start = ende + 1;
    }
  }

  const abschnitte: Abschnitt[] = [];
  let start = 0;
  while (start < voll.length) {
    let ende = start;
    while (ende + 1 < voll.length && pflicht[ende + 1] === pflicht[start]) ende++;
    // Ein Punkt Überlappung nach hinten, damit die Linien aneinander stossen.
    const bis = Math.min(ende + 1, voll.length - 1);
    const punkte = voll.slice(start, bis + 1);
    if (punkte.length >= 2) {
      abschnitte.push({ art: pflicht[start] ? 'pflicht' : 'optional', punkte });
    }
    if (ende === voll.length - 1) break;
    start = ende + 1;
  }
  return abschnitte;
}

/** Fünf Nachkommastellen sind gut ein Meter — mehr braucht keine Karte. */
function runden(punkte: LngLat[]): LngLat[] {
  return punkte.map((p): LngLat => [Number(p[0].toFixed(5)), Number(p[1].toFixed(5))]);
}

type ValhallaAntwort = {
  trip?: {
    legs: Array<{
      shape: string;
      summary: { length: number; time: number; has_ferry?: boolean };
      maneuvers: Array<{ street_names?: string[] }>;
    }>;
    summary: { length: number; time: number };
  };
  error?: string;
};

async function route(punkte: Pos[]): Promise<ValhallaAntwort | null> {
  const schluessel = punkte.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(';');
  if (schluessel in cache) return cache[schluessel] as ValhallaAntwort;
  if (OFFLINE) return null;

  const koerper = {
    locations: punkte.map((p) => ({ lat: p[0], lon: p[1], type: 'break' })),
    costing: 'auto',
    // use_tracks = 0: Hochlandpisten meiden. Die Gruppe fährt ohne Allrad.
    costing_options: { auto: { use_tracks: 0 } },
    directions_options: { units: 'kilometers', language: 'de-DE' },
  };
  try {
    const r = await fetch(ENDPUNKT, {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
      body: JSON.stringify(koerper),
    });
    const j = (await r.json()) as ValhallaAntwort;
    if (!r.ok && !j.error) throw new Error(`HTTP ${r.status}`);
    cache[schluessel] = j;
    cacheDirty = true;
    await schlaf(1200); // Fair Use: eine Anfrage pro Sekunde reicht völlig.
    return j;
  } catch (err) {
    console.warn(`  ! Routing fehlgeschlagen: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Die Reihenfolge der Stopps in reise.json ist **keine Fahrreihenfolge** — es
 * ist die Vorschlagsliste des Veranstalters, teils mehrfach genannt, teils in
 * beliebiger Folge. Deshalb wird sie vor dem Routen sortiert: erst der
 * nächstgelegene Nachbar von Start aus, dann 2-opt zum Auflösen der
 * Überkreuzungen. Start und Ziel bleiben fest.
 */
function sortieren(start: Pos, zwischen: Pos[], ziel: Pos): Pos[] {
  if (zwischen.length < 2) return zwischen;

  const offen = [...zwischen];
  const folge: Pos[] = [];
  let aktuell = start;
  while (offen.length > 0) {
    let besterIndex = 0;
    let besteDistanz = Infinity;
    for (let i = 0; i < offen.length; i++) {
      const d = distanzM(aktuell, offen[i]!);
      if (d < besteDistanz) {
        besteDistanz = d;
        besterIndex = i;
      }
    }
    aktuell = offen[besterIndex]!;
    folge.push(aktuell);
    offen.splice(besterIndex, 1);
  }

  const kette = [start, ...folge, ziel];
  const laenge = (k: Pos[]) => k.slice(1).reduce((n, p, i) => n + distanzM(k[i]!, p), 0);
  let verbessert = true;
  while (verbessert) {
    verbessert = false;
    for (let i = 1; i < kette.length - 2; i++) {
      for (let j = i + 1; j < kette.length - 1; j++) {
        const versuch = [...kette];
        versuch.splice(i, j - i + 1, ...kette.slice(i, j + 1).reverse());
        if (laenge(versuch) < laenge(kette) - 1) {
          kette.splice(0, kette.length, ...versuch);
          verbessert = true;
        }
      }
    }
  }
  return kette.slice(1, -1);
}

/**
 * Ein zusammenhängendes Stück Route. 'pflicht' liegt auf der direkten Etappe
 * und muss gefahren werden; 'optional' ist ein Abstecher zu einem
 * vorgeschlagenen Ziel und lässt sich streichen.
 */
type Abschnitt = { art: 'pflicht' | 'optional'; punkte: LngLat[] };

type TagRoute = {
  datum: string;
  art: 'strasse' | 'luftlinie';
  grund?: string;
  km: number;
  fahrzeitMin: number;
  /** Davon unvermeidbar: die direkte Fahrt von Start zu Ziel. */
  pflichtKm: number;
  planKm: number | null;
  wegpunkte: number;
  abschnitte: Abschnitt[];
};

function luftlinie(datum: string, punkte: Pos[], planKm: number | null, grund: string): TagRoute {
  const geometrie = runden(punkte.map((p): LngLat => [p[1], p[0]]));
  const km = punkte.slice(1).reduce((n, p, i) => n + distanzM(punkte[i]!, p), 0) / 1000;
  return {
    datum,
    art: 'luftlinie',
    grund,
    km: Number(km.toFixed(1)),
    fahrzeitMin: 0,
    // Ohne echte Route lässt sich Pflicht nicht von Kür trennen.
    pflichtKm: 0,
    planKm,
    wegpunkte: punkte.length,
    abschnitte: [{ art: 'optional', punkte: geometrie }],
  };
}

async function main() {
  const reise = ReiseSchema.parse(JSON.parse(readFileSync(P_REISE, 'utf8')));
  const flughafen = reise.reise.flughafen.pos;
  const unterkunft = (id: string | null) =>
    id ? (reise.unterkuenfte.find((u) => u.id === id)?.pos ?? null) : null;

  const ergebnisse: TagRoute[] = [];
  const pruefung: string[] = [];
  const gespart = { roh: 0, schlank: 0 };
  // Die Kette über alle Tage bleibt durchgehend: jeder Tag beginnt dort, wo
  // der Vortag geendet hat.
  let vorherigesZiel: Pos = flughafen;

  console.log(`Routing über ${DIENST}${OFFLINE ? ' (offline)' : ''} …\n`);

  for (const tag of reise.tage) {
    const planKm = tag.etappe?.km ?? null;
    const start = vorherigesZiel;
    const stopps = tag.highlights.filter((h) => h.pos !== null);
    // Der letzte Tag endet am Flughafen, sonst an der Unterkunft der Nacht.
    const ziel = tag.typ === 'abreise' ? flughafen : (unterkunft(tag.unterkunft) ?? stopps[stopps.length - 1]?.pos ?? start);

    /*
      Nur punktgenaue Stopps werden angefahren. Ein Landschaftsraum oder ein
      Streckenabschnitt ist kein Ziel, das man ansteuert — sein Schwerpunkt
      läge irgendwo im Gelände und würde auf eine beliebige Straße gezogen.
      Als Marker bleiben diese Stopps selbstverständlich auf der Karte.
    */
    const zwischen = stopps
      .filter((h) => h.posMeta?.genauigkeit === 'punkt')
      .map((h) => h.pos!)
      .filter((p) => distanzM(p, start) > 300 && distanzM(p, ziel) > 300);
    const einmalig: Pos[] = [];
    for (const p of zwischen) {
      if (!einmalig.some((q) => distanzM(p, q) < 300)) einmalig.push(p);
    }

    let punkte = [start, ...sortieren(start, einmalig, ziel), ziel];
    vorherigesZiel = ziel;

    if (punkte.length < 2 || distanzM(start, ziel) < 200) {
      // Ein Standtag ohne punktgenaue Ziele hat nichts zu routen.
      if (einmalig.length === 0) {
        ergebnisse.push(luftlinie(tag.datum, punkte, planKm, 'keine punktgenauen Ziele an diesem Tag'));
        console.log(`  ${tag.datum}  Luftlinie — keine punktgenauen Ziele`);
        continue;
      }
    }

    let antwort = await route(punkte);
    let verworfen: string[] = [];

    // Erster Durchgang: Wegpunkte, die zu weit auf eine Straße gezogen wurden,
    // fliegen raus. Der Router setzt sie sonst irgendwohin.
    if (antwort?.trip) {
      const legs = antwort.trip.legs;
      const zuWeit = new Set<number>();
      legs.forEach((leg, i) => {
        const form = polylineDekodieren(leg.shape);
        const anfang = form[0];
        const ende = form[form.length - 1];
        if (anfang && distanzM(punkte[i]!, [anfang[1], anfang[0]]) > MAX_SNAP_M) zuWeit.add(i);
        if (ende && distanzM(punkte[i + 1]!, [ende[1], ende[0]]) > MAX_SNAP_M) zuWeit.add(i + 1);
      });
      // Start und Ziel bleiben — ohne sie bricht die Kette.
      zuWeit.delete(0);
      zuWeit.delete(punkte.length - 1);
      if (zuWeit.size > 0) {
        verworfen = [...zuWeit].map((i) => `Wegpunkt ${i}`);
        punkte = punkte.filter((_, i) => !zuWeit.has(i));
        antwort = await route(punkte);
      }
    }

    if (!antwort?.trip) {
      const grund = antwort?.error ? `Dienst meldet: ${antwort.error}` : 'keine Antwort vom Dienst';
      ergebnisse.push(luftlinie(tag.datum, punkte, planKm, grund));
      console.log(`  ${tag.datum}  Luftlinie — ${grund}`);
      continue;
    }

    const trip = antwort.trip;
    const strassen = new Set<string>();
    let faehre = false;
    for (const leg of trip.legs) {
      if (leg.summary.has_ferry) faehre = true;
      for (const m of leg.maneuvers) for (const n of m.street_names ?? []) strassen.add(n);
    }
    const fStrassen = [...strassen].filter((n) => F_STRASSE.test(n));

    if (fStrassen.length > 0 || faehre) {
      const grund = fStrassen.length
        ? `Route führt über F-Straßen (${fStrassen.join(', ')}) — der 9-Sitzer hat keinen Allrad`
        : 'Route führt über eine Fähre, die nicht gebucht ist';
      ergebnisse.push(luftlinie(tag.datum, punkte, planKm, grund));
      console.log(`  ${tag.datum}  Luftlinie — ${grund}`);
      continue;
    }

    const roh = trip.legs.flatMap((leg, i) => {
      const form = polylineDekodieren(leg.shape);
      // Der letzte Punkt eines Abschnitts ist der erste des nächsten.
      return i === 0 ? form : form.slice(1);
    });
    // Vereinfachen vor dem Runden: sonst erzeugt das Runden Doppelpunkte, die
    // Douglas-Peucker als eigene Stützpunkte durchreicht.
    const geometrie = runden(vereinfachen(roh, VEREINFACHUNG_M));
    const km = Number(trip.summary.length.toFixed(1));
    const fahrzeitMin = Math.round(trip.summary.time / 60);

    /*
      Zweiter Lauf: die direkte Etappe von Start zu Ziel, ohne die
      vorgeschlagenen Ziele. Sie ist der Massstab dafür, was an diesem Tag
      unvermeidbar ist. An einem Standtag fallen Start und Ziel zusammen —
      dann gibt es keine Pflichtstrecke und der ganze Tag ist Kür.
    */
    const vonPunkt = punkte[0]!;
    const nachPunkt = punkte[punkte.length - 1]!;
    let direkt: LngLat[] = [];
    if (distanzM(vonPunkt, nachPunkt) > 200) {
      const direktAntwort = await route([vonPunkt, nachPunkt]);
      const direktTrip = direktAntwort?.trip;
      if (direktTrip) {
        direkt = runden(
          vereinfachen(
            direktTrip.legs.flatMap((leg, i) => {
              const form = polylineDekodieren(leg.shape);
              return i === 0 ? form : form.slice(1);
            }),
            VEREINFACHUNG_M,
          ),
        );
      }
    }

    const abschnitte = abschnitteBilden(geometrie, direkt);
    const pflichtKm = Number(
      abschnitte
        .filter((a) => a.art === 'pflicht')
        .reduce((n, a) => n + laengeKm(a.punkte), 0)
        .toFixed(1),
    );

    ergebnisse.push({
      datum: tag.datum,
      art: 'strasse',
      km,
      fahrzeitMin,
      pflichtKm,
      planKm,
      wegpunkte: punkte.length,
      abschnitte,
    });
    gespart.roh += roh.length;
    gespart.schlank += geometrie.length;

    /*
      `etappe.km` ist die **direkte** Fahrt von A nach B — der Reiseplan sagt
      das an mehreren Stellen selbst („ca. 2 Stunden ohne Abstecher"). Die
      geroutete Strecke fährt zusätzlich alle vorgeschlagenen Ziele an. Mehr
      Kilometer sind deshalb erwartbar und kein Fehler; **weniger** Kilometer
      sind der auffällige Fall, denn dann fehlt der Route etwas, das im Plan
      steckt — meist eine Schleife, die als Bereich und nicht als Punkt in den
      Daten steht. Beides gehört vor menschliche Augen, nicht stillschweigend
      in die Daten.
    */
    const abweichung = planKm ? (km - planKm) / planKm : 0;
    const hinweis = [
      verworfen.length ? `${verworfen.length} Wegpunkt(e) wegen Snapping verworfen` : '',
      planKm && abweichung > MAX_ABWEICHUNG
        ? `${km} km gegen ${planKm} km direkt (+${Math.round(abweichung * 100)} %) — Abstecher zu ${punkte.length - 2} Zielen`
        : '',
      planKm && abweichung < -0.1
        ? `nur ${km} km gegen ${planKm} km im Plan (${Math.round(abweichung * 100)} %) — der Route fehlt vermutlich eine Schleife`
        : '',
    ].filter(Boolean);
    if (hinweis.length) pruefung.push(`${tag.datum}: ${hinweis.join(' · ')}`);

    console.log(
      `  ${tag.datum}  ${km} km (${pflichtKm} Pflicht, ${Math.round((km - pflichtKm) * 10) / 10} Kür) · ${Math.floor(fahrzeitMin / 60)} h ${fahrzeitMin % 60} min · ${abschnitte.length} Abschnitte`,
    );
  }

  const datei = {
    erzeugtAm: HEUTE,
    dienst: DIENST,
    hinweis:
      'Erzeugt von scripts/route.ts zur Build-Zeit. Tage mit art "luftlinie" konnten nicht sauber geroutet werden und sind Schematik, keine Fahrempfehlung.',
    tage: ergebnisse,
  };

  if (!DRY) {
    writeFileSync(P_ROUTE, JSON.stringify(datei) + '\n');
    if (cacheDirty) writeFileSync(P_CACHE, JSON.stringify(cache) + '\n');
  }

  const strasse = ergebnisse.filter((t) => t.art === 'strasse');
  console.log(
    `\n${strasse.length}/${ergebnisse.length} Tage über echte Straßen · ${ergebnisse.length - strasse.length} als Luftlinie gekennzeichnet`,
  );
  console.log(
    `Summe geroutet: ${Math.round(strasse.reduce((n, t) => n + t.km, 0))} km gegen ${reise.tage.reduce((n, t) => n + (t.etappe?.km ?? 0), 0)} km direkte Etappen im Reiseplan.`,
  );
  console.log(
    'Die Differenz sind die Abstecher: der Plan zählt die Fahrt von A nach B,\ndie Route fährt zusätzlich die vorgeschlagenen Ziele an.',
  );
  console.log(
    `Geometrie: ${gespart.roh} Stützpunkte auf ${gespart.schlank} vereinfacht (${VEREINFACHUNG_M} m Toleranz).`,
  );
  if (pruefung.length) {
    console.log('\nPrüfausgabe — bitte ansehen:');
    for (const z of pruefung) console.log(`  ${z}`);
  }
  if (DRY) console.log('\n(--dry: nichts geschrieben)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
