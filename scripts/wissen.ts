/**
 * pnpm wissen — Build-Zeit-Pipeline, nie zur Laufzeit.
 *
 * Holt zu jedem Stopp den Einleitungsabsatz des passenden Artikels aus der
 * deutschen Wikipedia und legt ihn als `wissen` in reise.json ab. Das ersetzt
 * das LLM: nachprüfbarer Text mit Quelle und Link statt einer generierten
 * Antwort, die niemand belegen kann.
 *
 * Dieselbe Regel wie beim Geocoding: **nur eindeutige Treffer**. Ein Artikel
 * wird übernommen, wenn
 *   a) sein Name zum Stopp passt (normalisiert gleich) und er der einzige
 *      solche Treffer im Umkreis ist, oder
 *   b) er der einzige Artikel unter 400 m ist — und der Stopp punktgenau
 *      verortet ist. Bei `genauigkeit: 'bereich'` ist die Position selbst auf
 *      400 m nicht belastbar, dort zählt nur die Namensregel.
 * Alles andere bleibt leer und landet mit Begründung in data/wissen-offen.json.
 *
 * Der Suchradius ist die Obergrenze der Geosuche (10 km). Weiter weg wird gar
 * nicht erst gesucht — ein Artikel jenseits davon beschreibt ein anderes Objekt.
 *
 * Antworten werden in data/wissen-cache.json abgelegt und mitcommittet:
 * reproduzierbare Builds, keine Rate-Limit-Überraschungen.
 *
 * Flags:
 *   --all       auch Stopps neu abfragen, die bereits `wissen` haben
 *   --offline   nur Cache verwenden, keine Netzaufrufe
 *   --dry       nichts schreiben, nur Bericht
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ReiseSchema, type Stopp } from '../src/lib/schema';

const ROOT = resolve(import.meta.dirname, '..');
const P_REISE = resolve(ROOT, 'data/reise.json');
const P_CACHE = resolve(ROOT, 'data/wissen-cache.json');
const P_OFFEN = resolve(ROOT, 'data/wissen-offen.json');

const UA = 'island-2026-wissen/1.0 (+https://github.com/JonasWild/Island)';
const HEUTE = new Date().toISOString().slice(0, 10);
const API = 'https://de.wikipedia.org/w/api.php';

const argv = new Set(process.argv.slice(2));
const ALL = argv.has('--all');
const OFFLINE = argv.has('--offline');
const DRY = argv.has('--dry');

/** Obergrenze der Wikipedia-Geosuche. */
const RADIUS_M = 10_000;
/** Ein einzelner Artikel so nah am Stopp beschreibt den Stopp. */
const NAH_M = 400;
/**
 * Der Einleitungsabsatz kann lang werden. Für die Detailleiste wird auf ganze
 * Sätze gekürzt; der Link führt auf den vollständigen Artikel.
 */
const MAX_ZEICHEN = 700;

type Cache = Record<string, unknown>;
const cache: Cache = existsSync(P_CACHE) ? JSON.parse(readFileSync(P_CACHE, 'utf8')) : {};
let cacheDirty = false;

const schlaf = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function holen<T>(schluessel: string, lader: () => Promise<T>): Promise<T | null> {
  if (schluessel in cache) return cache[schluessel] as T;
  if (OFFLINE) return null;
  try {
    const wert = await lader();
    cache[schluessel] = wert;
    cacheDirty = true;
    await schlaf(250);
    return wert;
  } catch (err) {
    console.warn(`  ! Abfrage fehlgeschlagen (${schluessel}): ${(err as Error).message}`);
    return null;
  }
}

async function api<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

type GeoTreffer = { pageid: number; title: string; lat: number; lon: number; dist: number };

async function geosuche(lat: number, lon: number): Promise<GeoTreffer[]> {
  const schluessel = `geo:${lat.toFixed(5)},${lon.toFixed(5)}`;
  const res = await holen(schluessel, async () => {
    const j = await api<{ query?: { geosearch?: GeoTreffer[] } }>({
      action: 'query',
      list: 'geosearch',
      gscoord: `${lat}|${lon}`,
      gsradius: String(RADIUS_M),
      gslimit: '50',
    });
    return j.query?.geosearch ?? [];
  });
  return res ?? [];
}

type Seite = {
  title: string;
  extract?: string;
  pageprops?: Record<string, string>;
  missing?: boolean;
};

async function auszug(titel: string): Promise<Seite | null> {
  const res = await holen(`extract:${titel}`, async () => {
    const j = await api<{ query?: { pages?: Seite[] } }>({
      action: 'query',
      prop: 'extracts|pageprops',
      exintro: '1',
      explaintext: '1',
      redirects: '1',
      titles: titel,
    });
    return j.query?.pages?.[0] ?? null;
  });
  return res ?? null;
}

/** Vergleichsform: ohne Diakritika, ohne Satzzeichen, klein. */
function normal(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đð]/gi, 'd')
    .replace(/[þ]/gi, 'th')
    .replace(/[æ]/gi, 'ae')
    .replace(/[ø]/gi, 'o')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Der Name im Reiseplan enthält oft mehr als den Ortsnamen ("Hraunfossar &
 * Barnafoss", "Park Höfði / Kálfaströnd", "Wanderung Námafjall"). Für den
 * Abgleich mit dem Artikelnamen wird das auf die eigentlichen Namen reduziert.
 * Bewusst dieselbe Zerlegung wie in scripts/geocode.ts — beide Pipelines sollen
 * denselben Stopp gleich benennen.
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
  return [...new Set([name.trim(), ohneGattung.trim(), ...teile])];
}

