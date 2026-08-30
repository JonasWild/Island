/**
 * pnpm bilder — Build-Zeit-Pipeline, nie zur Laufzeit.
 *
 * Sucht zu jedem Stopp **mehrere** Bilder und legt sie mit Urheber und Lizenz
 * als `bilder` in reise.json ab. Das erste ist das Leitbild: Es steht in der
 * Vorschau-Blase und im Tagesablauf, die übrigen bilden im Kontextblatt einen
 * Streifen zum Durchblättern.
 *
 * Ein Bild ist ein Beleg, kein Schmuck. Vier Quellen, in dieser Reihenfolge:
 *
 * 1. **Das Leitbild des Artikels.** Hat der Stopp einen eindeutigen
 *    Wikipedia-Artikel aus `pnpm wissen`, ist dessen `pageimage` gesetzt —
 *    von den Autoren des Artikels ausgewählt. Das ist der einzige Fall, in
 *    dem der Dateiname nichts beweisen muss.
 * 2. **Weitere Bilder aus demselben Artikel** (`prop=images`).
 * 3. **Die Commons-Kategorie** des Artikels (über Wikidata P373).
 * 4. **Georeferenzierte Bilder** im Umkreis (Commons-Geosuche).
 *
 * Für 2 bis 4 gilt dieselbe Schranke wie bisher: Der **Dateiname muss den
 * Stopp nennen**. Das ist nötig, weil alle drei Quellen Fremdes mitführen —
 * im Artikel Goðafoss steckt ein Bild der Kirche von Akureyri, in seiner
 * Commons-Kategorie liegen Fotos des Sees Ljósavatn. Ohne Namensbeleg wäre
 * das ein hübsches Foto vom Nachbartal, das etwas behauptet.
 *
 * Lizenzen kommen aus `extmetadata` von Commons und werden mitgespeichert.
 * Die UI nennt Urheber und Lizenz an jedem Bild — bei CC-BY-SA ist das
 * Bedingung, nicht Höflichkeit. Ebenfalls von dort kommt die
 * Bildbeschreibung: Sie sagt, was auf **diesem** Bild zu sehen ist, und wird
 * nur übernommen, wenn sie in lateinischer Schrift vorliegt — eine hebräische
 * oder kyrillische Bildunterschrift hilft dieser Reisegruppe nicht.
 *
 * Die Bilder werden **nicht** ins Repo kopiert, sondern von
 * upload.wikimedia.org geladen. Bei fünf Reisenden ist das unbedenklich; die
 * Alternative wären mehrere hundert MB Fotos in der Versionsverwaltung.
 *
 * Flags:
 *   --all       auch Stopps neu abfragen, die bereits Bilder haben
 *   --offline   nur Cache verwenden, keine Netzaufrufe
 *   --dry       nichts schreiben, nur Bericht
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ReiseSchema, type Bild, type Stopp } from '../src/lib/schema';

const ROOT = resolve(import.meta.dirname, '..');
const P_REISE = resolve(ROOT, 'data/reise.json');
const P_CACHE = resolve(ROOT, 'data/bilder-cache.json');
const P_OFFEN = resolve(ROOT, 'data/bilder-offen.json');

const UA = 'island-2026-bilder/1.0 (+https://github.com/JonasWild/Island)';
const HEUTE = new Date().toISOString().slice(0, 10);
const API_DE = 'https://de.wikipedia.org/w/api.php';
const API_COMMONS = 'https://commons.wikimedia.org/w/api.php';
const API_WIKIDATA = 'https://www.wikidata.org/w/api.php';

const argv = new Set(process.argv.slice(2));
const ALL = argv.has('--all');
const OFFLINE = argv.has('--offline');
const DRY = argv.has('--dry');

/**
 * Nicht jedes Bild in einem Artikel ist ein Foto des Ortes. Die deutsche
 * Wikipedia setzt bei Gemeinden oft eine Lagekarte oder ein Wappen an den
 * Anfang — `Djupavogshreppur_map.png`, `Iceland_adm_location_map.svg` —, und
 * jeder Artikel schleppt Symbole wie `Blue_pog.svg` mit. Solche Dateien
 * werden verworfen.
 */
const KEIN_FOTO =
  /(^|[_\s.-])(map|karte|locator|location|flag|flagge|wappen|coa|coatofarms|logo|diagram|roadsign|siegel|seal|pog|icon|symbol|disambig|commons)([_\s.-]|$)|\.svg$/i;

