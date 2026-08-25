'use client';

import { useMapStore } from '@/store/mapStore';
import { alleStopps, datumKurz, unterkunftNach } from '@/lib/reise';
import { KATEGORIE_LABEL, kategorieVon } from '@/lib/kategorie';
import { kategorieFarbe } from '@/map/icons';
import { formatKoordinate } from '@/lib/geo';
import type { Bild, Unterkunft, Wanderung, Wissen } from '@/lib/schema';

export function ContextSheet() {
  const auswahl = useMapStore((s) => s.auswahl);
  const schliesse = useMapStore((s) => s.schliesse);

  if (auswahl.art === 'keine') return null;

  let titel = '';
  let unter = '';
  let text = '';
  let wissen: Wissen | null = null;
  let wanderung: Wanderung | null = null;
  let bild: Bild | null = null;
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
    bild = ref.stopp.bild ?? null;
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
        Das Bild steht ganz oben: es beantwortet „wie sieht das aus?" schneller
        als jeder Text. Breite und Höhe kommen aus der Pipeline und stehen im
        Markup, damit das Blatt beim Laden nicht springt.

        Bewusst ein einfaches <img> statt next/image: die Datei liegt auf
        Commons in genau der gebrauchten Grösse, und der Bildoptimierer von
        Vercel würde sie nur ein zweites Mal durch einen Server schicken.
      */}
      {bild && (
        <figure className="mt-3 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bild.url}
            alt={titel}
            width={bild.breite}
            height={bild.hoehe}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full"
          />
          <figcaption className="px-3 py-2 text-[11px] leading-snug text-slate-500">
            {/* Bei CC-BY-SA ist die Nennung Bedingung, nicht Höflichkeit. */}
            {bild.urheber} ·{' '}
            {bild.lizenzUrl ? (
              <a
                href={bild.lizenzUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-slate-400 underline-offset-2 hover:text-slate-800"
              >
                {bild.lizenz}
              </a>
            ) : (
              bild.lizenz
            )}{' '}
            ·{' '}
            <a
              href={bild.seite}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-slate-400 underline-offset-2 hover:text-slate-800"
            >
              Wikimedia Commons
            </a>
          </figcaption>
        </figure>
      )}

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

      {text && <p className="mt-3 text-sm leading-relaxed text-slate-700">{text}</p>}

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
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{wissen.text}</p>
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
