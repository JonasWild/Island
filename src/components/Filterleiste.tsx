'use client';

import { useMemo, useState } from 'react';
import { useMapStore } from '@/store/mapStore';
import { alleStopps } from '@/lib/reise';
import { KATEGORIE_LABEL, kategorieVon, type Kategorie } from '@/lib/kategorie';
import { GRUPPE_ARTEN, GRUPPE_FARBE, GRUPPE_LABEL, GRUPPEN, type Gruppe } from '@/lib/gruppe';
import { kategorieFarbe } from '@/map/icons';

/**
 * Filter direkt auf der Karte.
 *
 * 128 Symbole gleichzeitig sind auf einem Handy keine Karte mehr, sondern ein
 * Teppich. Drei Achsen entlasten sie:
 *
 * - **Nur dieser Tag** blendet die Ziele der anderen vierzehn Tage aus. Das
 *   ist die stärkste Entlastung und steht deshalb vorn, abgesetzt durch einen
 *   Trenner — es ist eine andere Frage als die nach der Zielart.
 * - **Drei Gruppen** statt sechzehn Zielarten in der Leiste: Natur, Aktiv,
 *   Orte. Mehr passt nicht nebeneinander, ohne dass man scrollen muss, um
 *   überhaupt zu sehen, was es gibt.
 * - **Die Zielart im Aufklapper.** Wer nur Wasserfälle will, bekommt sie —
 *   aber die Leiste bleibt schmal. Der Aufklapper zeigt zu jeder Art, wie
 *   viele Ziele dahinterstehen; eine Zeile ohne Zahl lässt offen, ob sich das
 *   Tippen lohnt.
 *
 * Keine Auswahl heißt *alles sichtbar*. Der Normalfall braucht damit keinen
 * Zustand, und „Alle" bringt jederzeit mit einem Tippen zurück.
 */