/** Nur Fotos. Videos und Tondateien liegen in denselben Kategorien. */
const FOTO_ENDUNG = /\.(jpe?g|png|tiff?)$/i;

/** Suchradius der Commons-Geosuche. Der Namensbeleg ist die eigentliche Schranke. */
const RADIUS_M = 1500;
/** Breite des angeforderten Vorschaubilds. Reicht für das Kontextblatt auf jedem Gerät. */
const BREITE = 800;
/**
 * So viele Bilder je Stopp. Sechs sind genug, um einen Ort von mehreren
 * Seiten zu zeigen; jedes weitere kostet Ladezeit im Auto und wird ohnehin
 * nicht mehr durchgewischt.
 */
const MAX_BILDER = 6;
/** So viele Kandidaten werden geprüft — manche fallen an Lizenz oder Grösse. */
const MAX_KANDIDATEN = 14;
/**
 * Höchstens so viele Bilder je Urheber. Wer einmal an der Blauen Lagune
 * stand, hat dort zwanzig Aufnahmen gemacht und alle hochgeladen — sechs
 * davon nebeneinander sind kein Streifen, sondern eine Wiederholung.
 */
const MAX_JE_URHEBER = 2;
/**
 * Unterhalb dieser Originalbreite ist ein Foto ein Vorschaubildchen. Im
 * Streifen stünde es unscharf neben scharfen Nachbarn.
 */
const MIN_BREITE = 800;
/**
 * Bildbeschreibungen kommen aus Commons und sind Freitext — von einem Satz
 * bis zu drei Absätzen Kameratechnik. Für die Zeile unter dem Bild zählt der
 * erste Satz.
 */
const MAX_BESCHREIBUNG = 180;

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

/**
 * Wikimedia schreibt Dateititel mit Unterstrichen, gibt sie in Antworten aber
 * mit Leerzeichen zurück. Ohne diese Angleichung findet der Abgleich die
 * gerade selbst abgefragte Datei nicht wieder — und jeder zweite Stopp bliebe
 * grundlos ohne Bild.
 */
function titelSchluessel(titel: string): string {
  return titel.replace(/_/g, ' ');
}

/** Die deutsche Wikipedia nennt den Dateinamensraum „Datei:", Commons „File:". */
function alsCommonsTitel(titel: string): string {
  return titelSchluessel(titel).replace(/^(Datei|Image|Bild):/i, 'File:');
}

/** Trägt der Dateiname den Namen des Stopps? Das ist der Beleg. */
function nenntStopp(dateititel: string, namen: string[]): boolean {
  const datei = normal(alsCommonsTitel(dateititel).replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''));
  return namen.some((n) => datei.includes(n));
}

function istFoto(titel: string): boolean {
  const datei = alsCommonsTitel(titel).replace(/^File:/, '');
  return FOTO_ENDUNG.test(datei) && !KEIN_FOTO.test(datei);
}

type SeiteMitBild = { title: string; pageimage?: string };

/** Leitbild eines Artikels. Batchweise — die API nimmt bis zu 50 Titel. */
async function artikelLeitbilder(titel: string[]): Promise<Map<string, string>> {
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
      if (!istFoto(seite.pageimage)) continue;
      karte.set(titelSchluessel(seite.title), `File:${titelSchluessel(seite.pageimage)}`);
    }
  }
  return karte;
}

type SeiteMitBildern = { title: string; images?: Array<{ title: string }>; pageprops?: Record<string, string> };

/** Alle Dateien, die im Artikel vorkommen — samt Wikidata-ID für die Kategorie. */
async function artikelInhalt(
  titel: string[],
): Promise<{ dateien: Map<string, string[]>; wikidata: Map<string, string> }> {
  const dateien = new Map<string, string[]>();
  const wikidata = new Map<string, string>();
  for (let i = 0; i < titel.length; i += 20) {
    const teil = titel.slice(i, i + 20);
    const antwort = await holen(`artikelbilder:${teil.join('|')}`, async () => {
      const j = await api<{ query?: { pages?: SeiteMitBildern[] } }>(API_DE, {
        action: 'query',
        prop: 'images|pageprops',
        imlimit: '100',
        redirects: '1',
        titles: teil.join('|'),
      });
      return j.query?.pages ?? [];
    });
    for (const seite of antwort ?? []) {
      const schluessel = titelSchluessel(seite.title);
      dateien.set(schluessel, (seite.images ?? []).map((b) => alsCommonsTitel(b.title)));
      const id = seite.pageprops?.wikibase_item;
      if (id) wikidata.set(schluessel, id);
    }
  }
  return { dateien, wikidata };
}

