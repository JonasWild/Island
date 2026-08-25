'use client';

import { useMemo } from 'react';
import { useMapStore } from '@/store/mapStore';
import { alleStopps } from '@/lib/reise';
import { kategorieVon } from '@/lib/kategorie';
import { gruppeVon, GRUPPE_FARBE, GRUPPE_INHALT, GRUPPE_LABEL, GRUPPEN } from '@/lib/gruppe';

/**
 * Filter direkt auf der Karte.
 *
 * 128 Symbole gleichzeitig sind auf einem Handy keine Karte mehr, sondern ein
 * Teppich. Zwei Achsen entlasten sie, beide mit einem Tippen erreichbar:
 *
 * - **Nur dieser Tag** blendet die Ziele der anderen vierzehn Tage aus. Das
 *   ist die stärkste Entlastung und steht deshalb vorn, abgesetzt durch einen
 *   Trenner — es ist eine andere Frage als die nach der Zielart.
 * - **Sechs Überkategorien** statt sechzehn Zielarten: eine Leiste mit
 *   sechzehn Schaltflächen wäre so unbrauchbar wie die volle Karte.
 *
 * Keine Auswahl heißt *alles sichtbar*. Der Normalfall braucht also keinen
 * Zustand, und „Alle" bringt jederzeit mit einem Tippen zurück.
 *
 * Die Leiste sitzt oben: unten ist auf dem Handy jeder Platz vergeben, und
 * oben verdeckt sie nichts, was man beim Filtern ansieht.
 */
export function Filterleiste() {
  const gruppen = useMapStore((s) => s.gruppen);
  const nurTag = useMapStore((s) => s.nurTag);
  const toggleGruppe = useMapStore((s) => s.toggleGruppe);
  const alleGruppen = useMapStore((s) => s.alleGruppen);
  const toggleNurTag = useMapStore((s) => s.toggleNurTag);

  // Wie viele Ziele hinter jeder Gruppe stecken. Eine Schaltfläche ohne Zahl
  // lässt offen, ob sich das Tippen lohnt.
  const anzahl = useMemo(() => {
    const zaehler = new Map<string, number>();
    for (const { stopp } of alleStopps) {
      const g = gruppeVon(kategorieVon(stopp));
      if (g) zaehler.set(g, (zaehler.get(g) ?? 0) + 1);
    }
    return zaehler;
  }, []);

  const alleAn = gruppen.length === 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 pt-[env(safe-area-inset-top)]">
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
          className={`flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-medium shadow ring-1 backdrop-blur transition ${
            nurTag
              ? 'bg-slate-800/90 text-white ring-black/10'
              : 'bg-white/90 text-slate-700 ring-black/10 hover:bg-white'
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
          onClick={alleGruppen}
          data-testid="filter-alle"
          aria-pressed={alleAn}
          className={`flex h-11 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-xs font-medium shadow ring-1 ring-black/10 backdrop-blur transition ${
            alleAn ? 'bg-slate-800/90 text-white' : 'bg-white/90 text-slate-700 hover:bg-white'
          }`}
        >
          Alle
        </button>

        {GRUPPEN.map((g) => {
          const an = gruppen.includes(g);
          return (
            <button
              key={g}
              type="button"
              onClick={() => toggleGruppe(g)}
              data-testid={`filter-${g}`}
              aria-pressed={an}
              title={GRUPPE_INHALT[g]}
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
                {anzahl.get(g) ?? 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
