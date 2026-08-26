'use client';

import { useEffect, useRef } from 'react';
import { useMapStore } from '@/store/mapStore';
import { datumKurz, gehzeitTag, TAG_FARBE, TAG_LABEL, tage } from '@/lib/reise';
import { etappen, etappeName } from '@/lib/etappe';
import { routeNach } from '@/lib/route';
import { TagSymbol } from './TagSymbol';

/**
 * Der Reiseverlauf als Zeitstrahl.
 *
 * Eine durchgehende Achse, an der die Tage als Perlen sitzen — nicht eine
 * Reihe unverbundener Kästchen. Gegliedert nach **Standzeiten**: Zeiträumen
 * zwischen zwei Unterkünften. Man packt einmal aus, bleibt eine bis vier
 * Nächte, packt wieder ein; daran hängt, was ein Tag überhaupt sein kann.
 *
 * Jeder Tag trägt das Zeichen seiner Art (Anreise, Etappe, Standtag,
 * Tagesausflug, Abreise) in der Farbe, die auf der Karte auch seine Route
 * trägt. Damit sagt die Leiste ohne ein einziges Wort, wie der Tag aussieht:
 * unterwegs oder vor Ort.
 *
 * Was hier **nicht** steht, steht im Tagesablauf: Pflicht- und Kür-Anteil, die
 * wievielte Nacht es ist, die Reihenfolge der Ziele. Die Leiste beantwortet
 * „wann und wie", nicht „was genau".
 *
 * Auf dem Handy scrollt sie waagerecht: fünfzehn Tage nebeneinander wären bei
 * 390 px je 26 px breit. Die Ziele sind mindestens 44 px breit, und der
 * gewählte Tag rückt von selbst in den sichtbaren Bereich.
 */
export function Timeline() {
  const tagDatum = useMapStore((s) => s.tagDatum);
  const setTag = useMapStore((s) => s.setTag);
  const zeigeDetails = useMapStore((s) => s.zeigeDetails);
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
    liegen muss — die eigenen Schalter, die Bedienelemente, die Herkunftsangabe
    von MapLibre und die Kameraregel in `camera.ts` — rechnet damit, statt eine
    Zahl zu raten.
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

  const erste = etappen[0]!.id;
  const letzte = etappen[etappen.length - 1]!.id;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 sm:flex sm:justify-center sm:p-3">
      <div
        ref={leiste}
        data-testid="tagesstreifen"
        className="pointer-events-auto bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-lg ring-1 ring-black/10 backdrop-blur sm:max-w-[calc(100vw-1.5rem)] sm:rounded-xl"
      >
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ol
            className="flex w-max items-start gap-4 px-4 pb-1 pt-2"
            role="tablist"
            aria-label="Reisetage"
          >
            {etappen.map((e) => {
              const hierAktiv = e.tage.some((t) => t.datum === tagDatum);
              return (
                <li key={e.id} data-testid={`etappe-${e.id}`}>
                  {/*
                    Der Kopf der Standzeit: wo man schläft und wie lange. Das
                    ist die Klammer um die Tage darunter — ohne sie sind es
                    fünfzehn zusammenhanglose Punkte.
                  */}
                  <p
                    className={`flex items-center gap-1 pb-1.5 text-[10px] leading-none transition ${
                      hierAktiv ? 'text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    {e.unterkunft ? (
                      <>
                        <span
                          aria-hidden
                          className={`inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-[3px] px-1 text-[9px] font-bold tabular-nums transition ${
                            hierAktiv ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {e.unterkunft.naechte}
                        </span>
                        <span className="max-w-[9rem] truncate font-medium">{etappeName(e)}</span>
                      </>
                    ) : (
                      <span className="font-medium">Abreise</span>
                    )}
                  </p>

                  {/*
                    Die Achse. Sie läuft über die Tage dieser Standzeit hinaus
                    in die Lücke zum Nachbarn hinein, damit der Strahl über die
                    ganze Reise durchgeht — zwischen zwei Quartieren reisst die
                    Reise ja nicht ab. Am ersten und letzten Tag bricht sie an
                    der Perle ab: davor und danach ist nichts.
                  */}
                  <div className="relative flex gap-1">
                    <span
                      aria-hidden
                      className="absolute top-4 h-0.5 bg-slate-200"
                      style={{
                        left: e.id === erste ? '1.375rem' : '-1rem',
                        right: e.id === letzte ? '1.375rem' : '-1rem',
                      }}
                    />

                    {e.tage.map((t) => {
                      const istAktiv = t.datum === tagDatum;
                      return (
                        <button
                          key={t.datum}
                          type="button"
                          role="tab"
                          ref={istAktiv ? aktivRef : null}
                          aria-selected={istAktiv}
                          data-testid={`tag-${t.datum}`}
                          onClick={() => setTag(t.datum)}
                          title={`${t.titel} · ${TAG_LABEL[t.typ]}`}
                          className="group relative flex w-11 flex-col items-center gap-1 rounded-md pb-1 pt-0.5"
                        >
                          {/* Die Perle auf der Achse, in der Farbe ihrer Tagesart. */}
                          <span
                            aria-hidden
                            className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-white ring-2 ring-white transition ${
                              istAktiv ? 'scale-110 shadow' : ''
                            }`}
                            style={{
                              backgroundColor: TAG_FARBE[t.typ],
                              opacity: istAktiv ? 1 : 0.45,
                            }}
                          >
                            <TagSymbol typ={t.typ} className="h-4 w-4" />
                          </span>
                          <span
                            className={`text-[10px] leading-none tabular-nums transition ${
                              istAktiv ? 'font-semibold text-slate-900' : 'text-slate-400'
                            }`}
                          >
                            {datumKurz(t.datum)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {aktiv && (
          /*
            Der Weg in den Tagesablauf ist die ganze Zeile, nicht ein Knopf
            daneben. Eine volle Zeile mit Winkel rechts ist auf dem Handy die
            übliche Geste für „hier geht es weiter"; der aufgesetzte dunkle
            Knopf war der Fremdkörper.
          */
          <button
            type="button"
            onClick={zeigeDetails}
            data-testid="tagestitel"
            aria-label={`Tagesablauf am ${datumKurz(tagDatum)} ansehen`}
            className="flex w-full items-center gap-3 border-t border-slate-200/80 px-4 py-2.5 text-left transition hover:bg-slate-50 active:bg-slate-100 sm:py-2"
          >
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: TAG_FARBE[aktiv.typ] }}
            >
              <TagSymbol typ={aktiv.typ} className="h-4 w-4" />
            </span>

            <span className="min-w-0 flex-1" data-testid="tageszusammenfassung">
              <span className="flex items-baseline gap-1.5">
                <span className="shrink-0 text-[11px] font-semibold text-slate-700">
                  {TAG_LABEL[aktiv.typ]}
                </span>
                <span className="truncate text-xs text-slate-500">{aktiv.titel}</span>
              </span>
              <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[11px] tabular-nums text-slate-500">
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
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-500">
              Ablauf
              <svg
                viewBox="0 0 16 16"
                className="h-4 w-4"
                aria-hidden
                fill="none"
                stroke="currentColor"
              >
                <path d="M6 3l5 5-5 5" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
