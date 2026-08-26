'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import { useMapStore } from '@/store/mapStore';
import { alleStopps, datumKurz, unterkunftNach } from '@/lib/reise';
import { KATEGORIE_LABEL, kategorieVon } from '@/lib/kategorie';
import { kuerzeAufSaetze } from '@/lib/text';
import { zuLngLat } from '@/lib/geo';
import { freierBereich } from '@/map/sicht';
import type { Bild, Pos } from '@/lib/schema';

/**
 * Vorschau-Blase am Symbol.
 *
 * Ein Klick auf ein Ziel soll nicht sofort die halbe Karte zudecken. Die Blase
 * beantwortet die erste Frage — was ist das? — direkt am Ort und lässt die
 * Karte stehen. Erst „Mehr dazu" öffnet das Kontextblatt.
 *
 * **Eigenes DOM statt `maplibregl.Popup`.** Beide Wege gehen; entschieden hat
 * die harte Bedingung „die Blase darf nie aus dem Bild ragen". Der Popup
 * dreht bei Bedarf seinen Anker um, aber er kappt nichts: neben einem Ziel am
 * rechten Rand steht er trotzdem halb außerhalb, und auf 390 px ist das der
 * Normalfall, nicht die Ausnahme. Hier wird die Blase stattdessen in den frei
 * sichtbaren Ausschnitt geklemmt (`freierBereich`, dasselbe Rechteck, das die
 * Kamera benutzt) und der Zeiger wandert mit. Dazu kommt: die Blase ist damit
 * gewöhnliches React mit Tailwind, ohne den Umweg über `setDOMContent` und
 * ohne die Vorrangkämpfe mit `maplibre-gl.css`.
 *
 * Bild ohne Urheber- und Lizenzzeile — bewusst für diesen Stand. Die Nennung
 * steht vollständig im Kontextblatt, das nur einen Tipp entfernt ist.
 */

/** Abstand zwischen Symbolmitte und Blase. Die Symbolplatte misst rund 45 px. */
const ABSTAND = 28;
const BREITE = 264;
const ZEIGER = 9;

type Inhalt = {
  titel: string;
  unter: string;
  text: string;
  bild: Bild | undefined;
  pos: Pos;
};

function inhaltVon(auswahl: ReturnType<typeof useMapStore.getState>['auswahl']): Inhalt | null {
  if (auswahl.art === 'stopp') {
    const ref = alleStopps.find((s) => s.id === auswahl.id);
    if (!ref?.stopp.pos) return null;
    return {
      titel: ref.stopp.name,
      unter: `${datumKurz(ref.datum)} · ${KATEGORIE_LABEL[kategorieVon(ref.stopp)]}`,
      text: kuerzeAufSaetze(ref.stopp.text, 150),
      bild: ref.stopp.bild,
      pos: ref.stopp.pos,
    };
  }
  if (auswahl.art === 'unterkunft') {
    const u = unterkunftNach(auswahl.id);
    if (!u?.pos) return null;
    return {
      titel: u.name,
      unter: `Unterkunft · ${u.naechte} ${u.naechte === 1 ? 'Nacht' : 'Nächte'}`,
      text: kuerzeAufSaetze(u.beschreibung, 150),
      bild: u.bild,
      pos: u.pos,
    };
  }
  return null;
}

type Lage = { links: number; oben: number; zeigerX: number; unterhalb: boolean; zeiger: boolean };