export function Filterleiste() {
  const kategorien = useMapStore((s) => s.kategorien);
  const nurTag = useMapStore((s) => s.nurTag);
  const toggleKategorie = useMapStore((s) => s.toggleKategorie);
  const toggleGruppe = useMapStore((s) => s.toggleGruppe);
  const alleGruppen = useMapStore((s) => s.alleGruppen);
  const toggleNurTag = useMapStore((s) => s.toggleNurTag);
  const [offen, setOffen] = useState<Gruppe | null>(null);

  const anzahl = useMemo(() => {
    const zaehler = new Map<Kategorie, number>();
    for (const { stopp } of alleStopps) {
      const k = kategorieVon(stopp);
      zaehler.set(k, (zaehler.get(k) ?? 0) + 1);
    }
    return zaehler;
  }, []);

  const alleAn = kategorien.length === 0;
  const gewaehlt = (g: Gruppe) => GRUPPE_ARTEN[g].filter((k) => kategorien.includes(k)).length;
  const summe = (g: Gruppe) =>
    GRUPPE_ARTEN[g].reduce((n, k) => n + (anzahl.get(k) ?? 0), 0);

  return (
    <div
      data-testid="filterleiste"
      className="pointer-events-none absolute inset-x-0 top-0 z-30 pt-[env(safe-area-inset-top)]"
    >
      <div
        className="pointer-events-auto flex gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Ziele filtern"
      >
        <button
          type="button"
          onClick={toggleNurTag}
          data-testid="filter-nurtag"
          aria-pressed={nurTag}
          title="Nur die Ziele des gewählten Tages zeigen"
          className={`flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-medium shadow ring-1 ring-black/10 backdrop-blur transition ${
            nurTag ? 'bg-slate-800/90 text-white' : 'bg-white/90 text-slate-700 hover:bg-white'
          }`}
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden fill="currentColor">
            <path d="M4 1a1 1 0 0 1 1 1v1h6V2a1 1 0 1 1 2 0v1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2V2a1 1 0 0 1 1-1Zm9 6H3v6h10V7Z" />
          </svg>
          Nur dieser Tag
        </button>

        {/* Trenner: links die Frage „welcher Tag", rechts „welche Art". */}
        <span aria-hidden className="my-2 w-px shrink-0 self-stretch bg-slate-300/70" />

        <button
          type="button"
          onClick={() => {
            alleGruppen();
            setOffen(null);
          }}
          data-testid="filter-alle"
          aria-pressed={alleAn}
          className={`flex h-11 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-xs font-medium shadow ring-1 ring-black/10 backdrop-blur transition ${
            alleAn ? 'bg-slate-800/90 text-white' : 'bg-white/90 text-slate-700 hover:bg-white'
          }`}
        >
          Alle
        </button>

        {GRUPPEN.map((g) => {
          const n = gewaehlt(g);
          const an = n > 0;
          return (
            <button
              key={g}
              type="button"
              onClick={() => setOffen((o) => (o === g ? null : g))}
              data-testid={`filter-${g}`}
              aria-pressed={an}
              aria-expanded={offen === g}
              className={`flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-medium shadow ring-1 ring-black/10 backdrop-blur transition ${
                an ? 'text-white' : 'bg-white/90 text-slate-700 hover:bg-white'
              }`}
              style={an ? { backgroundColor: GRUPPE_FARBE[g] } : undefined}
            >
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/40"
                style={{ backgroundColor: an ? 'rgba(255,255,255,0.9)' : GRUPPE_FARBE[g] }}
              />
              {GRUPPE_LABEL[g]}
              <span className={`tabular-nums ${an ? 'text-white/70' : 'text-slate-400'}`}>
                {an ? `${n}/${GRUPPE_ARTEN[g].length}` : summe(g)}
              </span>
              <svg
                viewBox="0 0 16 16"
                className={`h-3 w-3 shrink-0 transition ${offen === g ? 'rotate-180' : ''}`}
                aria-hidden
                fill="none"
                stroke="currentColor"
              >
                <path d="M3 6l5 5 5-5" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          );
        })}
      </div>

      {/*
        Der Aufklapper hängt am Wrapper, nicht in der scrollenden Leiste: sonst
        wandert er beim Scrollen mit und wird am Rand abgeschnitten.
      */}
      {offen && (
        <div
          data-testid={`aufklapper-${offen}`}
          className="pointer-events-auto absolute left-3 right-3 top-full max-h-[60dvh] overflow-y-auto rounded-xl bg-white/97 p-2 shadow-xl ring-1 ring-black/10 backdrop-blur sm:right-auto sm:w-72"
        >
          <button
            type="button"
            onClick={() => toggleGruppe(offen)}
            data-testid={`aufklapper-alles-${offen}`}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            <Haken an={gewaehlt(offen) === GRUPPE_ARTEN[offen].length} farbe={GRUPPE_FARBE[offen]} />
            Alles in {GRUPPE_LABEL[offen]}
            <span className="ml-auto text-[11px] font-normal tabular-nums text-slate-400">
              {summe(offen)}
            </span>
          </button>

          <ul className="mt-1 border-t border-slate-100 pt-1">
            {GRUPPE_ARTEN[offen].map((k) => {
              const an = kategorien.includes(k);
              return (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => toggleKategorie(k)}
                    data-testid={`kategorie-${k}`}
                    aria-pressed={an}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50"
                  >
                    <Haken an={an} farbe={kategorieFarbe(k)} />
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: kategorieFarbe(k) }}
                    />
                    {KATEGORIE_LABEL[k]}
                    <span className="ml-auto text-[11px] tabular-nums text-slate-400">
                      {anzahl.get(k) ?? 0}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Kästchen mit Haken — 20 px, damit die Zeile als Ganzes das Touch-Ziel bleibt. */
function Haken({ an, farbe }: { an: boolean; farbe: string }) {
  return (
    <span
      aria-hidden
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] ring-1 transition ${
        an ? 'ring-transparent' : 'bg-white ring-slate-300'
      }`}
      style={an ? { backgroundColor: farbe } : undefined}
    >
      {an && (
        <svg viewBox="0 0 16 16" className="h-3 w-3 text-white" fill="none" stroke="currentColor">
          <path d="M3 8.5l3.5 3.5L13 5" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}
