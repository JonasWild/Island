/**
 * pnpm bilder — Build-Zeit-Pipeline, nie zur Laufzeit.
 *
 * Sucht zu jedem Stopp ein Bild und legt es mit Urheber und Lizenz als `bild`
 * in reise.json ab. Zwei Wege, in dieser Reihenfolge:
 *
 * 1. **Das Artikelbild.** Hat der Stopp bereits einen eindeutigen
 *    Wikipedia-Artikel aus `pnpm wissen`, wird dessen Leitbild genommen
 *    (`prop=pageimages`). Damit gehören Text und Bild garantiert zum selben
 *    Objekt — der Artikel wurde nach der strengen Regel dort ausgewählt.
 * 2. **Georeferenzierte Bilder auf Commons.** Für Stopps ohne Artikel: die
 *    Geosuche im Umkreis, aber übernommen wird nur ein Treffer, dessen
 *    **Dateiname den Namen des Stopps enthält**. „Stokksnes" hat keinen
 *    eigenen Artikel, aber `File:2008-05-23 24 Stokksnes.jpg` liegt 480 m
 *    entfernt und trägt den Namen — das ist ein Beleg, kein Zufallsfund.
 *
 * Ohne Namensbeleg bleibt der Stopp ohne Bild. Ein hübsches Foto vom
 * Nachbartal ist schlechter als gar keins: es behauptet etwas.
 *
 * Lizenzen kommen aus `extmetadata` von Commons und werden mitgespeichert.
 * Die UI nennt Urheber und Lizenz an jedem Bild — bei CC-BY-SA ist das
 * Bedingung, nicht Höflichkeit.
 *
 * Die Bilder werden **nicht** ins Repo kopiert, sondern von
 * upload.wikimedia.org geladen. Bei fünf Reisenden ist das unbedenklich; die
 * Alternative wären ~70 MB Fotos in der Versionsverwaltung.
 *
 * Flags:
 *   --all       auch Stopps neu abfragen, die bereits ein Bild haben
 *   --offline   nur Cache verwenden, keine Netzaufrufe
 *   --dry       nichts schreiben, nur Bericht
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ReiseSchema, type Stopp } from '../src/lib/schema';

const ROOT = resolve(import.meta.dirname, '..');
const P_REISE = resolve(ROOT, 'data/reise.json');
const P_CACHE = resolve(ROOT, 'data/bilder-cache.json');
const P_OFFEN = resolve(ROOT, 'data/bilder-offen.json');

const UA = 'island-2026-bilder/1.0 (+https://github.com/JonasWild/Island)';
const HEUTE = new Date().toISOString().slice(0, 10);
const API_DE = 'https://de.wikipedia.org/w/api.php';
const API_COMMONS = 'https://commons.wikimedia.org/w/api.php';

const argv = new Set(process.argv.slice(2));
const ALL = argv.has('--all');
const OFFLINE = argv.has('--offline');
const DRY = argv.has('--dry');

/**
 * Nicht jedes Leitbild eines Artikels ist ein Foto des Ortes. Die deutsche
 * Wikipedia setzt bei Gemeinden oft eine Lagekarte oder ein Wappen an den
 * Anfang — `Djupavogshreppur_map.png`, `Iceland_adm_location_map.svg`. Solche
 * Dateien werden verworfen; für den Stopp greift dann die Geosuche, die ein
 * echtes Foto findet.
 */
const KEIN_FOTO =
  /(^|[_\s.-])(map|karte|locator|location|flag|flagge|wappen|coa|coatofarms|logo|diagram|roadsign|siegel|seal)([_\s.-]|$)|\.svg$/i;

/** Suchradius der Commons-Geosuche. Der Namensbeleg ist die eigentliche Schranke. */
const RADIUS_M = 1500;
/** Breite des angeforderten Vorschaubilds. Reicht für das Kontextblatt auf jedem Gerät. */
const BREITE = 800;

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

