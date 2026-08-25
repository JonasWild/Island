'use client';

import { useEffect, useRef } from 'react';
import { useMapStore } from '@/store/mapStore';
import { datumKurz, gehzeitTag, TAG_FARBE, TAG_LABEL, tage } from '@/lib/reise';
import { routeNach } from '@/lib/route';

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
  const gefahren = routeNach(tagDatum);
  const gehzeit = gehzeitTag(tagDatum);
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
          <div
            className="px-3 pb-2 pt-1 text-xs text-slate-600 sm:px-1 sm:pb-0 sm:text-[11px]"
            data-testid="tagestitel"
          >
            <p className="flex items-baseline justify-center gap-1.5">
              {/*
                Die Tagesart benennen, nicht nur einfärben. Die Farbe der Route
                steht für genau das — ohne Wort daneben bleibt sie Dekoration.
              */}
              <span
                aria-hidden
                className="inline-block h-2 w-2 shrink-0 translate-y-px rounded-full"
                style={{ backgroundColor: TAG_FARBE[aktiv.typ] }}
              />
              <span className="shrink-0 font-medium text-slate-700">{TAG_LABEL[aktiv.typ]}</span>
              <span className="truncate text-slate-500">{aktiv.titel}</span>
            </p>
            {/*
              Die gefahrenen Kilometer, nicht die des Reiseplans: `etappe.km`
              ist die direkte Fahrt von A nach B, die Route fährt zusätzlich
              die vorgeschlagenen Ziele an. Getrennt nach dem, was man fahren
              muss, und dem, was man sich aussuchen kann — plus die Zeit, die
              gar nicht im Auto vergeht.
            */}
            <p className="mt-0.5 flex flex-wrap items-baseline justify-center gap-x-2 whitespace-nowrap tabular-nums text-slate-500">
              {gefahren?.art === 'strasse' ? (
                <>
                  <span className="font-medium text-slate-700">
                    {Math.round(gefahren.km)} km
                  </span>
                  <span>
                    {Math.floor(gefahren.fahrzeitMin / 60)} h {gefahren.fahrzeitMin % 60} min
                  </span>
                  {gefahren.pflichtKm > 0 ? (
                    <span title="Auf der direkten Etappe · Abstecher">
                      {Math.round(gefahren.pflichtKm)} Pflicht ·{' '}
                      {Math.round(gefahren.km - gefahren.pflichtKm)} Kür
                    </span>
                  ) : (
                    <span title="Start und Ziel sind dieselbe Unterkunft">alles freiwillig</span>
                  )}
                </>
              ) : (
                gefahren && <span>Luftlinie — nicht sauber routbar</span>
              )}
              {gehzeit > 0 && (
                <span className="text-green-700">
                  {Math.floor(gehzeit / 60)} h {gehzeit % 60} min zu Fuß
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
