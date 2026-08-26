'use client';

import { useEffect, useRef } from 'react';
import { useMapStore } from '@/store/mapStore';
import { alleStopps, datumKurz, unterkunftNach } from '@/lib/reise';
import { KATEGORIE_LABEL, kategorieVon } from '@/lib/kategorie';
import { formatKoordinate } from '@/lib/geo';
import type { Bild } from '@/lib/schema';
import type { Frage } from '@/lib/llm/types';
import { AskPanel } from './AskPanel';

/**
 * Das Kontextblatt — die zweite Stufe zu einem Ziel.
 *
 * Es öffnet nicht mehr beim ersten Klick auf ein Symbol, sondern erst über
 * „Mehr dazu" in der Vorschau-Blase (oder direkt über einen Deep Link). Nur
 * die Frage „Was ist hier?" an einem leeren Punkt springt weiter direkt
 * hierher: dort gibt es nichts vorzuschauen.
 *
 * Bilder tragen hier ihre Nennung von Urheber und Lizenz. Die Blase lässt sie
 * bewusst weg — die vollständige Angabe steht einen Tipp entfernt.
 */
function Bildnachweis({ bild }: { bild: Bild }) {
  const lizenz = bild.lizenzUrl ? (
    <a
      href={bild.lizenzUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 hover:text-slate-600"
    >
      {bild.lizenz}
    </a>
  ) : (
    bild.lizenz
  );
  return (
    <p className="mt-1 text-[10px] leading-snug text-slate-400">
      {bild.seite ? (
        <a
          href={bild.seite}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-slate-600"
        >
          {bild.urheber}
        </a>
      ) : (
        bild.urheber
      )}
      {' · '}
      {lizenz}
    </p>
  );
}

/**
 * Meldet, wie viel Platz das Blatt der Karte wegnimmt — `--blatt-rechts` als
 * Spalte, `--blatt-unten` als Bottom-Sheet. Die Herkunftsangabe der Basiskarte
 * weicht darauf aus; verdeckt werden darf sie nie.
 */
function useBlattMass(el: React.RefObject<HTMLElement | null>, offen: boolean) {
  useEffect(() => {
    const wurzel = document.documentElement;
    const raeumen = () => {
      wurzel.style.removeProperty('--blatt-rechts');
      wurzel.style.removeProperty('--blatt-unten');
    };
    if (!offen || !el.current) {
      raeumen();
      return;
    }
    const knoten = el.current;
    const melden = () => {
      const r = knoten.getBoundingClientRect();
      // Lässt das Blatt links noch Karte übrig, ist es eine Spalte; sonst
      // liegt es über die ganze Breite unten.
      if (r.left > 100) {
        wurzel.style.setProperty('--blatt-rechts', `${Math.round(window.innerWidth - r.left)}px`);
        wurzel.style.setProperty('--blatt-unten', '0px');
      } else {
        wurzel.style.setProperty('--blatt-rechts', '0px');
        wurzel.style.setProperty('--blatt-unten', `${Math.round(r.height)}px`);
      }
    };
    melden();
    const beobachter = new ResizeObserver(melden);
    beobachter.observe(knoten);
    return () => {
      beobachter.disconnect();
      raeumen();
    };
  }, [el, offen]);
}

export function ContextSheet() {
  const auswahl = useMapStore((s) => s.auswahl);
  const detailsOffen = useMapStore((s) => s.detailsOffen);
  const schliesse = useMapStore((s) => s.schliesse);
  const schliesseDetails = useMapStore((s) => s.schliesseDetails);
  const tagDatum = useMapStore((s) => s.tagDatum);
  const blatt = useRef<HTMLElement>(null);
  const sichtbar = auswahl.art !== 'keine' && detailsOffen;
  useBlattMass(blatt, sichtbar);

  if (!sichtbar) return null;

  let titel = '';
  let unter = '';
  let text = '';
  let bild: Bild | undefined;
  let frage: Frage | null = null;

  if (auswahl.art === 'stopp') {
    const ref = alleStopps.find((s) => s.id === auswahl.id);
    if (!ref) return null;
    titel = ref.stopp.name;
    unter = `${datumKurz(ref.datum)} · ${KATEGORIE_LABEL[kategorieVon(ref.stopp)]}`;
    text = ref.stopp.text;
    bild = ref.stopp.bild;
    frage = { art: 'stopp', stoppId: auswahl.id, tagDatum: ref.datum };
  }

  if (auswahl.art === 'unterkunft') {
    const u = unterkunftNach(auswahl.id);
    if (!u) return null;
    titel = u.name;
    unter = `Unterkunft · ${datumKurz(u.von)}–${datumKurz(u.bis)} · ${u.naechte} Nächte`;
    text = u.beschreibung;
    bild = u.bild;
  }

  if (auswahl.art === 'ort') {
    titel = 'Was ist hier?';
    unter = formatKoordinate(auswahl.pos);
    frage = { art: 'ort', pos: auswahl.pos, tagDatum };
  }

  // Der Schließer geht eine Stufe zurück: zum Ziel gibt es dann wieder die
  // Blase auf der Karte. Nur bei „Was ist hier?" gibt es keine Stufe darunter.
  const zurueck = auswahl.art === 'ort' ? schliesse : schliesseDetails;

  return (
    <aside
      ref={blatt}
      data-testid="kontextblatt"
      /*
       * Mobile first: auf dem Handy ein Bottom-Sheet bis 75 % der Höhe, ab
       * `sm:` die Spalte rechts. Als Spalte über die ganze Höhe war es auf
       * 390 px unbrauchbar — 300 px Mindestbreite ließen der Karte einen
       * Streifen von 90 px, und damit blieb von „die Karte ist die App" nichts
       * übrig. Unten liegend bleibt die Karte darüber ganze Breite.
       *
       * In beiden Fällen sitzt es **über** dem Zeitstrahl
       * (`--streifen-hoehe`), nicht auf ihm: der Streifen bleibt über die
       * ganze Breite bedienbar, und die Herkunftsangabe behält ihren Platz.
       */
      className="pointer-events-auto absolute inset-x-0 bottom-[var(--streifen-hoehe,96px)] z-30 flex max-h-[75dvh] flex-col overflow-y-auto rounded-t-2xl bg-white/95 p-5 pb-8 shadow-xl ring-1 ring-black/10 backdrop-blur sm:inset-x-auto sm:right-0 sm:top-0 sm:max-h-none sm:w-1/3 sm:min-w-[320px] sm:rounded-none"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-slate-500">{unter}</p>
          <h2 className="mt-0.5 text-lg font-semibold leading-tight text-slate-900">{titel}</h2>
        </div>
        <button
          type="button"
          onClick={zurueck}
          aria-label="Schließen"
          className="-mr-1 -mt-1 shrink-0 rounded p-1.5 text-slate-400 transition hover:bg-black/5 hover:text-slate-700"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor">
            <path d="M3 3l10 10M13 3L3 13" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {bild && (
        <figure className="mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element --
              Fremde Hosts aus reise.json; next/image bräuchte remotePatterns. */}
          <img
            src={bild.url}
            alt={titel}
            width={bild.breite}
            height={bild.hoehe}
            className="w-full rounded-lg object-cover"
          />
          <figcaption>
            <Bildnachweis bild={bild} />
          </figcaption>
        </figure>
      )}

      {text && <p className="mt-3 text-sm leading-relaxed text-slate-700">{text}</p>}

      {frage && <AskPanel frage={frage} />}
    </aside>
  );
}