/**
 * Die Commons-Kategorie eines Objekts steht in Wikidata als P373. Sie ist der
 * kuratierte Bilderordner zum Artikel — ergiebiger als der Artikel selbst,
 * der nur zwei, drei Bilder zeigt.
 */
async function commonsKategorien(ids: string[]): Promise<Map<string, string>> {
  const karte = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 40) {
    const teil = ids.slice(i, i + 40);
    const antwort = await holen(`wikidata-p373:${teil.join('|')}`, async () => {
      const j = await api<{
        entities?: Record<string, { claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: string } } }>> }>;
      }>(API_WIKIDATA, { action: 'wbgetentities', props: 'claims', ids: teil.join('|') });
      const raus: Record<string, string> = {};
      for (const [id, e] of Object.entries(j.entities ?? {})) {
        const wert = e.claims?.P373?.[0]?.mainsnak?.datavalue?.value;
        if (typeof wert === 'string') raus[id] = wert;
      }
      return raus;
    });
    for (const [id, kat] of Object.entries(antwort ?? {})) karte.set(id, kat);
  }
  return karte;
}

/** Die Dateien einer Commons-Kategorie. */
async function kategorieDateien(kategorie: string): Promise<string[]> {
  const res = await holen(`kategorie:${kategorie}`, async () => {
    const j = await api<{ query?: { categorymembers?: Array<{ title: string }> } }>(API_COMMONS, {
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${kategorie}`,
      cmtype: 'file',
      cmlimit: '100',
    });
    return (j.query?.categorymembers ?? []).map((m) => m.title);
  });
  return res ?? [];
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
  width?: number;
  descriptionurl?: string;
  extmetadata?: Record<string, { value: string }>;
};

/**
 * Vorschau, Urheber, Lizenz und Beschreibung einer Commons-Datei.
 * `iiextmetadatalanguage=de` holt die deutsche Beschreibung, wo es eine gibt.
 */
async function dateiInfos(dateien: string[]): Promise<Map<string, BildInfo>> {
  const karte = new Map<string, BildInfo>();
  for (let i = 0; i < dateien.length; i += 20) {
    const teil = dateien.slice(i, i + 20);
    // v2: mit Originalgrösse und deutscher Beschreibung — der alte
    // Cache-Schlüssel trug beides nicht.
    const antwort = await holen(`imageinfo:v2:${BREITE}:${teil.join('|')}`, async () => {
      const j = await api<{
        query?: { pages?: Array<{ title: string; imageinfo?: BildInfo[] }> };
      }>(API_COMMONS, {
        action: 'query',
        prop: 'imageinfo',
        iiprop: 'url|extmetadata|size',
        iiurlwidth: String(BREITE),
        iiextmetadatalanguage: 'de',
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

/**
 * Die Bildunterschrift aus Commons. Übernommen wird nur, was auch lesbar ist:
 * lateinische Schrift, kein Dateiname, keine Kameratechnik-Absätze. Sonst
 * steht unter dem Bild lieber nichts.
 */
function beschreibungAus(roh: string, dateiname: string): string | undefined {
  const text = alsText(roh);
  if (!text) return undefined;
  // Nicht-lateinische Schriften (hebräisch, kyrillisch, CJK) helfen hier niemandem.
  if (/[Ͱ-᳿　-鿿가-힯]/.test(text)) return undefined;
  // Manche Beschreibungen wiederholen nur den Dateinamen.
  if (normal(text) === normal(dateiname.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''))) return undefined;
  const erster = text.split(/(?<=[.!?])\s+/)[0]!.trim();
  const kurz = erster.length > MAX_BESCHREIBUNG ? erster.slice(0, MAX_BESCHREIBUNG).replace(/\s+\S*$/, '') + ' …' : erster;
  return kurz.length > 3 ? kurz : undefined;
}

/** Die API hängt Tracking-Parameter an. Die gehören nicht in die Daten. */
function ohneTracking(url: string): string {
  const u = new URL(url);
  u.search = '';
  return u.toString();
}

type Kandidat = { datei: string; weg: string };

async function main() {
  const reise = ReiseSchema.parse(JSON.parse(readFileSync(P_REISE, 'utf8')));
  const stopps = reise.tage.flatMap((t) => t.highlights.map((stopp) => ({ tag: t.datum, stopp })));
  const offen: Array<{ tag: string; name: string; hinweis: string }> = [];
  const bericht = { artikel: 0, geo: 0, kategorie: 0, offen: 0, uebersprungen: 0 };

  console.log(`Bilder${OFFLINE ? ' (offline)' : ''}${ALL ? ' (alle)' : ''} …\n`);

  const zuTun = stopps.filter(({ stopp }) => {
    if (stopp.bilder.length > 0 && !ALL) {
      bericht.uebersprungen++;
      return false;
    }
    return stopp.pos !== null;
  });

  // Schritt 1: Artikel der Stopps, die einen haben — Leitbild, Bilder im
  // Artikel und die Wikidata-ID für die Commons-Kategorie, alles batchweise.
  const artikelVon = new Map<string, string>();
  for (const { stopp } of zuTun) {
    const titel = artikelAus(stopp);
    if (titel) artikelVon.set(stopp.name, titel);
  }
  const artikel = [...new Set(artikelVon.values())];
  const leitbilder = await artikelLeitbilder(artikel);
  const { dateien: artikelDateien, wikidata } = await artikelInhalt(artikel);
  const kategorien = await commonsKategorien([...new Set(wikidata.values())]);

  // Schritt 2: je Stopp eine Kandidatenliste in der Reihenfolge der Belegkraft.
  const kandidatenVon = new Map<string, Kandidat[]>();
  for (const { stopp } of zuTun) {
    const namen = suchNamen(stopp.name).map(normal);
    const liste: Kandidat[] = [];
    const gesehen = new Set<string>();
    const dazu = (datei: string, weg: string) => {
      const schluessel = titelSchluessel(datei);
      if (gesehen.has(schluessel) || liste.length >= MAX_KANDIDATEN) return;
      gesehen.add(schluessel);
      liste.push({ datei: schluessel, weg });
    };

    const titel = artikelVon.get(stopp.name);
    const artikelSchluessel = titel ? titelSchluessel(titel) : null;

    if (artikelSchluessel) {
      const leitbild = leitbilder.get(artikelSchluessel);
      if (leitbild) dazu(leitbild, `Leitbild des Artikels „${titel}"`);

      for (const datei of artikelDateien.get(artikelSchluessel) ?? []) {
        if (!istFoto(datei) || !nenntStopp(datei, namen)) continue;
        dazu(datei, `Bild im Artikel „${titel}", Dateiname nennt den Stopp`);
      }

      const id = wikidata.get(artikelSchluessel);
      const kategorie = id ? kategorien.get(id) : undefined;
      if (kategorie) {
        for (const datei of await kategorieDateien(kategorie)) {
          if (!istFoto(datei) || !nenntStopp(datei, namen)) continue;
          dazu(datei, `Commons-Kategorie „${kategorie}", Dateiname nennt den Stopp`);
        }
      }
    }

    if (stopp.pos && namen.length > 0) {
      for (const treffer of await commonsGeosuche(stopp.pos[0], stopp.pos[1])) {
        if (!istFoto(treffer.title) || !nenntStopp(treffer.title, namen)) continue;
        dazu(
          treffer.title,
          `georeferenziertes Bild auf Commons, ${Math.round(treffer.dist)} m entfernt, Dateiname nennt den Stopp`,
        );
      }
    }

    if (liste.length > 0) kandidatenVon.set(stopp.name, liste);
  }

  // Schritt 3: Vorschau, Lizenz und Beschreibung zu allen Kandidaten.
  const alleDateien = [...new Set([...kandidatenVon.values()].flat().map((k) => k.datei))];
  const infos = await dateiInfos(alleDateien);

  for (const { tag, stopp } of zuTun) {
    const kandidaten = kandidatenVon.get(stopp.name) ?? [];
    const gueltig: Bild[] = [];
    const gruende: string[] = [];

    for (const kandidat of kandidaten) {
      const info = infos.get(titelSchluessel(kandidat.datei));
      if (!info?.thumburl) {
        gruende.push(`${kandidat.datei}: keine Vorschau`);
        continue;
      }
      if ((info.width ?? 0) < MIN_BREITE) {
        gruende.push(`${kandidat.datei}: nur ${info.width} px breit`);
        continue;
      }
      const em = info.extmetadata ?? {};
      const lizenz = alsText(em.LicenseShortName?.value) || alsText(em.License?.value);
      // Ohne Lizenzangabe wird nichts eingebunden — ein Bild ohne Lizenz ist
      // kein Bild, das man zeigen darf.
      if (!lizenz) {
        gruende.push(`${kandidat.datei}: nennt keine Lizenz`);
        continue;
      }
      gueltig.push({
        url: ohneTracking(info.thumburl),
        breite: info.thumbwidth ?? BREITE,
        hoehe: info.thumbheight ?? Math.round(BREITE * 0.66),
        urheber: urheberName(alsText(em.Artist?.value) || alsText(em.Credit?.value)),
        lizenz,
        lizenzUrl: em.LicenseUrl?.value ? alsText(em.LicenseUrl.value) : undefined,
        seite:
          info.descriptionurl ??
          `https://commons.wikimedia.org/wiki/${encodeURIComponent(kandidat.datei)}`,
        beschreibung: beschreibungAus(em.ImageDescription?.value ?? '', kandidat.datei),
        quelle: kandidat.weg,
        geprueftAm: HEUTE,
      });
    }

    // Reihenfolge bleibt die der Belegkraft, aber kein Urheber stellt mehr
    // als zwei Bilder: Sechs Aufnahmen desselben Fotografen vom selben
    // Standpunkt zeigen den Ort nicht besser als zwei.
    const bilder: Bild[] = [];
    const jeUrheber = new Map<string, number>();
    for (const bild of gueltig) {
      if (bilder.length >= MAX_BILDER) break;
      const wer = normal(bild.urheber);
      const bisher = jeUrheber.get(wer) ?? 0;
      if (wer !== 'unbekannt' && bisher >= MAX_JE_URHEBER) continue;
      jeUrheber.set(wer, bisher + 1);
      bilder.push(bild);
      if (bild.quelle.startsWith('Leitbild') || bild.quelle.startsWith('Bild im Artikel')) bericht.artikel++;
      else if (bild.quelle.startsWith('Commons-Kategorie')) bericht.kategorie++;
      else bericht.geo++;
    }

    if (bilder.length === 0) {
      bericht.offen++;
      offen.push({
        tag,
        name: stopp.name,
        hinweis:
          gruende.length > 0
            ? `kein brauchbarer Kandidat — ${gruende.join('; ')}`
            : 'kein Artikelbild und kein Bild, dessen Dateiname den Stopp nennt',
      });
      delete (stopp as Record<string, unknown>).bilder;
      continue;
    }

    stopp.bilder = bilder;
    console.log(
      `  ok     ${stopp.name} → ${bilder.length} Bild${bilder.length === 1 ? '' : 'er'} (${bilder.map((b) => b.lizenz).join(', ')})`,
    );
  }

  for (const e of offen) console.log(`  offen  ${e.name} — ${e.hinweis}`);

  if (!DRY) {
    writeFileSync(P_REISE, JSON.stringify(reise, null, 2) + '\n');
    writeFileSync(P_OFFEN, JSON.stringify({ erzeugtAm: HEUTE, eintraege: offen }, null, 2) + '\n');
    if (cacheDirty) writeFileSync(P_CACHE, JSON.stringify(cache, null, 2) + '\n');
  }

  const gesamt = stopps.length;
  const alleBilder = reise.tage.flatMap((t) => t.highlights.map((h) => (h.bilder ?? []).length));
  const mitBild = alleBilder.filter((n) => n > 0).length;
  const summe = alleBilder.reduce((a, b) => a + b, 0);
  const mehrere = alleBilder.filter((n) => n > 1).length;
  console.log(
    `\n${mitBild}/${gesamt} Stopps mit Bild, ${summe} Bilder insgesamt, ${mehrere} Stopps zum Durchblättern`,
  );
  console.log(
    `  ${bericht.artikel} aus dem Artikel, ${bericht.kategorie} aus der Commons-Kategorie, ${bericht.geo} über die Geosuche, ${bericht.offen} Stopps ohne Beleg (siehe data/bilder-offen.json)`,
  );
  if (DRY) console.log('(--dry: nichts geschrieben)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
