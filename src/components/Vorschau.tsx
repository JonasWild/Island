'use client';

import { useEffect, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import { useMapStore } from '@/store/mapStore';
import { alleStopps, datumKurz, unterkunftNach } from '@/lib/reise';
import { KATEGORIE_LABEL, kategorieVon } from '@/lib/kategorie';
import { kategorieFarbe } from '@/map/icons';
import { zuLngLat } from '@/lib/geo';
import type { Bild, Pos } from '@/lib/schema';

/** Breite der Blase. Schmal genug, dass sie auf 390 px nicht die Karte frisst. */
const BREITE = 230;
/** Abstand vom Symbol nach oben — die Blase steht über dem Marker. */
const ABSTAND = 46;
/** Mindestabstand zum Rand des Kartenfensters. */
const RAND = 8;

/**
 * Der Text auf ein bis zwei ganze Sätze kürzen.
 *
 * `stopp.text` des Veranstalters ist im Median 126 Zeichen lang, geht aber bis
 * 530. Ein mitten im Satz abgeschnittener Text liest sich wie ein Fehler,
 * deshalb wird an Satzgrenzen gekürzt und nur dann ausgelassen, wenn wirklich
 * etwas fehlt.
 */
function ersteSaetze(text: string, hoechstens = 160): string {
  const sauber = text.replace(/\s+/g, ' ').trim();
  if (sauber.length <= hoechstens) return sauber;

  let ende = 0;
  for (const treffer of sauber.matchAll(/[.!?](\s|$)/g)) {
    const bis = treffer.index + 1;
    if (bis > hoechstens) break;
    ende = bis;
  }
  return ende > 0 ? sauber.slice(0, ende) : sauber.slice(0, hoechstens).replace(/\s+\S*$/, '') + ' …';
}

type Inhalt = {
  pos: Pos;
  titel: string;
  unter: string;
  text: string;
  bild: Bild | null;
  farbe: string;
};

function inhaltVon(vorschau: NonNullable<ReturnType<typeof useMapStore.getState>['vorschau']>): Inhalt | null {
  if (vorschau.art === 'unterkunft') {
    const u = unterkunftNach(vorschau.id);
    if (!u?.pos) return null;
    return {
      pos: u.pos,
      titel: u.name,
      unter: `${u.naechte} ${u.naechte === 1 ? 'Nacht' : 'Nächte'} · ${datumKurz(u.von)}–${datumKurz(u.bis)}`,
      text: ersteSaetze(u.beschreibung),
      bild: null,
      farbe: kategorieFarbe('unterkunft'),
    };
  }
  const ref = alleStopps.find((s) => s.id === vorschau.id);
  if (!ref?.stopp.pos) return null;
  const kategorie = kategorieVon(ref.stopp);
  return {
    pos: ref.stopp.pos,
    titel: ref.stopp.name,
    unter: `${datumKurz(ref.datum)} · ${KATEGORIE_LABEL[kategorie]}`,
    text: ersteSaetze(ref.stopp.text),
    bild: ref.stopp.bilder[0] ?? null,
    farbe: kategorieFarbe(kategorie),
  };
}

/**
 * Die kleine Blase am Symbol: erster Blick, nicht das ganze Blatt.
 *
 * Ein Klick auf ein Kartensymbol öffnet sie direkt über dem Marker — Bild,
 * Name, ein bis zwei Sätze. Von dort führt ein Knopf ins Kontextblatt mit
 * allem Übrigen. Zwei Stufen statt einer: der Blick auf „was ist das?" soll
 * nicht das halbe Bild kosten.
 *
 * Bewusst **kein** `maplibregl.Popup`, sondern ein eigenes Element: die
 * Popup-Styles aus `maplibre-gl.css` müssten sonst Stück für Stück
 * überschrieben werden, und dieselbe Datei gewinnt bei gleicher Spezifität
 * gegen `globals.css`. Ein eigenes Element wird stattdessen bei jeder
 * Kartenbewegung über `map.project()` neu gesetzt.
 */
export function Vorschau({ karte }: { karte: MLMap | null }) {
  const vorschau = useMapStore((s) => s.vorschau);
  const zeigeVorschau = useMapStore((s) => s.zeigeVorschau);
  const waehle = useMapStore((s) => s.waehle);
  /*
    Die Blase klebt am Marker, also muss sie jeder Kartenbewegung folgen.
    Die Position wird beim Rendern aus `map.project()` gelesen — synchron und
    billig; der Zähler sorgt nur dafür, dass überhaupt neu gerendert wird.
    Ein `setState` mit der Position würde bei jedem Frame einer Animation eine
    zweite Renderrunde auslösen.
  */
  const [, neuZeichnen] = useState(0);
  useEffect(() => {
    if (!karte) return;
    const anstossen = () => neuZeichnen((n) => n + 1);
    karte.on('move', anstossen);
    karte.on('resize', anstossen);
    return () => {
      karte.off('move', anstossen);
      karte.off('resize', anstossen);
    };
  }, [karte]);

  const inhalt = vorschau ? inhaltVon(vorschau) : null;
  if (!vorschau || !inhalt || !karte) return null;

  const punkt = karte.project(zuLngLat(inhalt.pos));

  /*
    An den Rand geklemmt: auf 390 px Breite ist das die Regel, nicht der
    Sonderfall. Die Blase steht über dem Marker; ist oben kein Platz, kippt
    sie darunter.
  */
  const breiteKarte = karte.getContainer().clientWidth;
  const hoeheKarte = karte.getContainer().clientHeight;
  const links = Math.min(
    Math.max(punkt.x - BREITE / 2, RAND),
    Math.max(breiteKarte - BREITE - RAND, RAND),
  );
  const darunter = punkt.y < hoeheKarte * 0.42;
  const oben = darunter ? punkt.y + ABSTAND * 0.5 : undefined;
  const unten = darunter ? undefined : hoeheKarte - punkt.y + ABSTAND * 0.4;

  return (
    <div
      data-testid="vorschau"
      className="pointer-events-auto absolute z-40 overflow-hidden rounded-xl bg-white/97 shadow-xl ring-1 ring-black/10 backdrop-blur"
      style={{ left: links, top: oben, bottom: unten, width: BREITE }}
    >
      {/*
        Zeiger auf den Marker. Ohne ihn schwebt die Blase irgendwo über der
        Karte und man muss raten, zu welchem der eng stehenden Symbole sie
        gehört. Er sitzt an der Waagerechten des Markers, auch wenn die Blase
        seitlich an den Rand geklemmt wurde.
      */}
      <span
        aria-hidden
        className="absolute h-3 w-3 rotate-45 bg-white/97 ring-1 ring-black/10"
        style={{
          left: Math.min(Math.max(punkt.x - links - 6, 12), BREITE - 24),
          [darunter ? 'top' : 'bottom']: -6,
          clipPath: darunter
            ? 'polygon(0 0, 100% 0, 0 100%)'
            : 'polygon(100% 0, 100% 100%, 0 100%)',
        }}
      />
      {inhalt.bild && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={inhalt.bild.url}
          alt=""
          width={inhalt.bild.breite}
          height={inhalt.bild.hoehe}
          loading="lazy"
          decoding="async"
          className="block h-24 w-full object-cover"
        />
      )}

      <div className="p-3">
        <p className="flex items-center gap-1.5 text-[10px] leading-none text-slate-500">
          <span
            aria-hidden
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: inhalt.farbe }}
          />
          <span className="truncate">{inhalt.unter}</span>
        </p>
        <h2 className="mt-1 text-sm font-semibold leading-tight text-slate-900">{inhalt.titel}</h2>
        {inhalt.text && (
          <p className="mt-1 text-[11px] leading-snug text-slate-600">{inhalt.text}</p>
        )}

        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            data-testid="vorschau-mehr"
            onClick={() => waehle(vorschau)}
            className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-slate-800 text-xs font-medium text-white transition hover:bg-slate-700"
          >
            Mehr
            <svg
              viewBox="0 0 16 16"
              className="h-3 w-3"
              aria-hidden
              fill="none"
              stroke="currentColor"
            >
              <path d="M6 3l5 5-5 5" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            data-testid="vorschau-schliessen"
            onClick={() => zeigeVorschau(null)}
            aria-label="Vorschau schließen"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-black/5 hover:text-slate-700"
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
      </div>
    </div>
  );
}
