'use client';

import { useMapStore } from '@/store/mapStore';
import { datumKurz, TAG_FARBE, tage } from '@/lib/reise';

/** Fünfzehn Tage als schmaler Streifen. Klick = Kameraflug auf die Etappe. */
export function Timeline() {
  const tagDatum = useMapStore((s) => s.tagDatum);
  const setTag = useMapStore((s) => s.setTag);
  const aktiv = tage.find((t) => t.datum === tagDatum);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-3">
      <div className="pointer-events-auto rounded-lg bg-white/85 px-2.5 py-2 shadow-lg ring-1 ring-black/10 backdrop-blur">
        <ol className="flex items-end gap-1" role="tablist" aria-label="Reisetage">
          {tage.map((t) => {
            const istAktiv = t.datum === tagDatum;
            return (
              <li key={t.datum}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={istAktiv}
                  data-testid={`tag-${t.datum}`}
                  onClick={() => setTag(t.datum)}
                  title={t.titel}
                  className="group flex w-11 flex-col items-center gap-1 rounded px-0.5 py-1 transition hover:bg-black/5"
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
          <p className="mt-1.5 truncate px-1 text-center text-[11px] text-slate-600">
            {aktiv.titel}
            {aktiv.etappe?.km ? ` · ${aktiv.etappe.km} km` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
