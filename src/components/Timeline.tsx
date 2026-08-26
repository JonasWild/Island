'use client';

import { useEffect, useRef } from 'react';
import { useMapStore } from '@/store/mapStore';
import { datumKurz, gehzeitTag, TAG_FARBE, TAG_LABEL, tage } from '@/lib/reise';
import { etappen, etappeName, etappeVon, nachtNummer } from '@/lib/etappe';
import { routeNach } from '@/lib/route';

/**
 * Der Reiseverlauf als strukturierter Zeitstrahl.
 *
 * Nicht fünfzehn gleichrangige Tage nebeneinander, sondern **sechs
 * Standzeiten**: Zeiträume zwischen zwei Unterkünften. Man packt einmal aus,
 * bleibt eine bis vier Nächte, packt wieder ein — daran hängt, was ein Tag
 * überhaupt sein kann. Jeder Block trägt deshalb den Namen seines Betts und
 * die Zahl der Nächte, die Tage sitzen darin.
 *
 * Auf dem Handy scrollt der Streifen horizontal mit Snap: fünfzehn
 * Schaltflächen nebeneinander wären bei 390 px je 26 px breit. Die Ziele sind
 * mindestens 44 px breit, und der gewählte Tag rückt von selbst in den
 * sichtbaren Bereich.
 */
export function Timeline() {
  const tagDatum = useMapStore((s) => s.tagDatum);
  const setTag = useMapStore((s) => s.setTag);
  const zeigeDetails = useMapStore((s) => s.zeigeDetails);
  const aktiv = tage.find((t) => t.datum === tagDatum);
  const gefahren = routeNach(tagDatum);
  const gehzeit = gehzeitTag(tagDatum);
  const etappe = etappeVon(tagDatum);
  const nacht = nachtNummer(tagDatum);
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
    Herkunftsangabe von MapLibre — rechnet damit, statt eine Zahl zu raten.
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
      <div
        ref={leiste}
        data-testid="tagesstreifen"
        className="pointer-events-auto bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-lg ring-1 ring-black/10 backdrop-blur sm:max-w-[calc(100vw-1.5rem)] sm:rounded-xl sm:pb-2"
      >
        <div
          className="flex gap-2 overflow-x-auto px-3 pt-2 [scrollbar-width:none] sm:px-2 [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Reisetage"
        >
          {etappen.map((e) => {
            const hierAktiv = e.tage.some((t) => t.datum === tagDatum);
            return (
              <section
                key={e.id}
                data-testid={`etappe-${e.id}`}
                aria-label={`${etappeName(e)}, ${datumKurz(e.von)} bis ${datumKurz(e.bis)}`}
                className={`shrink-0 rounded-lg px-1.5 pb-1 pt-1 transition ${
                  hierAktiv ? 'bg-slate-100 ring-1 ring-slate-200' : 'bg-slate-50/60'
                }`}
              >
                {/*
                  Der Kopf des Blocks: wo man schläft und wie lange. Das ist
                  die Klammer um die Tage darunter — ohne sie sind es fünfzehn
                  zusammenhanglose Kästchen.
                */}
                <p className="flex items-center gap-1 px-1 pb-1 text-[10px] leading-none">
                  {e.unterkunft ? (
                    <>
                      <span
                        aria-hidden
                        className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-[3px] bg-rose-600 px-1 text-[9px] font-bold text-white tabular-nums"
                      >
                        {e.unterkunft.naechte}
                      </span>
                      <span className="max-w-[8rem] truncate font-medium text-slate-600">
                        {e.unterkunft.name}
                      </span>
                    </>
                  ) : (
                    <span className="font-medium text-slate-500">Abreise</span>
                  )}
                </p>

                <ol className="flex gap-1">
                  {e.tage.map((t) => {
                    const istAktiv = t.datum === tagDatum;
                    return (
                      <li key={t.datum}>
                        <button
                          type="button"
                          role="tab"
                          ref={istAktiv ? aktivRef : null}
                          aria-selected={istAktiv}
                          data-testid={`tag-${t.datum}`}
                          onClick={() => setTag(t.datum)}
                          title={`${t.titel} · ${TAG_LABEL[t.typ]}`}
                          className={`flex h-12 w-14 flex-col items-center justify-end gap-1.5 rounded-md px-0.5 pb-1.5 transition sm:h-auto sm:w-11 sm:gap-1 sm:py-1 ${
                            istAktiv ? 'bg-white shadow-sm ring-1 ring-slate-300' : 'hover:bg-black/5'
                          }`}
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
              </section>
            );
          })}
        </div>

        {aktiv && (
          /*
            Die Zusammenfassung des Tages — und der Weg in den Tagesablauf.
            Der war vorher nur die Titelzeile selbst und damit unsichtbar;
            jetzt steht rechts eine echte Schaltfläche mit Beschriftung.
          */
          <div className="flex items-center gap-2 px-3 pb-2 pt-1.5 sm:px-2 sm:pb-0">
            <div className="min-w-0 flex-1" data-testid="tageszusammenfassung">
              <p className="flex items-center gap-1.5 text-xs sm:text-[11px]">
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight text-white"
                  style={{ backgroundColor: TAG_FARBE[aktiv.typ] }}
                >
                  {TAG_LABEL[aktiv.typ]}
                </span>
                <span className="truncate text-slate-600">{aktiv.titel}</span>
              </p>
              <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 whitespace-nowrap text-[11px] tabular-nums text-slate-500">
                {etappe?.unterkunft && nacht > 0 && (
                  <span className="text-rose-700">
                    Nacht {nacht} von {etappe.unterkunft.naechte}
                  </span>
                )}
                {gefahren?.art === 'strasse' ? (
                  <>
                    <span className="font-medium text-slate-700">
                      {Math.round(gefahren.km)} km
                    </span>
                    <span>
                      {Math.floor(gefahren.fahrzeitMin / 60)} h {gefahren.fahrzeitMin % 60} min
                    </span>
                  </>
                ) : (
                  gefahren && <span>Luftlinie</span>
                )}
                {gehzeit > 0 && (
                  <span className="text-green-700">
                    {Math.floor(gehzeit / 60)} h {gehzeit % 60} min zu Fuß
                  </span>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={zeigeDetails}
              data-testid="tagestitel"
              className="flex h-11 shrink-0 items-center gap-1 rounded-lg bg-slate-800 px-3 text-xs font-medium text-white transition hover:bg-slate-700"
            >
              Tagesablauf
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                aria-hidden
                fill="none"
                stroke="currentColor"
              >
                <path d="M6 3l5 5-5 5" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
