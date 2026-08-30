/**
 * pnpm geocode — Build-Zeit-Pipeline, nie zur Laufzeit.
 *
 * Regel: ein Treffer wird nur übernommen, wenn er eindeutig ist. Alles andere
 * landet mit seinen Kandidaten in data/offen.json und wird von Hand geklärt.
 * Kein stilles Raten.
 *
 * Reihenfolge der Autorität:
 *   1. data/kuratiert.json   (von Hand belegt, gewinnt immer)
 *   2. OSM (Nominatim, dann Overpass im Umkreis der bisherigen Position)
 *   3. bestehende Position   (bleibt, wird aber ohne Beleg nicht als 'punkt' geführt)
 *
 * Antworten werden in data/geocode-cache.json abgelegt und mitcommittet:
 * reproduzierbare Builds, keine Rate-Limit-Überraschungen.
 *
 * Flags:
 *   --all       auch Stopps neu abfragen, die bereits posMeta haben
 *   --offline   nur Cache + Kuratierung verwenden, keine Netzaufrufe
 *   --dry       nichts schreiben, nur Bericht
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ReiseSchema, type Pos, type PosMeta, type Stopp, type Unterkunft } from '../src/lib/schema';

const ROOT = resolve(import.meta.dirname, '..');
const P_REISE = resolve(ROOT, 'data/reise.json');
const P_CACHE = resolve(ROOT, 'data/geocode-cache.json');
const P_OFFEN = resolve(ROOT, 'data/offen.json');
const P_KURATIERT = resolve(ROOT, 'data/kuratiert.json');

const UA = 'island-2026-geocode/1.0 (+https://github.com/JonasWild/Island)';
const HEUTE = new Date().toISOString().slice(0, 10);

const argv = new Set(process.argv.slice(2));
const ALL = argv.has('--all');
const OFFLINE = argv.has('--offline');
const DRY = argv.has('--dry');

/** Ein Treffer weiter als das weg von der Planposition ist ein anderer Ort. */
const MAX_ABWEICHUNG_KM = 25;
/**
 * So weit darf die Pipeline eine bereits kuratierte Position höchstens
 * verschieben. Alles darüber ist keine Verfeinerung mehr, sondern ein anderer
 * Ort — in Island tragen Wasserfälle und Höfe oft denselben Namen mehrfach
 * (Rjúkandi, Reykholt, Laugarvatn). Solche Fälle gehören in offen.json und
 * damit vor menschliche Augen, nicht stillschweigend in den Datensatz.
 */
const MAX_KORREKTUR_KM = 8;
/** Zwei Kandidaten näher als das beieinander sind derselbe Ort. */
const CLUSTER_KM = 2;
/** So nah muss ein Treffer an der kuratierten Planposition liegen, um sie zu bestätigen. */
const BESTAETIGUNG_KM = 3;

const OVERPASS_ENDPUNKTE = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

type Kandidat = { label: string; pos: Pos; quelle: string };
type Cache = Record<string, unknown>;

const cache: Cache = existsSync(P_CACHE) ? JSON.parse(readFileSync(P_CACHE, 'utf8')) : {};
let cacheDirty = false;

const kuratiert: {
  eintraege: Record<string, { pos?: Pos; posMeta: PosMeta }>;
} = JSON.parse(readFileSync(P_KURATIERT, 'utf8'));

function distanzKm(a: Pos, b: Pos): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

const schlaf = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function holen<T>(schluessel: string, lader: () => Promise<T>): Promise<T | null> {
  if (schluessel in cache) return cache[schluessel] as T;
  if (OFFLINE) return null;
  try {
    const wert = await lader();
    cache[schluessel] = wert;
    cacheDirty = true;
    await schlaf(1100); // Nominatim: max. 1 Anfrage/Sekunde
    return wert;
  } catch (err) {
    console.warn(`  ! Abfrage fehlgeschlagen (${schluessel}): ${(err as Error).message}`);
    return null;
  }
}

type NominatimTreffer = { lat: string; lon: string; display_name: string; category?: string };

async function nominatim(frage: string): Promise<NominatimTreffer[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', frage);
  url.searchParams.set('countrycodes', 'is');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '6');
  const res = await holen(`nominatim:${frage}`, async () => {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as NominatimTreffer[];
  });
  return res ?? [];
}

