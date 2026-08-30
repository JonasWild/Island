'use client';

import { useCallback, useRef, useState } from 'react';
import type { Bild } from '@/lib/schema';

/**
 * Die Bilder eines Stopps als Streifen zum Durchblättern.
 *
 * Gewischt wird nativ: ein waagerecht scrollender Kasten mit `scroll-snap`.
 * Das ist auf dem Handy die Geste, die jeder kennt, es braucht keine
 * Bibliothek und keinen Gestenerkenner, und es funktioniert auch dann noch,
 * wenn JavaScript hakt — der Streifen bleibt scrollbar.
 *
 * **Keine Pfeiltasten.** ← und → blättern in dieser App durch die *Tage*
 * (`useTastatur`). Ein zweites Ziel für dieselben Tasten wäre eine Falle: Man
 * wüsste nie, ob man den Tag oder das Bild wechselt. Zum Blättern gibt es
 * Knöpfe und die Punkte darunter.
 *
 * Alle Bilder stehen in einem festen 4:3-Fenster (`object-cover`). Hoch- und
 * Querformate wechseln sich ab; ohne festes Fenster springt das halbe
 * Kontextblatt bei jedem Wisch.
 *
 * Beim Wechsel des Stopps wird der Streifen über sein `key` neu aufgebaut
 * (siehe `ContextSheet`) — das setzt Position und Zähler zurück, ohne dass
 * ein Effekt hinter dem Rendern herräumen muss.
 */
export function Bilderstreifen({ bilder, titel }: { bilder: readonly Bild[]; titel: string }) {
  const spur = useRef<HTMLDivElement>(null);
  const [aktiv, setAktiv] = useState(0);

  const beiScroll = useCallback(() => {
    const el = spur.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setAktiv(Math.max(0, Math.min(bilder.length - 1, index)));
  }, [bilder.length]);

  const zu = useCallback((index: number) => {
    const el = spur.current;
    if (!el) return;
    const sanft = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: index * el.clientWidth, behavior: sanft ? 'smooth' : 'auto' });
  }, []);

  if (bilder.length === 0) return null;
  const bild = bilder[aktiv]!;
  const mehrere = bilder.length > 1;

  return (
    <figure className="mt-3" data-testid="bilderstreifen">
      <div className="relative overflow-hidden rounded-lg bg-slate-100 ring-1 ring-black/5">
        <div
          ref={spur}
          onScroll={beiScroll}
          role="group"
          aria-roledescription="Bilderstreifen"
          aria-label={`Bilder von ${titel}`}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {bilder.map((b, i) => (
            <div key={b.url} className="w-full shrink-0 snap-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.url}
                alt={b.beschreibung ?? titel}
                width={b.breite}
                height={b.hoehe}
                /* Das erste Bild ist das, was man sieht; der Rest lädt beim Wischen. */
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                className="block aspect-[4/3] w-full object-cover"
              />
            </div>
          ))}
        </div>

        {mehrere && (
          <>
            {/* Zähler statt Ratespiel: „3/6" sagt, wie viel noch kommt. */}
            <p className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white">
              {aktiv + 1}/{bilder.length}
            </p>
            <Pfeil richtung="zurueck" aus={aktiv === 0} beiKlick={() => zu(aktiv - 1)} />
            <Pfeil richtung="vor" aus={aktiv === bilder.length - 1} beiKlick={() => zu(aktiv + 1)} />
          </>
        )}
      </div>

      {mehrere && (
        <div className="mt-2 flex items-center justify-center gap-1">
          {bilder.map((b, i) => (
            <button
              key={b.url}
              type="button"
              onClick={() => zu(i)}
              aria-label={`Bild ${i + 1} von ${bilder.length}`}
              aria-current={i === aktiv}
              data-testid={`bild-punkt-${i}`}
              /* 44 px Trefferfläche um einen 6-px-Punkt — bedient wird das im Auto. */
              className="flex h-11 w-6 items-center justify-center"
            >
              <span
                aria-hidden
                className={`block h-1.5 rounded-full transition-all ${
                  i === aktiv ? 'w-4 bg-slate-700' : 'w-1.5 bg-slate-300'
                }`}
              />
            </button>
          ))}
        </div>
      )}

      <figcaption
        className={`text-[11px] leading-snug text-slate-500 ${mehrere ? 'mt-0.5' : 'mt-2'}`}
        data-testid="bild-nachweis"
      >
        {/* Was auf genau diesem Bild zu sehen ist — steht über dem Nachweis,
            weil es die Frage beantwortet, die man beim Ansehen stellt. */}
        {bild.beschreibung && (
          <span className="mb-0.5 block text-slate-600">{bild.beschreibung}</span>
        )}
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
  );
}

function Pfeil({
  richtung,
  aus,
  beiKlick,
}: {
  richtung: 'zurueck' | 'vor';
  aus: boolean;
  beiKlick: () => void;
}) {
  const zurueck = richtung === 'zurueck';
  return (
    <button
      type="button"
      onClick={beiKlick}
      disabled={aus}
      aria-label={zurueck ? 'Vorheriges Bild' : 'Nächstes Bild'}
      data-testid={`bild-${richtung}`}
      className={`absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow ring-1 ring-black/5 backdrop-blur transition hover:bg-white disabled:pointer-events-none disabled:opacity-0 ${
        zurueck ? 'left-1.5' : 'right-1.5'
      }`}
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" aria-hidden>
        <path
          d={zurueck ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
