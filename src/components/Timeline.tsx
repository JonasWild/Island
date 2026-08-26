'use client';

import { useEffect, useRef } from 'react';
import { useMapStore } from '@/store/mapStore';
import { datumKurz, TAG_FARBE, TAG_LABEL, tage } from '@/lib/reise';
import { etappen, etappeName } from '@/lib/etappe';
import { TagTypSymbol } from './TagTypSymbol';

/**
 * Der Tagesstreifen als Zeitstrahl.
 *
 * Drei Dinge tragen ihn:
 *
 * 1. **Eine durchlaufende Achse.** Die Tage sitzen als Knoten darauf, statt
 *    als lose Kästchen nebeneinanderzustehen. Erst dadurch liest man eine
 *    Folge und keine Auswahl.
 * 2. **Die Standzeiten als Gliederung.** Über jedem Abschnitt steht sein
 *    Quartier; ein Schnitt in der Achse trennt die Abschnitte. Danach sucht
 *    man, wenn man sich an eine Reise erinnert — nicht nach dem 4. September.
 * 3. **Die Tagesart als Symbol** im Knoten (fünf Werte, siehe
 *    `TagTypSymbol`). Die Farbe allein trug das nicht: sie ist auf der Karte
 *    schon mit der Route belegt und auf 4 px Höhe nicht unterscheidbar.
 *
 * **Was hier steht und was nicht.** Der Streifen beantwortet zwei Fragen:
 * „wo bin ich in der Reise" und „was ist das für ein Tag". Deshalb tragen die
 * Knoten nur Datum und Art, und die Zusammenfassung nur die drei Zahlen, die
 * einen Tag planbar machen: Ziele, Kilometer, Fahrzeit. Alles Feinere —
 * Reihenfolge der Stopps, Gehzeiten, Hinweise, die Unterkunft — steht im
 * Tagesablauf und wäre hier Lärm über der Karte.
 *
 * **Der Weg in den Tagesablauf** ist kein angeklebter Knopf mehr, sondern die
 * Zusammenfassungszeile selbst: die ganze Fläche unter der Achse ist die
 * Schaltfläche, mit Titel, Zahlen und Winkel. Sie gehört sichtbar zum
 * gewählten Tag und ist auf dem Handy die größte Trefferfläche des Streifens.
 */
export function Timeline() {
  const tagDatum = useMapStore((s) => s.tagDatum);
  const setTag = useMapStore((s) => s.setTag);
  const oeffneTagesablauf = useMapStore((s) => s.oeffneTagesablauf);
  const streifen = useRef<HTMLDivElement>(null);
  const achse = useRef<HTMLDivElement>(null);
  const aktiv = tage.find((t) => t.datum === tagDatum);

  /*
   * Der Streifen meldet seine Höhe als `--streifen-hoehe`. Alles, was sich
   * gegen ihn stellen muss — die Kartenbedienelemente, die Herkunftsangabe der
   * Basiskarte, die Vorschau-Blase und die Kameraentscheidung —, rechnet damit.
   * Die Höhe hängt vom Inhalt ab, deshalb ein ResizeObserver statt einer
   * festen Zahl.
   */
  useEffect(() => {
    const el = streifen.current;
    if (!el) return;
    const melden = () => {
      document.documentElement.style.setProperty(
        '--streifen-hoehe',
        `${Math.round(el.getBoundingClientRect().height)}px`,
      );
    };
    melden();
    const beobachter = new ResizeObserver(melden);
    beobachter.observe(el);
    return () => {
      beobachter.disconnect();
      document.documentElement.style.removeProperty('--streifen-hoehe');
    };
  }, []);

  /** Der gewählte Tag rückt sich selbst in die Mitte — auf 390 px unentbehrlich. */
  useEffect(() => {
    const knoten = achse.current?.querySelector<HTMLElement>(`[data-testid="tag-${tagDatum}"]`);
    knoten?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [tagDatum]);

  return (
    <div
      ref={streifen}
      data-testid="zeitstrahl"
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white/90 backdrop-blur"
    >
      <div
        ref={achse}
        role="tablist"
        aria-label="Reisetage"
        className="flex snap-x snap-mandatory items-stretch overflow-x-auto scroll-smooth px-3 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {etappen.map((etappe) => (
          <section
            key={etappe.id}
            data-testid={`etappe-${etappe.id}`}
            aria-label={etappeName(etappe)}
            className="relative shrink-0 border-l border-dashed border-slate-300 pl-2 pr-1 first:border-l-0 first:pl-0"
          >
            <p className="truncate px-1 text-[10px] font-medium leading-4 text-slate-500">
              {etappeName(etappe)}
            </p>
            <ol className="relative flex items-start">
              {/*
                Die durchlaufende Achse: eine Linie hinter den Knoten, auf
                Höhe ihrer Mitte. Sie reicht über den Abschnitt hinaus bis an
                dessen Kanten, damit die Abschnitte optisch aneinanderstoßen.
              */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-[10px] h-0.5 rounded-full bg-slate-300"
              />
              {etappe.tage.map((t) => {
                const istAktiv = t.datum === tagDatum;
                return (
                  <li key={t.datum} className="snap-center">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={istAktiv}
                      data-testid={`tag-${t.datum}`}
                      onClick={() => setTag(t.datum)}
                      title={`${t.wochentag}, ${datumKurz(t.datum)} · ${TAG_LABEL[t.typ]}`}
                      className="flex h-11 w-11 flex-col items-center justify-start gap-1 rounded-lg transition hover:bg-black/5"
                    >
                      <span
                        className="grid h-[22px] w-[22px] place-items-center rounded-full border-2 transition-colors"
                        style={{
                          borderColor: TAG_FARBE[t.typ],
                          backgroundColor: istAktiv ? TAG_FARBE[t.typ] : '#ffffff',
                          color: istAktiv ? '#ffffff' : TAG_FARBE[t.typ],
                        }}
                      >
                        <TagTypSymbol typ={t.typ} className="h-3 w-3" />
                      </span>
                      <span
                        className={`text-[10px] leading-none ${
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
        ))}
      </div>

      {aktiv && (
        <button
          type="button"
          data-testid="tagestitel"
          onClick={oeffneTagesablauf}
          aria-label={`Tagesablauf für ${aktiv.wochentag}, ${datumKurz(aktiv.datum)}`}
          className="flex min-h-11 w-full items-center gap-3 border-t border-black/5 px-3 py-1.5 text-left transition hover:bg-black/5"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-slate-900">
              {aktiv.wochentag}, {datumKurz(aktiv.datum)} · {aktiv.titel}
            </span>
            <span
              data-testid="tageszusammenfassung"
              className="mt-0.5 block truncate text-[11px] text-slate-500"
            >
              {[
                `${TAG_LABEL[aktiv.typ]}`,
                `${aktiv.highlights.length} Ziele`,
                aktiv.etappe?.km ? `${aktiv.etappe.km} km` : null,
                aktiv.etappe?.fahrzeit ?? null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-600">
            Tagesablauf
            <svg
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              aria-hidden
              fill="none"
              stroke="currentColor"
            >
              <path d="M6 3l5 5-5 5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