type OverpassEl = {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** Namenssuche im Umkreis der Planposition — findet, was Nominatim nicht rankt. */
async function overpass(name: string, um: Pos, radiusKm = 20): Promise<OverpassEl[]> {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.cos((um[0] * Math.PI) / 180));
  const bbox = `${(um[0] - dLat).toFixed(4)},${(um[1] - dLon).toFixed(4)},${(um[0] + dLat).toFixed(4)},${(um[1] + dLon).toFixed(4)}`;
  const escaped = name.replace(/["\\]/g, '');
  const q = `[out:json][timeout:40];nwr["name"~"${escaped}",i](${bbox});out center 8;`;
  const res = await holen(`overpass:${escaped}@${bbox}`, async () => {
    // Overpass antwortet unter Last mit 429/504. Beide sind vorübergehend,
    // deshalb Backoff über zwei Endpunkte statt Aufgeben.
    let letzterFehler = 'unbekannt';
    for (let versuch = 0; versuch < OVERPASS_ENDPUNKTE.length; versuch++) {
      const endpunkt = OVERPASS_ENDPUNKTE[versuch % OVERPASS_ENDPUNKTE.length]!;
      const r = await fetch(endpunkt, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: q }),
      });
      if (r.ok) {
        const j = (await r.json()) as { elements?: OverpassEl[] };
        return j.elements ?? [];
      }
      letzterFehler = `HTTP ${r.status}`;
      if (r.status !== 429 && r.status !== 504 && r.status !== 502) break;
      await schlaf(2500);
    }
    throw new Error(letzterFehler);
  });
  return res ?? [];
}

/**
 * Der Name im Reiseplan enthält oft mehr als den Ortsnamen ("Hraunfossar &
 * Barnafoss", "Park Höfði / Kálfaströnd", "Wanderung Námafjall"). Für die
 * Suche wird das auf den eigentlichen Namen reduziert.
 */
