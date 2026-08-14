/**
 * pnpm bilder — sucht zu jedem Stopp ein Foto, Build-Zeit, nie zur Laufzeit.
 *
 * Quelle ist die Geosuche der deutschen Wikipedia (Rückfall: englische) im
 * Umkreis der belegten Position, plus die Lizenzangaben des Bildes aus
 * Commons. Übernommen wird nur, was eindeutig zum Stopp gehört:
 *
 *   - Artikeltitel und Stoppname müssen zueinander passen, ODER
 *   - der Artikel liegt näher als 400 m und ist der einzige mit Bild.
 *
 * Sonst bleibt der Stopp ohne Bild. Ein falsches Foto ist schlimmer als keins.
 *
 * Antworten landen in data/bilder-cache.json und werden mitcommittet.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ReiseSchema, type Bild, type Pos } from '../src/lib/schema';

const ROOT = resolve(import.meta.dirname, '..');
const P_REISE = resolve(ROOT, 'data/reise.json');
const P_CACHE = resolve(ROOT, 'data/bilder-cache.json');

const UA = 'island-2026-bilder/1.0 (+https://github.com/JonasWild/Island)';
const HEUTE = new Date().toISOString().slice(0, 10);
const ALL = process.argv.includes('--all');
const RADIUS_M = 3000;
const NAH_M = 400;

const cache: Record<string, unknown> = existsSync(P_CACHE)
  ? JSON.parse(readFileSync(P_CACHE, 'utf8'))
  : {};
let cacheDirty = false;

const schlaf = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function holen<T>(schluessel: string, lader: () => Promise<T>): Promise<T | null> {
  if (schluessel in cache) return cache[schluessel] as T;
  try {
    const wert = await lader();
    cache[schluessel] = wert;
    cacheDirty = true;
    await schlaf(300);
    return wert;
  } catch (err) {
    console.warn(`  ! ${schluessel}: ${(err as Error).message}`);
    return null;
  }
}

async function api(host: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = new URL(`https://${host}/w/api.php`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as Record<string, unknown>;
}

type Seite = {
  title: string;
  thumbnail?: { source: string; width: number; height: number };
  pageimage?: string;
  coordinates?: Array<{ lat: number; lon: number; dist?: number }>;
};

/** Namen vergleichbar machen: ohne Gattungswort, ohne Zusätze, ohne Diakritika. */
function normalisieren(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(
      /\b(wanderung|lange wanderung|hof|see|krater|pseudokrater|strand|insel|tunnel|schlucht|kap|maar|nationalpark|halbinsel|lavahöhle|lavafeld|moorgebiet|niederung|ebene des|freilichtmuseum|heimatmuseum|naturbad|gletscherlagune|gletschertunnel|solfatarenfeld|echofelsen|vogelschutzreservat|park|reiterhof|hot pot)\b/g,
      ' ',
    )
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function passtZuName(stoppName: string, artikel: string): boolean {
  const a = normalisieren(stoppName);
  const b = normalisieren(artikel);
  if (a.length < 4 || b.length < 4) return false;
  return a.includes(b) || b.includes(a);
}

async function seitenUm(host: string, pos: Pos): Promise<Seite[]> {
  const res = await holen(`geo:${host}:${pos[0].toFixed(4)},${pos[1].toFixed(4)}`, () =>
    api(host, {
      action: 'query',
      generator: 'geosearch',
      ggscoord: `${pos[0]}|${pos[1]}`,
      ggsradius: String(RADIUS_M),
      ggslimit: '10',
      prop: 'pageimages|coordinates',
      piprop: 'thumbnail|name',
      pithumbsize: '900',
      codistancefrompoint: `${pos[0]}|${pos[1]}`,
    }),
  );
  const pages = (res?.query as { pages?: Seite[] } | undefined)?.pages;
  return Array.isArray(pages) ? pages : [];
}

type Lizenz = { autor?: string; lizenz?: string; beschreibung?: string };

async function lizenzVon(dateiname: string): Promise<Lizenz> {
  const res = await holen(`lic:${dateiname}`, () =>
    api('commons.wikimedia.org', {
      action: 'query',
      titles: `File:${dateiname}`,
      prop: 'imageinfo',
      iiprop: 'extmetadata',
      iiextmetadatafilter: 'Artist|LicenseShortName|ImageDescription',
    }),
  );
  const pages = (res?.query as { pages?: Array<{ imageinfo?: Array<{ extmetadata?: Record<string, { value?: string }> }> }> })?.pages;
  const meta = pages?.[0]?.imageinfo?.[0]?.extmetadata;
  const text = (v?: string) =>
    v
      ? v
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 120)
      : undefined;
  return {
    autor: text(meta?.Artist?.value),
    lizenz: text(meta?.LicenseShortName?.value),
    beschreibung: text(meta?.ImageDescription?.value),
  };
}

async function bildFuer(name: string, pos: Pos): Promise<Bild | null> {
  for (const host of ['de.wikipedia.org', 'en.wikipedia.org']) {
    const seiten = (await seitenUm(host, pos)).filter((s) => s.thumbnail?.source);
    if (seiten.length === 0) continue;

    const nachName = seiten.find((s) => passtZuName(name, s.title));
    const nah = seiten.filter((s) => (s.coordinates?.[0]?.dist ?? Infinity) <= NAH_M);
    const treffer = nachName ?? (nah.length === 1 ? nah[0] : undefined);
    if (!treffer?.thumbnail) continue;

    // pageimage fehlt manchmal; der Dateiname steckt aber immer im Thumb-Pfad
    // (.../commons/thumb/a/ab/DATEI.jpg/900px-DATEI.jpg).
    const ausUrl = decodeURIComponent(
      treffer.thumbnail.source.split('?')[0]!.split('/thumb/')[1]?.split('/').slice(2, 3)[0] ?? '',
    );
    const datei = treffer.pageimage ?? ausUrl;
    const lizenz = datei ? await lizenzVon(datei) : {};
    return {
      url: treffer.thumbnail.source.split('?')[0]!,
      titel: treffer.title,
      seite: `https://${host}/wiki/${encodeURIComponent(treffer.title.replace(/ /g, '_'))}`,
      autor: lizenz.autor,
      lizenz: lizenz.lizenz,
      geprueftAm: HEUTE,
      grund: nachName ? 'Artikelname passt zum Stopp' : `einziger Artikel mit Bild unter ${NAH_M} m`,
    };
  }
  return null;
}

async function main() {
  const reise = ReiseSchema.parse(JSON.parse(readFileSync(P_REISE, 'utf8')));
  let gefunden = 0;
  let ohne = 0;

  for (const tag of reise.tage) {
    for (const stopp of tag.highlights) {
      if (!stopp.pos) continue;
      if (stopp.bild && !ALL) continue;
      const bild = await bildFuer(stopp.name, stopp.pos);
      if (bild) {
        stopp.bild = bild;
        gefunden++;
        console.log(`  + ${stopp.name} → ${bild.titel}`);
      } else {
        ohne++;
      }
    }
  }
  for (const u of reise.unterkuenfte) {
    if (!u.pos || (u.bild && !ALL)) continue;
    const bild = await bildFuer(u.name, u.pos);
    if (bild) {
      u.bild = bild;
      gefunden++;
    }
  }

  writeFileSync(P_REISE, JSON.stringify(reise, null, 2) + '\n');
  if (cacheDirty) writeFileSync(P_CACHE, JSON.stringify(cache, null, 2) + '\n');
  console.log(`\n${gefunden} Bilder zugeordnet, ${ohne} Stopps ohne Bild.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