/** Auf ganze Sätze kürzen — ein abgeschnittener Halbsatz liest sich wie ein Fehler. */
function kuerzen(text: string): string {
  const sauber = text.replace(/\s+/g, ' ').trim();
  if (sauber.length <= MAX_ZEICHEN) return sauber;
  const schnitt = sauber.slice(0, MAX_ZEICHEN);
  const ende = Math.max(schnitt.lastIndexOf('. '), schnitt.lastIndexOf('! '), schnitt.lastIndexOf('? '));
  return ende > MAX_ZEICHEN * 0.4 ? schnitt.slice(0, ende + 1) : schnitt.trimEnd() + ' …';
}

type Ergebnis =
  | { art: 'treffer'; titel: string; text: string; grund: string }
  | { art: 'offen'; grund: string; kandidaten: string[] };

async function aufloesen(stopp: Stopp): Promise<Ergebnis> {
  const pos = stopp.pos;
  if (!pos) return { art: 'offen', grund: 'keine Position', kandidaten: [] };

  const treffer = await geosuche(pos[0], pos[1]);
  if (treffer.length === 0) {
    return { art: 'offen', grund: `kein Wikipedia-Artikel im Umkreis von ${RADIUS_M / 1000} km`, kandidaten: [] };
  }

  const namen = new Set(suchNamen(stopp.name).map(normal));
  const namensTreffer = treffer.filter((t) => namen.has(normal(t.title)));

  let gewaehlt: GeoTreffer | null = null;
  let grund = '';

  if (namensTreffer.length === 1) {
    gewaehlt = namensTreffer[0]!;
    grund = `Artikelname stimmt mit dem Stopp überein (${Math.round(gewaehlt.dist)} m entfernt)`;
  } else if (namensTreffer.length > 1) {
    return {
      art: 'offen',
      grund: `${namensTreffer.length} Artikel gleichen Namens im Umkreis — nicht eindeutig`,
      kandidaten: namensTreffer.map((t) => `${t.title} (${Math.round(t.dist)} m)`),
    };
  } else {
    const nah = treffer.filter((t) => t.dist <= NAH_M);
    if (stopp.posMeta?.genauigkeit !== 'punkt') {
      return {
        art: 'offen',
        grund: `kein Artikel dieses Namens; die Position ist nur ein Bereich, deshalb zählt die Nähe hier nicht`,
        kandidaten: treffer.slice(0, 5).map((t) => `${t.title} (${Math.round(t.dist)} m)`),
      };
    }
    if (nah.length !== 1) {
      return {
        art: 'offen',
        grund:
          nah.length === 0
            ? `kein Artikel dieses Namens und keiner unter ${NAH_M} m`
            : `${nah.length} Artikel unter ${NAH_M} m — nicht eindeutig`,
        kandidaten: treffer.slice(0, 5).map((t) => `${t.title} (${Math.round(t.dist)} m)`),
      };
    }
    gewaehlt = nah[0]!;
    grund = `einziger Artikel unter ${NAH_M} m (${Math.round(gewaehlt.dist)} m)`;
  }

  const seite = await auszug(gewaehlt.title);
  if (!seite || seite.missing || !seite.extract?.trim()) {
    return { art: 'offen', grund: `Artikel "${gewaehlt.title}" hat keinen Einleitungstext`, kandidaten: [] };
  }
  if (seite.pageprops && 'disambiguation' in seite.pageprops) {
    return { art: 'offen', grund: `"${gewaehlt.title}" ist eine Begriffsklärung, kein Artikel`, kandidaten: [] };
  }

  return { art: 'treffer', titel: seite.title, text: kuerzen(seite.extract), grund };
}

async function main() {
  const reise = ReiseSchema.parse(JSON.parse(readFileSync(P_REISE, 'utf8')));

  const offen: Array<{ tag: string; name: string; hinweis: string; kandidaten: string[] }> = [];
  const bericht = { treffer: 0, offen: 0, uebersprungen: 0 };

  console.log(`Wissen${OFFLINE ? ' (offline)' : ''}${ALL ? ' (alle)' : ''} …`);
  for (const tag of reise.tage) {
    for (const stopp of tag.highlights) {
      if (stopp.wissen && !ALL) {
        bericht.uebersprungen++;
        continue;
      }
      const erg = await aufloesen(stopp);
      if (erg.art === 'offen') {
        bericht.offen++;
        offen.push({ tag: tag.datum, name: stopp.name, hinweis: erg.grund, kandidaten: erg.kandidaten });
        console.log(`  offen  ${stopp.name} — ${erg.grund}`);
        delete (stopp as Record<string, unknown>).wissen;
        continue;
      }
      bericht.treffer++;
      stopp.wissen = {
        text: erg.text,
        quelle: `Wikipedia (de): ${erg.titel}`,
        url: `https://de.wikipedia.org/wiki/${encodeURIComponent(erg.titel.replace(/ /g, '_'))}`,
        geprueftAm: HEUTE,
      };
      console.log(`  ok     ${stopp.name} → ${erg.titel} — ${erg.grund}`);
    }
  }

  if (!DRY) {
    writeFileSync(P_REISE, JSON.stringify(reise, null, 2) + '\n');
    writeFileSync(P_OFFEN, JSON.stringify({ erzeugtAm: HEUTE, eintraege: offen }, null, 2) + '\n');
    if (cacheDirty) writeFileSync(P_CACHE, JSON.stringify(cache, null, 2) + '\n');
  }

  const gesamt = reise.tage.reduce((n, t) => n + t.highlights.length, 0);
  console.log(
    `\n${bericht.treffer + bericht.uebersprungen}/${gesamt} Stopps mit Hintergrundtext · ${bericht.offen} ohne eindeutigen Artikel (siehe data/wissen-offen.json)`,
  );
  if (DRY) console.log('(--dry: nichts geschrieben)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
