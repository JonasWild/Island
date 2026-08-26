'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { useMapStore } from '@/store/mapStore';
import { datumKurz, gehzeitTag, stunden, TAG_FARBE, TAG_LABEL, tage } from '@/lib/reise';
import { etappen, etappeName } from '@/lib/etappe';
import { routeNach } from '@/lib/route';
import { BettSymbol, StiefelSymbol, TagSymbol } from './TagSymbol';

/**
 * Der Reiseverlauf als Zeitstrahl.
 *
 * Eine durchgehende Achse, an der die Tage als Perlen sitzen — nicht eine
 * Reihe unverbundener Kästchen. Gegliedert nach **Standzeiten**: Zeiträumen
 * zwischen zwei Unterkünften. Man packt einmal aus, bleibt eine bis vier
 * Nächte, packt wieder ein; daran hängt, was ein Tag überhaupt sein kann.
 *
 * Jeder Tag trägt das Zeichen seiner Art (Anreise, Etappe, Standtag,
 * Tagesausflug, Abreise). Damit sagt die Leiste ohne ein einziges Wort, wie
 * der Tag aussieht: unterwegs oder vor Ort.
 *
 * **Farbe trägt nur der gewählte Tag** — dieselbe Regel wie für die Linien auf
 * der Karte, und aus demselben Grund. Fünfzehn eingefärbte Perlen waren
 * dieselbe Konfetti-Falle: wenn alles Farbe trägt, trägt Farbe keine Aussage
 * mehr. Die übrigen Tage bleiben neutral und lassen den gewählten stehen.
 *
 * Oben die **Vorschau** des gewählten Tages, darunter der Zeitstrahl. Die
 * Vorschau gehört an die Karte, weil sie den Tag beschreibt, den man dort
 * sieht; der Zeitstrahl gehört an den unteren Rand, wo der Daumen ihn wischt.
 *
 * Was hier **nicht** steht, steht im Tagesablauf: Pflicht- und Kür-Anteil, die
 * wievielte Nacht es ist, die Reihenfolge der Ziele. Die Leiste beantwortet
 * „wann und wie", nicht „was genau".
 *
 * Auf dem Handy scrollt sie waagerecht: fünfzehn Tage nebeneinander wären bei
 * 390 px je 26 px breit. Die Ziele sind mindestens 44 px breit, und der
 * gewählte Tag rückt von selbst in den sichtbaren Bereich.
 */

