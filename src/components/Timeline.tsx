'use client';

import { useMapStore } from '@/store/mapStore';
import { datumKurz, TAG_FARBE, TAG_LABEL, tage, unterkunftNach } from '@/lib/reise';

/**
 * Fünfzehn Tage als Streifen, darunter eine Zusammenfassung des gewählten Tages.
 * Die Farbe ist nicht dekorativ: sie steht für die Art des Tages, und genau
 * dieses Wort steht in der Zusammenfassung daneben.
 */
export function Timeline() {
  const tagDatum = useMapStore((s) => s.tagDatum);
  const setTag = useMapStore((s) => s.setTag);
  const aktiv = tage.find((t) => t.datum === tagDatum);
  const unterkunft = aktiv ? unterkunftNach(aktiv.unterkunft) : null;

  const fakten = aktiv
    ? [
        aktiv.etappe?.km ? `${aktiv.etappe.km} km` : null,
        aktiv.etappe?.fahrzeit ?? null,
        `${aktiv.highlights.length} Stopps`,
        unterkunft ? `Nacht: ${unterkunft.name}` : null,
      ].filter((x): x is string => x !== null)
    : [];

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-3">
      <div className="pointer-events-auto w-full max-w-2xl rounded-lg bg-white/90 px-3 py-2.5 shadow-lg ring-1 ring-black/10 backdrop-blur">
        <ol className="flex items-end gap-1" role="tablist" aria-label="Reisetage">
          {tage.map((t) => {
            const istAktiv = t.datum === tagDatum;
            return (
              <li key={t.datum} className="min-w-0 flex-1">
                <button
                  type="button"
                  role="tab"
                  aria-selected={istAktiv}
                  data-testid={`tag-${t.datum}`}
                  onClick={() => setTag(t.datum)}
                  title={`${t.titel} — ${TAG_LABEL[t.typ]}`}
                  className="group flex w-full flex-col items-center gap-1 rounded px-0.5 py-1 transition hover:bg-black/5"
                >
                  <span
                    className="block w-full rounded-full transition-all"
                    style={{
                      backgroundColor: TAG_FARBE[t.typ],
                      height: istAktiv ? 7 : 4,
                      opacity: istAktiv ? 1 : 0.45,
                    }}
                  />
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

        {aktiv && (
          <div className="mt-2 border-t border-slate-200 pt-2">
            <p className="flex items-center gap-2 text-[13px] font-medium leading-snug text-slate-900">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: TAG_FARBE[aktiv.typ] }}
                aria-hidden
              />
              <span className="truncate">{aktiv.titel}</span>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-600">
              <span className="font-medium text-slate-500">{TAG_LABEL[aktiv.typ]}</span>
              {aktiv.etappe && (
                <>
                  <span className="text-slate-300">|</span>
                  <span>
                    {aktiv.etappe.von} → {aktiv.etappe.nach}
                  </span>
                </>
              )}
              {fakten.map((f) => (
                <span key={f} className="flex items-center gap-2">
                  <span className="text-slate-300">|</span>
                  {f}
                </span>
              ))}
              {aktiv.lang && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                  langer Tag
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
