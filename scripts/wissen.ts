/**
 * pnpm wissen — Build-Zeit-Pipeline, nie zur Laufzeit.
 *
 * Holt zu jedem Stopp den Artikeltext aus der deutschen Wikipedia und legt
 * ihn als `wissen` in reise.json ab. Das ersetzt das LLM: nachprüfbarer Text
 * mit Quelle und Link statt einer generierten Antwort, die niemand belegen
 * kann.
 *
 * Übernommen wird die **Einleitung und die ersten Sachabschnitte** — nicht
 * nur der erste Absatz. Die Einleitung der deutschen Wikipedia ist oft ein
 * einziger Satz („Der Goðafoss ist einer der bekanntesten Wasserfälle
 * Islands."); das Interessante steht darunter, in `Lage`, `Namensgebung`,
 * `Geschichte`. Genau das will man am Wasserfall stehend lesen.
 *
 * Verzeichnisse bleiben draussen: `Weblinks`, `Literatur`,
 * `Einzelnachweise`, `Siehe auch`, `Bilder` und Verwandte sind Apparat, kein
 * Inhalt.
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
 * Wie viel Artikel ins Kontextblatt darf. 700 Zeichen waren ein Absatz und
 * endeten oft mitten im Thema — bei einem Wasserfall die Höhe, nicht aber,
 * warum er heisst, wie er heisst. 1600 tragen Einleitung und ein bis zwei
 * Abschnitte; der Link führt weiterhin auf den vollständigen Artikel.
 */
const MAX_ZEICHEN = 1600;
/** So viele Abschnitte unter der Einleitung. Mehr liest im Auto niemand. */
const MAX_ABSCHNITTE = 3;
/**
 * Abschnitte, die kein Inhalt sind, sondern Apparat. Die Namen sind die der
 * deutschen Wikipedia; Kleinschreibung und Klammerzusätze werden vorher
 * entfernt.
 */
const KEIN_INHALT =
  /^(siehe auch|weblinks?|literatur|einzelnachweise?|quellen|belege|anmerkungen|fussnoten|fußnoten|bilder|galerie|bildergalerie|panorama|filme?|weiterfuhrende literatur|trivia|sonstiges|karten)$/i;

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
  // v2 ist der Volltext mit Überschriften (`== Lage ==`), nicht mehr nur die
  // Einleitung. Eigener Schlüssel, damit der alte Cache nicht dazwischenfunkt.
  const res = await holen(`volltext:${titel}`, async () => {
    const j = await api<{ query?: { pages?: Seite[] } }>({
      action: 'query',
      prop: 'extracts|pageprops',
      explaintext: '1',
      exsectionformat: 'wiki',
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

/**
 * Absatzweise säubern: Zeilenumbrüche innerhalb eines Absatzes sind Satzfluss.
 * Verweiszeilen fliegen raus — `→siehe: Liste von Schiffen …` und
 * `→ Hauptartikel: …` sind Navigation der Wikipedia, kein Satz über den Ort.
 */
function absaetze(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((a) => a.replace(/\s+/g, ' ').trim())
    .filter((a) => a.length > 0 && !a.startsWith('→'));
}

/** Auf ganze Sätze kürzen — ein abgeschnittener Halbsatz liest sich wie ein Fehler. */
function kuerzen(text: string, grenze: number): string {
  if (text.length <= grenze) return text;
  const schnitt = text.slice(0, grenze);
  const ende = Math.max(schnitt.lastIndexOf('. '), schnitt.lastIndexOf('! '), schnitt.lastIndexOf('? '));
  return ende > grenze * 0.4 ? schnitt.slice(0, ende + 1) : schnitt.trimEnd() + ' …';
}

type Abschnitt = { titel: string; text: string };

/**
 * Den Volltext in Einleitung und Abschnitte zerlegen. `exsectionformat=wiki`
 * markiert Überschriften als `== Titel ==`; tiefere Ebenen (`=== … ===`)
 * werden zu Absätzen ihres Abschnitts, denn drei Gliederungsebenen sind für
 * ein Kontextblatt eine Ebene zu viel.
 *
 * Die Gesamtlänge ist gedeckelt: erst die Einleitung, dann so viele
 * Abschnitte, wie noch hineinpassen. Ein Abschnitt, der nur noch angerissen
 * würde, bleibt ganz draussen — angefangene Absätze sind schlechter als keine.
 */
function gliedern(volltext: string): { text: string; abschnitte: Abschnitt[] } {
  const zeilen = volltext.split('\n');
  const teile: Array<{ titel: string | null; zeilen: string[] }> = [{ titel: null, zeilen: [] }];
  for (const zeile of zeilen) {
    const ueberschrift = /^\s*(={2,6})\s*(.+?)\s*\1\s*$/.exec(zeile);
    if (ueberschrift && ueberschrift[1]!.length === 2) {
      teile.push({ titel: ueberschrift[2]!.trim(), zeilen: [] });
    } else if (ueberschrift) {
      // Unterüberschrift: als eigener Absatz behalten, sie trägt Bedeutung.
      teile[teile.length - 1]!.zeilen.push('', `${ueberschrift[2]!.trim()}:`, '');
    } else {
      teile[teile.length - 1]!.zeilen.push(zeile);
    }
  }

  const einleitung = absaetze(teile[0]!.zeilen.join('\n'));
  let rest = MAX_ZEICHEN;
  const text: string[] = [];
  for (const absatz of einleitung) {
    if (absatz.length > rest) {
      if (text.length === 0) text.push(kuerzen(absatz, rest));
      break;
    }
    text.push(absatz);
    rest -= absatz.length + 2;
  }

  const abschnitte: Abschnitt[] = [];
  for (const teil of teile.slice(1)) {
    if (abschnitte.length >= MAX_ABSCHNITTE) break;
    const titel = teil.titel!;
    if (KEIN_INHALT.test(titel.replace(/\s*\(.*\)\s*$/, '').trim())) continue;
    const inhalt = absaetze(teil.zeilen.join('\n')).join('\n\n');
    // Leere Abschnitte gibt es wirklich: „== Bilder ==" trägt nur eine Galerie.
    if (inhalt.length < 80) continue;
    // Bleibt kein Platz für einen ganzen Gedanken, hört der Text hier auf.
    if (rest < 200) break;
    const gekuerzt = kuerzen(inhalt, rest);
    abschnitte.push({ titel, text: gekuerzt });
    rest -= gekuerzt.length + titel.length + 2;
  }

  return { text: text.join('\n\n'), abschnitte };
}

type Ergebnis =
  | { art: 'treffer'; titel: string; text: string; abschnitte: Abschnitt[]; grund: string }
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

  const { text, abschnitte } = gliedern(seite.extract);
  if (!text) {
    return { art: 'offen', grund: `Artikel "${gewaehlt.title}" hat keinen Einleitungstext`, kandidaten: [] };
  }
  return { art: 'treffer', titel: seite.title, text, abschnitte, grund };
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
        abschnitte: erg.abschnitte,
        quelle: `Wikipedia (de): ${erg.titel}`,
        url: `https://de.wikipedia.org/wiki/${encodeURIComponent(erg.titel.replace(/ /g, '_'))}`,
        geprueftAm: HEUTE,
      };
      // Ein leerer Schlüssel ist Rauschen in der Datei; das Schema setzt ihn
      // beim Laden ohnehin auf [].
      if (erg.abschnitte.length === 0) delete (stopp.wissen as Record<string, unknown>).abschnitte;
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