async function api<T>(basis: string, params: Record<string, string>): Promise<T> {
  const url = new URL(basis);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // Ohne eigenen User-Agent antwortet Wikimedia mit 429.
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** Vergleichsform: ohne Diakritika, ohne Satzzeichen, klein. Wie in wissen.ts. */
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

function suchNamen(name: string): string[] {
  const ohneGattung = name.replace(
    /^(Wanderung|Lange Wanderung|Hof|See|Krater|Strand|Insel|Tunnel|Schlucht|Kap|Maar|Nationalpark|Halbinsel|Lavahöhle|Moorgebiet|Niederung|Ebene des|Freilichtmuseum|Heimatmuseum|Naturbad|Gletscherlagune|Solfatarenfeld|Echofelsen|Vogelschutzreservat|Pseudokrater|Park|Lavafeld|Gletschertunnel)\s+/i,
    '',
  );
  const teile = ohneGattung
    .split(/\s*[&/]\s*|\s+\(|\)/)
    .map((t) => t.trim())
    .filter((t) => t.length > 3);
  return [...new Set([ohneGattung.trim(), ...teile])].filter((t) => t.length > 3);
}

/** `wissen.quelle` hat die Form „Wikipedia (de): Goðafoss". */
function artikelAus(stopp: Stopp): string | null {
  const quelle = stopp.wissen?.quelle;
  if (!quelle) return null;
  const treffer = /^Wikipedia \(de\): (.+)$/.exec(quelle);
  return treffer?.[1] ?? null;
}

type SeiteMitBild = { title: string; pageimage?: string };

/** Leitbild eines Artikels. Batchweise — die API nimmt bis zu 50 Titel. */
async function artikelBilder(titel: string[]): Promise<Map<string, string>> {
  const karte = new Map<string, string>();
  for (let i = 0; i < titel.length; i += 40) {
    const teil = titel.slice(i, i + 40);
    const antwort = await holen(`pageimages:${teil.join('|')}`, async () => {
      const j = await api<{ query?: { pages?: SeiteMitBild[] } }>(API_DE, {
        action: 'query',
        prop: 'pageimages',
        piprop: 'name',
        pilimit: '50',
        redirects: '1',
        titles: teil.join('|'),
      });
      return j.query?.pages ?? [];
    });
    for (const seite of antwort ?? []) {
      if (!seite.pageimage) continue;
      if (KEIN_FOTO.test(seite.pageimage)) continue;
      karte.set(titelSchluessel(seite.title), `File:${titelSchluessel(seite.pageimage)}`);
    }
  }
  return karte;
}

type GeoBild = { title: string; dist: number };

/** Georeferenzierte Bilder im Umkreis — nur Dateien (Namensraum 6). */
async function commonsGeosuche(lat: number, lon: number): Promise<GeoBild[]> {
  const res = await holen(`geo:${lat.toFixed(5)},${lon.toFixed(5)}`, async () => {
    const j = await api<{ query?: { geosearch?: GeoBild[] } }>(API_COMMONS, {
      action: 'query',
      list: 'geosearch',
      gscoord: `${lat}|${lon}`,
      gsradius: String(RADIUS_M),
      gslimit: '50',
      gsnamespace: '6',
    });
    return j.query?.geosearch ?? [];
  });
  return res ?? [];
}

type BildInfo = {
  thumburl?: string;
  thumbwidth?: number;
  thumbheight?: number;
  descriptionurl?: string;
  extmetadata?: Record<string, { value: string }>;
};

/** Vorschau, Urheber und Lizenz einer Commons-Datei. */
async function dateiInfos(dateien: string[]): Promise<Map<string, BildInfo>> {
  const karte = new Map<string, BildInfo>();
  for (let i = 0; i < dateien.length; i += 20) {
    const teil = dateien.slice(i, i + 20);
    const antwort = await holen(`imageinfo:${BREITE}:${teil.join('|')}`, async () => {
      const j = await api<{
        query?: { pages?: Array<{ title: string; imageinfo?: BildInfo[] }> };
      }>(API_COMMONS, {
        action: 'query',
        prop: 'imageinfo',
        iiprop: 'url|extmetadata|size',
        iiurlwidth: String(BREITE),
        titles: teil.join('|'),
      });
      return j.query?.pages ?? [];
    });
    for (const seite of antwort ?? []) {
      const info = seite.imageinfo?.[0];
      if (info) karte.set(titelSchluessel(seite.title), info);
    }
  }
  return karte;
}

/**
 * Wikimedia schreibt Dateititel mit Unterstrichen, gibt sie in Antworten aber
 * mit Leerzeichen zurück. Ohne diese Angleichung findet der Abgleich die
 * gerade selbst abgefragte Datei nicht wieder — und jeder zweite Stopp bliebe
 * grundlos ohne Bild.
 */
function titelSchluessel(titel: string): string {
  return titel.replace(/_/g, ' ');
}

/** `extmetadata` liefert HTML. Für die Anzeige zählt der Text. */
function alsText(html: string | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Das Artist-Feld auf Commons ist Freitext und enthält oft mehr als den Namen:
 * angehängte Lizenzhinweise, Signaturen mit Zeitstempel, ganze Absätze. Für
 * die Nennung zählt der Name; alles dahinter wird abgeschnitten.
 */
function urheberName(roh: string): string {
  let name = roh.split(/\s(?:This file|I, the copyright|Own work|CC[ -]BY)/i)[0]!.trim();
  // Wikipedia-Signaturen: „Speleo 11:33, 21. Okt. 2007".
  name = name.replace(/\s+\d{1,2}:\d{2},.*$/, '').trim();
  if (/no machine[- ]readable author/i.test(name) || name.length === 0) return 'unbekannt';
  if (name.length > 60) name = name.slice(0, 60).replace(/\s+\S*$/, '') + ' …';
  return name;
}

/** Die API hängt Tracking-Parameter an. Die gehören nicht in die Daten. */
function ohneTracking(url: string): string {
  const u = new URL(url);
  u.search = '';
  return u.toString();
}

async function main() {
  const reise = ReiseSchema.parse(JSON.parse(readFileSync(P_REISE, 'utf8')));
  const stopps = reise.tage.flatMap((t) => t.highlights.map((stopp) => ({ tag: t.datum, stopp })));
  const offen: Array<{ tag: string; name: string; hinweis: string }> = [];
  const bericht = { artikel: 0, geo: 0, offen: 0, uebersprungen: 0 };

  console.log(`Bilder${OFFLINE ? ' (offline)' : ''}${ALL ? ' (alle)' : ''} …\n`);

  const zuTun = stopps.filter(({ stopp }) => {
    if (stopp.bild && !ALL) {
      bericht.uebersprungen++;
      return false;
    }
    return stopp.pos !== null;
  });

  // Schritt 1: Leitbilder aller Stopps, die einen Artikel haben — in einem Rutsch.
  const artikelVon = new Map<string, string>();
  for (const { stopp } of zuTun) {
    const titel = artikelAus(stopp);
    if (titel) artikelVon.set(stopp.name, titel);
  }
  const leitbilder = await artikelBilder([...new Set(artikelVon.values())]);

  // Schritt 2: für den Rest die Geosuche, mit Namensbeleg.
  const dateiVon = new Map<string, { datei: string; weg: string }>();
  for (const { stopp } of zuTun) {
    const titel = artikelVon.get(stopp.name);
    const ausArtikel = titel ? leitbilder.get(titelSchluessel(titel)) : undefined;
    if (ausArtikel) {
      dateiVon.set(stopp.name, { datei: ausArtikel, weg: `Leitbild des Artikels „${titel}"` });
      continue;
    }
    if (!stopp.pos) continue;

    const namen = suchNamen(stopp.name).map(normal);
    if (namen.length === 0) continue;
    const treffer = await commonsGeosuche(stopp.pos[0], stopp.pos[1]);
    const passend = treffer.find((t) => {
      if (KEIN_FOTO.test(t.title)) return false;
      const datei = normal(t.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''));
      return namen.some((n) => datei.includes(n));
    });
    if (passend) {
      dateiVon.set(stopp.name, {
        datei: passend.title,
        weg: `georeferenziertes Bild auf Commons, ${Math.round(passend.dist)} m entfernt, Dateiname nennt den Stopp`,
      });
    }
  }

  // Schritt 3: Vorschau und Lizenz zu allen gefundenen Dateien.
  const infos = await dateiInfos([...new Set([...dateiVon.values()].map((v) => v.datei))]);

  for (const { tag, stopp } of zuTun) {
    const fund = dateiVon.get(stopp.name);
    const info = fund ? infos.get(titelSchluessel(fund.datei)) : undefined;

    if (!fund || !info?.thumburl) {
      bericht.offen++;
      offen.push({
        tag,
        name: stopp.name,
        hinweis: fund
          ? `Datei ${fund.datei} liefert keine Vorschau`
          : 'kein Artikelbild und kein georeferenziertes Bild, dessen Dateiname den Stopp nennt',
      });
      delete (stopp as Record<string, unknown>).bild;
      continue;
    }

    const em = info.extmetadata ?? {};
    const lizenz = alsText(em.LicenseShortName?.value) || alsText(em.License?.value);
    const urheber = urheberName(alsText(em.Artist?.value) || alsText(em.Credit?.value));

    // Ohne Lizenzangabe wird nichts eingebunden — ein Bild ohne Lizenz ist
    // kein Bild, das man zeigen darf.
    if (!lizenz) {
      bericht.offen++;
      offen.push({ tag, name: stopp.name, hinweis: `${fund.datei} nennt keine Lizenz` });
      delete (stopp as Record<string, unknown>).bild;
      continue;
    }

    stopp.bild = {
      url: ohneTracking(info.thumburl),
      breite: info.thumbwidth ?? BREITE,
      hoehe: info.thumbheight ?? Math.round(BREITE * 0.66),
      urheber,
      lizenz,
      lizenzUrl: em.LicenseUrl?.value ? alsText(em.LicenseUrl.value) : undefined,
      seite: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(fund.datei)}`,
      quelle: fund.weg,
      geprueftAm: HEUTE,
    };
    if (fund.weg.startsWith('Leitbild')) bericht.artikel++;
    else bericht.geo++;
    console.log(`  ok     ${stopp.name} → ${fund.datei} (${lizenz})`);
  }

  for (const e of offen) console.log(`  offen  ${e.name} — ${e.hinweis}`);

  if (!DRY) {
    writeFileSync(P_REISE, JSON.stringify(reise, null, 2) + '\n');
    writeFileSync(P_OFFEN, JSON.stringify({ erzeugtAm: HEUTE, eintraege: offen }, null, 2) + '\n');
    if (cacheDirty) writeFileSync(P_CACHE, JSON.stringify(cache, null, 2) + '\n');
  }

  const gesamt = stopps.length;
  const mitBild = reise.tage.reduce((n, t) => n + t.highlights.filter((h) => h.bild).length, 0);
  console.log(
    `\n${mitBild}/${gesamt} Stopps mit Bild — ${bericht.artikel} aus dem Artikel, ${bericht.geo} über die Geosuche, ${bericht.offen} ohne Beleg (siehe data/bilder-offen.json)`,
  );
  if (DRY) console.log('(--dry: nichts geschrieben)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