function suchNamen(name: string): string[] {
  const ohneGattung = name.replace(
    /^(Wanderung|Lange Wanderung|Hof|See|Krater|Strand|Insel|Tunnel|Schlucht|Kap|Maar|Nationalpark|Halbinsel|Lavahöhle|Moorgebiet|Niederung|Ebene des|Freilichtmuseum|Heimatmuseum|Naturbad|Gletscherlagune|Solfatarenfeld|Echofelsen|Vogelschutzreservat|Pseudokrater|Park|Lavafeld|Gletschertunnel)\s+/i,
    '',
  );
  const teile = ohneGattung
    .split(/\s*[&/]\s*|\s+\(|\)/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
  return [...new Set([ohneGattung.trim(), ...teile])].slice(0, 3);
}

function zuKandidaten(
  treffer: NominatimTreffer[],
  elemente: OverpassEl[],
  name: string,
): Kandidat[] {
  const out: Kandidat[] = [];
  for (const t of treffer) {
    out.push({
      label: t.display_name.split(',').slice(0, 3).join(',').trim(),
      pos: [Number(t.lat), Number(t.lon)],
      quelle: 'nominatim',
    });
  }
  for (const e of elemente) {
    const c = e.center ?? (e.lat !== undefined && e.lon !== undefined ? { lat: e.lat, lon: e.lon } : null);
    if (!c) continue;
    out.push({
      label: e.tags?.name ?? name,
      pos: [Number(c.lat.toFixed(5)), Number(c.lon.toFixed(5))],
      quelle: 'overpass',
    });
  }
  return out;
}

/** Kandidaten, die dicht beieinander liegen, sind ein Ort — nicht mehrdeutig. */
function clustern(kandidaten: Kandidat[]): Kandidat[][] {
  const cluster: Kandidat[][] = [];
  for (const k of kandidaten) {
    const treffer = cluster.find((c) => distanzKm(c[0]!.pos, k.pos) < CLUSTER_KM);
    if (treffer) treffer.push(k);
    else cluster.push([k]);
  }
  return cluster;
}

type Ergebnis =
  | { art: 'kuratiert'; pos: Pos; meta: PosMeta }
  | { art: 'osm'; pos: Pos; meta: PosMeta }
  | { art: 'offen'; grund: string; kandidaten: Kandidat[] };

async function aufloesen(
  name: string,
  strasse: string | null | undefined,
  bisher: Pos | null,
  kuratierSchluessel: string,
): Promise<Ergebnis | null> {
  const kur = kuratiert.eintraege[kuratierSchluessel] ?? kuratiert.eintraege[name];
  if (kur) {
    return { art: 'kuratiert', pos: kur.pos ?? bisher ?? [0, 0], meta: kur.posMeta };
  }

  const namen = suchNamen(name);
  const alle: Kandidat[] = [];
  // Nominatim zuerst — es kennt die isländischen Namen gut und ist stabil.
  for (const n of namen) {
    // Bewusst nur der Name: `strasse` ist deutscher Fließtext aus dem
    // Reiseplan ("Straße 518", "Parkplatz Barnafoss") und lässt Nominatim
    // ins Leere laufen.
    alle.push(...zuKandidaten(await nominatim(n), [], n));
    if (alle.length > 0) break; // erste Namensvariante, die überhaupt greift
  }
  // Overpass ist nur der Rückfall: der Dienst ist häufig überlastet und wird
  // hier gebraucht, um Objekte zu finden, die Nominatim nicht rankt.
  if (alle.length === 0 && bisher) {
    for (const n of namen) {
      alle.push(...zuKandidaten([], await overpass(n, bisher), n));
      if (alle.length > 0) break;
    }
  }

  if (alle.length === 0) {
    return {
      art: 'offen',
      grund: `kein Treffer in OSM für "${namen.join('" / "')}"${strasse ? ` (Reiseplan nennt: ${strasse})` : ''}`,
      kandidaten: [],
    };
  }

  // Nur Kandidaten in plausibler Nähe der Planposition zählen.
  const nah = bisher ? alle.filter((k) => distanzKm(bisher, k.pos) <= MAX_ABWEICHUNG_KM) : alle;
  if (nah.length === 0) {
    return {
      art: 'offen',
      grund: `alle Treffer weiter als ${MAX_ABWEICHUNG_KM} km von der Planposition`,
      kandidaten: alle.slice(0, 5),
    };
  }

  const cluster = clustern(nah);
  let gewaehlt = cluster[0];
  if (cluster.length > 1) {
    // Mehrere Orte gleichen Namens (See/Ort/Kirche heißen in Island oft
    // gleich). Eindeutig ist das nur, wenn genau einer davon die bereits
    // kuratierte Planposition bestätigt — das ist Prüfung, nicht Raten.
    const bestaetigend = bisher
      ? cluster.filter((c) => c.some((k) => distanzKm(bisher, k.pos) <= BESTAETIGUNG_KM))
      : [];
    if (bestaetigend.length !== 1) {
      return {
        art: 'offen',
        grund: `${cluster.length} getrennte Orte gleichen Namens, keiner bestätigt die Planposition eindeutig`,
        kandidaten: cluster.map((c) => c[0]!).slice(0, 5),
      };
    }
    gewaehlt = bestaetigend[0];
  }

  // Innerhalb des Clusters den Treffer nehmen, der der Planposition am
  // nächsten liegt — die Cluster-Mitglieder sind ohnehin < CLUSTER_KM auseinander.
  const best = bisher
    ? [...gewaehlt!].sort((a, b) => distanzKm(bisher, a.pos) - distanzKm(bisher, b.pos))[0]!
    : gewaehlt![0]!;

  if (bisher && distanzKm(bisher, best.pos) > MAX_KORREKTUR_KM) {
    return {
      art: 'offen',
      grund: `Treffer liegt ${distanzKm(bisher, best.pos).toFixed(1)} km von der kuratierten Planposition — zu weit für eine Verfeinerung`,
      kandidaten: [best],
    };
  }
  return {
    art: 'osm',
    pos: best.pos,
    meta: {
      quelle: 'osm',
      genauigkeit: 'punkt',
      geprueftAm: HEUTE,
      ref: `${best.quelle}: ${best.label}`,
    },
  };
}

async function main() {
  const roh = JSON.parse(readFileSync(P_REISE, 'utf8'));
  const reise = ReiseSchema.parse(roh);

  const offen: Array<{
    tag: string | null;
    name: string;
    art: 'stopp' | 'unterkunft';
    hinweis: string;
    kandidaten: Kandidat[];
  }> = [];
  const bericht = { kuratiert: 0, osm: 0, offen: 0, uebersprungen: 0, korrigiert: 0 };

  async function bearbeiten(
    ziel: Stopp | Unterkunft,
    schluessel: string,
    tag: string | null,
    art: 'stopp' | 'unterkunft',
  ) {
    // Eine Position aus dem Blatt des Vermieters ist der Beleg selbst — er
    // weiß, wo sein Haus steht, OSM kennt die Parzelle nicht. Auch `--all`
    // rührt sie nicht an, sonst überschriebe der nächste Lauf die genaueste
    // Angabe des Datensatzes mit einem Ortsmittelpunkt.
    if (ziel.posMeta?.quelle === 'anbieter') {
      bericht.uebersprungen++;
      return;
    }
    if (ziel.posMeta && !ALL) {
      bericht.uebersprungen++;
      return;
    }
    const vorher = ziel.pos;
    const erg = await aufloesen(ziel.name, 'strasse' in ziel ? ziel.strasse : null, vorher, schluessel);
    if (!erg) return;
    if (erg.art === 'offen') {
      bericht.offen++;
      offen.push({ tag, name: ziel.name, art, hinweis: erg.grund, kandidaten: erg.kandidaten });
      console.log(`  offen  ${ziel.name} — ${erg.grund}`);
      // Eine vorhandene Position wird nicht gelöscht — sie stammt aus der
      // Kuratierung der Reiseunterlagen. Sie bekommt aber genau diese Herkunft
      // und den Grund, warum OSM sie nicht bestätigt. Kein falsches 'osm'.
      if (vorher) {
        ziel.posMeta = {
          quelle: 'reiseplan',
          genauigkeit: 'bereich',
          geprueftAm: HEUTE,
          hinweis: `Aus dem Reiseplan kuratiert, von OSM nicht bestätigt: ${erg.grund}. Siehe data/offen.json.`,
        };
        delete (ziel as Record<string, unknown>).posUngenau;
      }
      return;
    }
    ziel.pos = erg.pos;
    ziel.posMeta = erg.meta;
    delete (ziel as Record<string, unknown>).posUngenau;
    if (erg.art === 'kuratiert') bericht.kuratiert++;
    else bericht.osm++;
    if (vorher && distanzKm(vorher, erg.pos) > 0.5) {
      bericht.korrigiert++;
      console.log(
        `  fix    ${ziel.name}: ${distanzKm(vorher, erg.pos).toFixed(1)} km verschoben → [${erg.pos[0]}, ${erg.pos[1]}]`,
      );
    }
  }

  console.log(`Geocoding${OFFLINE ? ' (offline)' : ''}${ALL ? ' (alle)' : ''} …`);
  for (const u of reise.unterkuenfte) {
    await bearbeiten(u, `unterkunft:${u.id}`, null, 'unterkunft');
  }
  for (const tag of reise.tage) {
    for (const h of tag.highlights) {
      await bearbeiten(h, h.name, tag.datum, 'stopp');
    }
  }

  if (!reise.reise.flughafen.posMeta) {
    reise.reise.flughafen.posMeta = {
      quelle: 'manuell',
      genauigkeit: 'punkt',
      geprueftAm: HEUTE,
      ref: 'Keflavík International Airport (KEF), Terminalgebäude',
    };
  }

  if (!DRY) {
    writeFileSync(P_REISE, JSON.stringify(reise, null, 2) + '\n');
    writeFileSync(
      P_OFFEN,
      JSON.stringify({ erzeugtAm: HEUTE, eintraege: offen }, null, 2) + '\n',
    );
    if (cacheDirty) writeFileSync(P_CACHE, JSON.stringify(cache, null, 2) + '\n');
  }

  const gesamt = reise.tage.reduce((n, t) => n + t.highlights.length, 0);
  const belegt = reise.tage.reduce(
    (n, t) => n + t.highlights.filter((h) => h.pos && h.posMeta).length,
    0,
  );
  const punkt = reise.tage.reduce(
    (n, t) => n + t.highlights.filter((h) => h.posMeta?.genauigkeit === 'punkt').length,
    0,
  );
  console.log(
    `\n${belegt}/${gesamt} Stopps belegt (${punkt} punktgenau, ${belegt - punkt} als Bereich), ${offen.length} offen.`,
  );
  console.log(
    `kuratiert ${bericht.kuratiert} · osm ${bericht.osm} · offen ${bericht.offen} · übersprungen ${bericht.uebersprungen} · korrigiert ${bericht.korrigiert}`,
  );
  if (DRY) console.log('(--dry: nichts geschrieben)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
