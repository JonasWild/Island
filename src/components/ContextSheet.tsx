'use client';

import { useMapStore } from '@/store/mapStore';
import { alleStopps, buchungSatz, datumKurz, unterkunftNach } from '@/lib/reise';
import { KATEGORIE_LABEL, kategorieVon } from '@/lib/kategorie';
import { kategorieFarbe } from '@/map/icons';
import { formatKoordinate } from '@/lib/geo';
import { Bilderstreifen } from './Bilderstreifen';
import type { Bild, Hausblatt, Unterkunft, Wanderung, Wissen } from '@/lib/schema';

/**
 * Eine Liste aus dem Hausblatt, eingeklappt. Ausstattung und Abreise-Pflichten
 * sind lang und werden genau zweimal gebraucht — beim Ankommen und beim
 * Gehen. Ausgeklappt wären sie den Rest der Reise nur Wand. `<details>`
 * braucht dafür keinen Zustand und keine Bibliothek.
 */
function Klappe({
  titel,
  punkte,
  testid,
}: {
  titel: string;
  punkte: readonly string[];
  testid: string;
}) {
  if (punkte.length === 0) return null;
  return (
    <details className="mt-2 border-t border-slate-100 first:border-t-0" data-testid={testid}>
      {/* 44 px hoch — das Blatt wird im Auto bedient, nicht am Schreibtisch. */}
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 py-2 text-sm font-medium text-slate-800 marker:content-none">
        {titel}
        <span aria-hidden className="text-slate-400 transition-transform">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor">
            <path d="M4 6l4 4 4-4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>
      <ul className="mb-2 space-y-1.5 pl-4 text-sm leading-relaxed text-slate-700">
        {punkte.map((punkt) => (
          <li key={punkt} className="list-disc marker:text-slate-400">
            {punkt}
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Das Blatt des Vermieters, wie man es sonst als PDF auf dem Handy sucht:
 * Anfahrt bis zum Schild an der Einfahrt, Betten, Ausstattung, die Handgriffe
 * bei Ankunft und Abreise. Es steht am Haus, weil es genau dort gebraucht wird
 * — und trägt wie jede andere Angabe seine Herkunft.
 *
 * Codes stehen bewusst nicht drin (siehe `HausblattSchema`): diese App ist
 * öffentlich erreichbar, das Hausblatt nicht.
 */
function HausblattBlock({ blatt }: { blatt: Hausblatt }) {
  return (
    <section className="mt-5 border-t border-slate-200 pt-4" data-testid="kontextblatt-hausblatt">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Hausblatt {blatt.code}
      </h3>

      {/* Die vier Zahlen, nach denen man zuerst fragt. */}
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-[11px] text-slate-500">Anreise</dt>
          <dd className="font-medium text-slate-900">{blatt.checkIn}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-slate-500">Abreise</dt>
          <dd className="font-medium text-slate-900">{blatt.checkOut}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[11px] text-slate-500">Haus</dt>
          <dd className="font-medium text-slate-900">{blatt.groesse}</dd>
        </div>
        {blatt.notfallnummer && (
          <div className="col-span-2">
            {/* Die isländische Sicherheitsnummer sagt dem Notruf, wo das Haus
                steht. Sie ist im Ernstfall die wichtigste Zeile der Seite. */}
            <dt className="text-[11px] text-slate-500">Notfallnummer des Hauses</dt>
            <dd className="font-semibold tabular-nums text-slate-900">
              {blatt.notfallnummer}
              <span className="ml-2 text-[11px] font-normal text-slate-500">
                beim Notruf 112 angeben
              </span>
            </dd>
          </div>
        )}
      </dl>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Anfahrt
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-700">{blatt.anfahrt}</p>
      {blatt.navigation && (
        <p className="mt-1.5 text-[11px]">
          {/* Der Zielpunkt des Vermieters, nicht der Ortsname: die letzten
              500 m sind hier der schwierige Teil. */}
          <a
            href={blatt.navigation}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-slate-400 underline-offset-2 hover:text-slate-800"
          >
            Ziel in Google Maps öffnen
          </a>
        </p>
      )}

      <div className="mt-3">
        <Klappe titel="Schlafplätze" punkte={blatt.schlafen} testid="hausblatt-schlafen" />
        <Klappe titel="Ausstattung" punkte={blatt.ausstattung} testid="hausblatt-ausstattung" />
        <Klappe titel="Bei Ankunft" punkte={blatt.vorOrt} testid="hausblatt-vorort" />
        <Klappe titel="Bei Abreise" punkte={blatt.abreise} testid="hausblatt-abreise" />
      </div>

      {blatt.entsorgung && (
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Müll </span>
          {blatt.entsorgung}
        </p>
      )}
      {blatt.service && (
        <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Wenn etwas klemmt </span>
          {blatt.service}
        </p>
      )}

      <p className="mt-3 text-[11px] text-slate-500">
        {blatt.quelle} · geprüft am {blatt.geprueftAm}
      </p>
    </section>
  );
}

export function ContextSheet() {
  const auswahl = useMapStore((s) => s.auswahl);
  const schliesse = useMapStore((s) => s.schliesse);

  if (auswahl.art === 'keine') return null;

  let titel = '';
  let unter = '';
  let text = '';
  let wissen: Wissen | null = null;
  let wanderung: Wanderung | null = null;
  let buchung: string | null = null;
  let bilder: readonly Bild[] = [];
  let haus: Unterkunft | null = null;
  let punkt: string | null = null;

  if (auswahl.art === 'stopp') {
    const ref = alleStopps.find((s) => s.id === auswahl.id);
    if (!ref) return null;
    titel = ref.stopp.name;
    unter = `${datumKurz(ref.datum)} · ${KATEGORIE_LABEL[kategorieVon(ref.stopp)]}`;
    text = ref.stopp.text;
    wissen = ref.stopp.wissen ?? null;
    wanderung = ref.stopp.wanderung ?? null;
    buchung = buchungSatz(ref.stopp);
    bilder = ref.stopp.bilder;
    punkt = kategorieFarbe(kategorieVon(ref.stopp));
  }

  if (auswahl.art === 'unterkunft') {
    const u = unterkunftNach(auswahl.id);
    if (!u) return null;
    haus = u;
    titel = u.name;
    unter = 'Übernachtung';
    text = u.beschreibung;
    punkt = kategorieFarbe('unterkunft');
  }

  if (auswahl.art === 'ort') {
    titel = 'Was ist hier?';
    unter = formatKoordinate(auswahl.pos);
  }

  // Auf dem Handy ein Bottom-Sheet über die volle Breite: eine Drittel-Spalte
  // neben dem Marker gibt es dort nicht, und der Daumen erreicht den unteren
  // Rand. Ab `sm:` wieder die Spalte rechts. z-40 liegt über dem Tagesstreifen
  // — auf dem Handy überdeckt das Blatt ihn, statt mit ihm zu ringen.
  return (
    <aside
      data-testid="kontextblatt"
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-40 flex max-h-[75dvh] flex-col overflow-y-auto rounded-t-2xl bg-white/95 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2 shadow-xl ring-1 ring-black/10 backdrop-blur sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-1/3 sm:min-w-[320px] sm:max-w-[33.333%] sm:rounded-none sm:p-5 sm:pb-28"
    >
      {/* Ziehgriff: macht auf dem Handy sichtbar, dass hier ein Blatt liegt. */}
      <div
        aria-hidden
        className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-slate-300 sm:hidden"
      />

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
            {/* Derselbe Farbton wie das Symbol auf der Karte — das Blatt und
                der Marker sollen erkennbar dasselbe Ding sein. */}
            {punkt && (
              <span
                aria-hidden
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: punkt }}
              />
            )}
            {unter}
          </p>
          <h2 className="mt-0.5 text-lg font-semibold leading-tight text-slate-900">{titel}</h2>
        </div>
        {/* 44 px Trefferfläche — der Rahmen ist unsichtbar, das Kreuz bleibt klein. */}
        <button
          type="button"
          onClick={schliesse}
          aria-label="Schließen"
          data-testid="kontextblatt-schliessen"
          className="-mr-2.5 -mt-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-black/5 hover:text-slate-700"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor">
            <path d="M3 3l10 10M13 3L3 13" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/*
        Die Bilder stehen ganz oben: Sie beantworten „wie sieht das aus?"
        schneller als jeder Text. Mehrere davon, weil ein Ort mehr ist als ein
        Blickwinkel — der Streifen zeigt Goðafoss im Sommer, im Winter und von
        oben, statt sich für eine Aufnahme zu entscheiden.

        Bewusst ein einfaches <img> statt next/image: die Dateien liegen auf
        Commons in genau der gebrauchten Grösse, und der Bildoptimierer von
        Vercel würde sie nur ein zweites Mal durch einen Server schicken.
      */}
      <Bilderstreifen key={bilder[0]?.url ?? titel} bilder={bilder} titel={titel} />

      {/*
        Wo man schläft und wie lange ist die wichtigste Angabe des Tages —
        deshalb steht sie ganz oben und in Zahlen, nicht in einem Nebensatz.
      */}
      {haus && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-rose-50 px-3 py-2.5 ring-1 ring-rose-100">
          <span className="text-2xl font-semibold leading-none text-rose-700 tabular-nums">
            {haus.naechte}
          </span>
          <span className="text-sm text-rose-900">
            {haus.naechte === 1 ? 'Nacht' : 'Nächte'}
            <span className="block text-[11px] text-rose-700/80">
              {datumKurz(haus.von)} – {datumKurz(haus.bis)} · {haus.verpflegung}
            </span>
          </span>
          <span className="ml-auto text-[11px] text-rose-700/80">{haus.ort}</span>
        </div>
      )}

      {/*
        Zu Fuss statt im Auto. Der Verlauf des Wanderwegs steht in keiner
        Quelle dieses Projekts und wird deshalb nicht gezeichnet — die Zahlen
        des Veranstalters stehen dafür vollständig hier.
      */}
      {wanderung && (
        <div className="mt-3 rounded-lg bg-green-50 px-3 py-2.5 ring-1 ring-green-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-green-800">
            Zu Fuß
          </p>
          <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-green-900">
            {wanderung.gehzeit && (
              <div>
                <dt className="inline text-[11px] text-green-700/80">Gehzeit </dt>
                <dd className="inline font-medium">{wanderung.gehzeit}</dd>
              </div>
            )}
            {wanderung.distanz && (
              <div>
                <dt className="inline text-[11px] text-green-700/80">Strecke </dt>
                <dd className="inline font-medium">{wanderung.distanz}</dd>
              </div>
            )}
            {wanderung.hoehenmeter && (
              <div>
                <dt className="inline text-[11px] text-green-700/80">Anstieg </dt>
                <dd className="inline font-medium">{wanderung.hoehenmeter}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/*
        Was vor der Abreise zu erledigen ist. Es stand bisher nur in der Datei:
        `buchen` und `buchenText` waren im Schema, in reise.json gepflegt — und
        wurden nirgends gezeigt. Eine Frist, die niemand sieht, ist keine.

        Das Ticket ist dasselbe Zeichen wie das Abzeichen auf der Karte, in
        derselben Farbe: Marker und Blatt sollen erkennbar dasselbe meinen.
      */}
      {buchung && (
        <div
          data-testid="kontextblatt-buchen"
          className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 ring-1 ring-amber-100"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden fill="currentColor">
              <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h9A1.5 1.5 0 0 1 14 5.5v1a1.5 1.5 0 0 0 0 3v1A1.5 1.5 0 0 1 12.5 12h-9A1.5 1.5 0 0 1 2 10.5v-1a1.5 1.5 0 0 0 0-3v-1Z" />
            </svg>
            Buchen
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-900">{buchung}</p>
        </div>
      )}

      {/*
        Was an dieser Unterkunft nicht stimmt oder zu beachten ist — bisher
        stand es nur in der Datei. Ein Widerspruch zwischen Reiseplan und
        Hausblatt gehört an das Haus, nicht in eine Fussnote: von hier aus
        wird die Etappe geplant.
      */}
      {haus?.hinweis && (
        <p
          data-testid="kontextblatt-hinweis"
          className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-900 ring-1 ring-amber-100"
        >
          {haus.hinweis}
        </p>
      )}

      {text && <p className="mt-3 text-sm leading-relaxed text-slate-700">{text}</p>}

      {haus?.hausblatt && <HausblattBlock blatt={haus.hausblatt} />}

      {/*
        Hintergrund aus der Wikipedia. Quelle und Link stehen sichtbar dabei —
        wer den Text nicht glaubt, kommt in einem Klick zum Artikel. Fehlt der
        Block, hat die Pipeline keinen eindeutigen Artikel gefunden; dann steht
        hier nichts, statt etwas Geratenem.
      */}
      {wissen && (
        <section className="mt-5 border-t border-slate-200 pt-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Hintergrund
          </h3>
          {/* Absätze bleiben Absätze — die Einleitung der Wikipedia gliedert
              nach Gedanken, und fünfzehn Zeilen am Stück liest hier niemand. */}
          {wissen.text.split('\n\n').map((absatz) => (
            <p key={absatz} className="mt-2 text-sm leading-relaxed text-slate-700">
              {absatz}
            </p>
          ))}

          {/* Das Interessante steht in der deutschen Wikipedia selten in der
              Einleitung: „Der Goðafoss ist einer der bekanntesten Wasserfälle
              Islands." Warum er so heisst, steht im Abschnitt darunter. */}
          {wissen.abschnitte.map((abschnitt) => (
            <div key={abschnitt.titel} className="mt-3">
              <h4 className="text-xs font-semibold text-slate-800">{abschnitt.titel}</h4>
              {abschnitt.text.split('\n\n').map((absatz) => (
                <p key={absatz} className="mt-1 text-sm leading-relaxed text-slate-700">
                  {absatz}
                </p>
              ))}
            </div>
          ))}
          <p className="mt-2 text-[11px] text-slate-500">
            {wissen.quelle} ·{' '}
            <a
              href={wissen.url}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-slate-400 underline-offset-2 hover:text-slate-800"
            >
              Artikel öffnen
            </a>{' '}
            · geprüft am {wissen.geprueftAm}
          </p>
        </section>
      )}
    </aside>
  );
}