/*
  Die Masse des Zeitstrahls stehen **einmal** hier und nicht als Halbwerte in
  vier Tailwind-Klassen verteilt. Genau daran ist die Achse schon einmal
  verrutscht: `top-4` war die halbe Perle, `1.375rem` die halbe Tagesbreite,
  und wer eine der beiden Grössen ändert, verschiebt die Achse gegen die
  Perlen. Mit `calc()` auf diesen Variablen kann das nicht mehr passieren.
*/
const MASSE = {
  '--perle': '1.75rem',
  '--tag': '2.75rem',
  '--luecke': '1rem',
} as CSSProperties;

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

  // Die Kennzahlen des Tages, durch Mittelpunkte getrennt statt durch Farbe.
  const kennzahlen: React.ReactNode[] = [];
  if (gefahren?.art === 'strasse') {
    kennzahlen.push(
      <span key="km" className="font-medium text-slate-700">
        {Math.round(gefahren.km)} km
      </span>,
      <span key="fahrt">{stunden(gefahren.fahrzeitMin)}</span>,
    );
  } else if (gefahren) {
    kennzahlen.push(<span key="luft">Luftlinie</span>);
  }
  if (gehzeit > 0) {
    kennzahlen.push(
      <span key="fuss" className="flex items-center gap-1">
        <StiefelSymbol className="h-2.5 w-2.5 shrink-0 text-slate-400" />
        {stunden(gehzeit)} zu Fuß
      </span>,
    );
  }

  /*
    Ab `sm:` schwebt der Streifen als Pille über der Karte — und muss dabei das
    untere Band freilassen, in dem die Herkunftsangabe der Basiskarte steht.
    Die weicht nicht aus: sie ist Bedingung der Kartennutzung. Also weicht die
    Pille aus, mit mehr Abstand nach unten als zu den Seiten.
  */
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 sm:flex sm:justify-center sm:p-3 sm:pb-9">
      <div
        ref={leiste}
        data-testid="tagesstreifen"
        className="pointer-events-auto overflow-hidden bg-slate-50/95 pb-[env(safe-area-inset-bottom)] shadow-lg ring-1 ring-black/10 backdrop-blur sm:max-w-[calc(100vw-1.5rem)] sm:rounded-xl"
      >
        {aktiv && (
          /*
            Die Vorschau des Tages. Der Weg in den Tagesablauf ist die ganze
            Zeile, nicht ein Knopf daneben: eine volle Zeile mit Winkel rechts
            ist auf dem Handy die übliche Geste für „hier geht es weiter".

            Abgesetzt wird sie nicht durch einen dicken Strich, sondern durch
            den Grund: die Vorschau steht auf Weiss, der Zeitstrahl darunter
            auf dem grauen Grund des Streifens. Zwei Bereiche, eine Haarlinie.
          */
          <button
            type="button"
            onClick={zeigeDetails}
            data-testid="tagestitel"
            aria-label={`Tagesablauf am ${datumKurz(tagDatum)} ansehen`}
            className="flex w-full items-center gap-3 border-b border-slate-200/80 bg-white px-4 py-2.5 text-left transition hover:bg-slate-50 active:bg-slate-100 sm:py-2"
          >
            {/* Die einzige Farbfläche der Leiste — sie meint den gewählten Tag. */}
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: TAG_FARBE[aktiv.typ] }}
            >
              <TagSymbol typ={aktiv.typ} className="h-[18px] w-[18px]" />
            </span>

            <span className="min-w-0 flex-1" data-testid="tageszusammenfassung">
              <span className="flex items-baseline gap-1.5">
                <span className="shrink-0 text-[11px] font-semibold text-slate-900">
                  {TAG_LABEL[aktiv.typ]}
                </span>
                <span className="truncate text-xs text-slate-500">{aktiv.titel}</span>
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] tabular-nums text-slate-500">
                {kennzahlen.map((k, i) => (
                  <span key={i} className="flex items-center gap-x-1.5">
                    {i > 0 && (
                      <span aria-hidden className="text-slate-300">
                        ·
                      </span>
                    )}
                    {k}
                  </span>
                ))}
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

        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ol
            className="flex w-max items-start gap-[var(--luecke)] px-4 pb-1 pt-2"
            style={MASSE}
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

                    Die **feste Höhe** ist kein Zierrat. Vorher bestimmte der
                    Inhalt sie: mit Nächte-Abzeichen 20 px, ohne (Abreisetag)
                    16 px — und die Tagesreihe samt Achse rutschte in der
                    letzten Gruppe um vier Pixel hoch. Was hier steht, darf die
                    Achse nicht mehr bewegen.
                  */}
                  <p
                    className={`flex h-5 items-center gap-1.5 text-[10px] leading-none transition ${
                      hierAktiv ? 'text-slate-700' : 'text-slate-500'
                    }`}
                  >
                    {e.unterkunft ? (
                      <>
                        {/*
                          Die Nächtezahl ausgeschrieben. Als blanke Ziffer in
                          einem roten Abzeichen sagte sie nicht, was sie zählt —
                          Tage, Stopps, die wievielte Etappe? Rot bleibt der
                          Unterkunftsnadel auf der Karte vorbehalten, wo es
                          etwas bedeutet.
                        */}
                        <span className="flex shrink-0 items-center gap-1 font-medium tabular-nums">
                          <BettSymbol className="h-3 w-3 text-slate-400" />
                          {e.unterkunft.naechte} {e.unterkunft.naechte === 1 ? 'Nacht' : 'Nächte'}
                        </span>
                        <span aria-hidden className="text-slate-300">
                          ·
                        </span>
                        <span className="max-w-[9rem] truncate">{etappeName(e)}</span>
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

                    Ihre Lage ist gerechnet, nicht abgezählt: senkrecht auf die
                    halbe Perlenhöhe, waagerecht bis zur halben Tagesbreite.
                  */}
                  <div className="relative flex gap-1">
                    <span
                      aria-hidden
                      data-testid={`achse-${e.id}`}
                      className="absolute h-0.5 -translate-y-1/2 bg-slate-300"
                      style={{
                        top: 'calc(var(--perle) / 2)',
                        left: e.id === erste ? 'calc(var(--tag) / 2)' : 'calc(var(--luecke) * -1)',
                        right:
                          e.id === letzte ? 'calc(var(--tag) / 2)' : 'calc(var(--luecke) * -1)',
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
                          className="group relative flex flex-col items-center gap-1 rounded-md pb-1.5"
                          style={{ width: 'var(--tag)' }}
                        >
                          {/*
                            Die Perle auf der Achse. Neutral, solange der Tag
                            nicht gewählt ist — der Ring in der Farbe des
                            Streifengrunds hebt sie von der Achse ab, ohne
                            selbst etwas zu behaupten.
                          */}
                          <span
                            aria-hidden
                            data-testid={`perle-${t.datum}`}
                            className={`relative z-10 flex items-center justify-center rounded-full transition ${
                              istAktiv
                                ? 'scale-110 text-white shadow ring-2 ring-slate-50'
                                : 'bg-white text-slate-500 ring-1 ring-slate-300'
                            }`}
                            style={{
                              width: 'var(--perle)',
                              height: 'var(--perle)',
                              backgroundColor: istAktiv ? TAG_FARBE[t.typ] : undefined,
                            }}
                          >
                            <TagSymbol typ={t.typ} className="h-[18px] w-[18px]" />
                          </span>
                          <span
                            className={`text-[10px] leading-none tabular-nums transition ${
                              istAktiv ? 'font-semibold text-slate-900' : 'text-slate-500'
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
      </div>
    </div>
  );
}