export function Vorschau({ karte }: { karte: MLMap | null }) {
  const auswahl = useMapStore((s) => s.auswahl);
  const detailsOffen = useMapStore((s) => s.detailsOffen);
  const oeffneDetails = useMapStore((s) => s.oeffneDetails);
  const schliesse = useMapStore((s) => s.schliesse);

  const blase = useRef<HTMLDivElement>(null);
  const [lage, setLage] = useState<Lage | null>(null);
  /** Merkt sich, zu welchem Ziel das Bild scheiterte — so gilt es nicht fürs nächste. */
  const [bildFehler, setBildFehler] = useState('');

  // Ohne Memo entsteht bei jedem Rendern ein neues Objekt, das den Callback und
  // damit den Layout-Effekt erneuert — eine Endlosschleife aus setState.
  const inhalt = useMemo(() => (detailsOffen ? null : inhaltVon(auswahl)), [auswahl, detailsOffen]);
  const schluessel = inhalt ? `${auswahl.art}:${inhalt.titel}` : '';
  const bildKaputt = bildFehler === schluessel;

  const nachfuehren = useCallback(() => {
    if (!karte || !inhalt) return;
    const punkt = karte.project(zuLngLat(inhalt.pos));
    const b = freierBereich(karte, { detailsOffen: false });
    const hoehe = blase.current?.offsetHeight ?? 160;
    const breite = blase.current?.offsetWidth ?? BREITE;

    // Standard: über dem Symbol. Reicht der Platz nicht, klappt sie darunter.
    let oben = punkt.y - ABSTAND - hoehe;
    let unterhalb = false;
    if (oben < b.oben) {
      oben = punkt.y + ABSTAND;
      unterhalb = true;
    }
    oben = Math.min(Math.max(oben, b.oben), Math.max(b.unten - hoehe, b.oben));

    const maxLinks = Math.max(b.rechts - breite, b.links);
    const links = Math.min(Math.max(punkt.x - breite / 2, b.links), maxLinks);

    const zeigerX = Math.min(Math.max(punkt.x - links, 16), breite - 16);

    /*
     * Der Zeiger erscheint nur, wenn er wirklich auf das Symbol zeigt. Wurde
     * die Blase an den Rand geklemmt, sitzt ihre Kante nicht mehr am Punkt —
     * ein Zeiger ins Leere wäre eine falsche Behauptung. Dann steht die Blase
     * eben ohne, und die Auswahl auf der Karte trägt die Zuordnung.
     */
    const kante = unterhalb ? oben : oben + hoehe;
    const soll = unterhalb ? punkt.y + ABSTAND : punkt.y - ABSTAND;
    const zeiger =
      Math.abs(kante - soll) < 1 && punkt.x >= links + 16 && punkt.x <= links + breite - 16;

    setLage((alt) =>
      alt &&
      alt.links === links &&
      alt.oben === oben &&
      alt.zeigerX === zeigerX &&
      alt.unterhalb === unterhalb &&
      alt.zeiger === zeiger
        ? alt
        : { links, oben, zeigerX, unterhalb, zeiger },
    );
  }, [karte, inhalt]);

  useLayoutEffect(() => {
    nachfuehren();
  }, [nachfuehren, schluessel]);

  useEffect(() => {
    if (!karte || !inhalt) return;
    karte.on('move', nachfuehren);
    karte.on('resize', nachfuehren);
    return () => {
      karte.off('move', nachfuehren);
      karte.off('resize', nachfuehren);
    };
  }, [karte, inhalt, nachfuehren]);

  if (!inhalt) return null;

  const zeigt = lage !== null;
  const zeigerStil: React.CSSProperties = {
    left: (lage?.zeigerX ?? 0) - ZEIGER,
    borderWidth: ZEIGER,
    ...(lage?.unterhalb ? { top: 1 - ZEIGER } : { bottom: 1 - ZEIGER }),
  };

  return (
    <div
      ref={blase}
      data-testid="vorschau"
      role="dialog"
      aria-label={inhalt.titel}
      style={{
        left: lage?.links ?? 0,
        top: lage?.oben ?? 0,
        width: BREITE,
        visibility: zeigt ? 'visible' : 'hidden',
      }}
      className="pointer-events-auto absolute z-30"
    >
      {/* Zeiger zum Symbol — außerhalb der Blase, sonst schneidet sie ihn ab. */}
      {lage?.zeiger && (
        <span
          aria-hidden
          style={zeigerStil}
          className={`absolute h-0 w-0 border-transparent ${
            lage.unterhalb ? 'border-t-0 border-b-white/95' : 'border-b-0 border-t-white/95'
          }`}
        />
      )}

      <div className="overflow-hidden rounded-xl bg-white/95 shadow-xl ring-1 ring-black/10 backdrop-blur">
        {inhalt.bild && !bildKaputt && (
          /* eslint-disable-next-line @next/next/no-img-element --
             Die Bildquellen stehen in reise.json und liegen auf fremden Hosts;
             next/image bräuchte dafür feste remotePatterns. Nennung von
             Urheber und Lizenz: siehe Kontextblatt. */
          <img
            src={inhalt.bild.url}
            alt=""
            width={inhalt.bild.breite}
            height={inhalt.bild.hoehe}
            onError={() => setBildFehler(schluessel)}
            className="h-24 w-full object-cover"
          />
        )}

        <div className="p-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{inhalt.unter}</p>
              <h2 className="mt-0.5 text-sm font-semibold leading-snug text-slate-900">
                {inhalt.titel}
              </h2>
            </div>
            <button
              type="button"
              onClick={schliesse}
              aria-label="Vorschau schließen"
              className="-mr-1.5 -mt-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-black/5 hover:text-slate-700"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                aria-hidden
                fill="none"
                stroke="currentColor"
              >
                <path d="M3 3l10 10M13 3L3 13" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {inhalt.text && (
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{inhalt.text}</p>
          )}

          <button
            type="button"
            data-testid="vorschau-mehr"
            onClick={oeffneDetails}
            className="mt-2.5 flex min-h-11 w-full items-center justify-between rounded-lg bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-700"
          >
            Mehr dazu
            <svg
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              aria-hidden
              fill="none"
              stroke="currentColor"
            >
              <path d="M6 3l5 5-5 5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
