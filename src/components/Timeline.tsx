'use client';

import { useEffect, useRef } from 'react';
import { useMapStore } from '@/store/mapStore';
import { datumKurz, TAG_FARBE, TAG_LABEL, tage } from '@/lib/reise';

/**
 * Fünfzehn Tage als Streifen. Klick = Kameraflug auf die Etappe.
 *
 * Auf dem Handy passen fünfzehn Schaltflächen nicht nebeneinander: bei 390 px
 * Breite blieben je 26 px, weit unter jeder brauchbaren Trefferfläche. Der
 * Streifen scrollt deshalb horizontal mit Snap, die Ziele sind mindestens
 * 44 px breit, und der gewählte Tag rückt von selbst in den sichtbaren
 * Bereich. Das Wischen ist damit die native Geste — auf der Karte selbst wäre
 * ein horizontaler Wisch Schwenken, und das ist dort die wichtigere Geste.
 *
 * Ab `sm:` sitzt derselbe Streifen wieder als kompakte Pille über der Karte.
 */
export function Timeline() {
  const tagDatum = useMapStore((s) => s.tagDatum);
  const setTag = useMapStore((s) => s.setTag);
  const aktiv = tage.find((t) => t.datum === tagDatum);
  const aktivRef = useRef<HTMLButtonElement>(null);
  const leiste = useRef<HTMLDivElement>(null);

  // Der gewählte Tag zentriert sich selbst — auch, wenn er über die Tastatur
  // oder einen Deep Link gesetzt wurde. `block: 'nearest'` verhindert, dass
  // die Seite dabei vertikal springt.
  useEffect(() => {
    aktivRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [tagDatum]);

  /*
    Der Streifen meldet seine eigene Höhe als CSS-Variable. Alles, was darüber
    liegen muss — die eigenen Schalter, die Bedienelemente und die
    Herkunftsangabe von MapLibre — rechnet damit, statt eine Zahl zu raten. Der
    Streifen ist auf dem Handy anders hoch als ab `sm:`, und die Titelzeile
    darunter kann umbrechen.
  */
  useEffect(() => {
    const el = leiste.current;
    if (!el) return;
    const melden = () =>
      document.documentElement.style.setProperty('--streifen-hoehe', `${el.offsetHeight}px`);
    melden();
    const beobachter = new ResizeObserver(melden);
    beobachter.observe(el);
    return () => {
      beobachter.disconnect();
      document.documentElement.style.removeProperty('--streifen-hoehe');
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 sm:flex sm:justify-center sm:p-3">
      <div ref={leiste} className="pointer-events-auto bg-white/90 pb-[env(safe-area-inset-bottom)] shadow-lg ring-1 ring-black/10 backdrop-blur sm:max-w-[calc(100vw-1.5rem)] sm:rounded-lg sm:pb-1.5">
        <ol
          className="flex snap-x snap-mandatory gap-1 overflow-x-auto scroll-px-3 px-3 pt-2 sm:scroll-px-1 sm:px-1.5"
          role="tablist"
          aria-label="Reisetage"
        >
          {tage.map((t) => {
            const istAktiv = t.datum === tagDatum;
            return (
              <li key={t.datum} className="shrink-0 snap-center">
                <button
                  type="button"
                  role="tab"
                  ref={istAktiv ? aktivRef : null}
                  aria-selected={istAktiv}
                  data-testid={`tag-${t.datum}`}
                  onClick={() => setTag(t.datum)}
                  title={`${t.titel} · ${TAG_LABEL[t.typ]}`}
                  className="group flex h-14 w-16 flex-col items-center justify-end gap-1.5 rounded px-0.5 pb-1.5 transition hover:bg-black/5 sm:h-auto sm:w-11 sm:gap-1 sm:py-1"
                >
                  <span
                    className="block w-full rounded-full transition-all"
                    style={{
                      backgroundColor: TAG_FARBE[t.typ],
                      height: istAktiv ? 7 : 4,
                      opacity: istAktiv ? 1 : 0.5,
                    }}
                  />
                  <span
                    className={`text-xs leading-none sm:text-[10px] ${
                      istAktiv ? 'font-semibold text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    {datumKurz(t.datum)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {aktiv && (
          <p className="truncate px-3 pb-2 pt-1 text-center text-xs text-slate-600 sm:px-1 sm:pb-0 sm:text-[11px]">
            {aktiv.titel}
            {aktiv.etappe?.km ? ` · ${aktiv.etappe.km} km` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
