'use client';

import { useMapStore } from '@/store/mapStore';
import { datumKurz, TAG_FARBE, TAG_LABEL, tage, unterkunftNach } from '@/lib/reise';

/**
 * Die Zeitachse ist die einzige Navigation. 15 Tage, farbcodiert nach Typ,
 * Breite proportional zur Etappenlänge — der Tag mit 400 km sieht auch nach
 * 400 km aus.
 */
export function Timeline() {
  const tagDatum = useMapStore((s) => s.tagDatum);
  const setTag = useMapStore((s) => s.setTag);
  const tourLaeuft = useMapStore((s) => s.tourLaeuft);
  const toggleTour = useMapStore((s) => s.toggleTour);

  const aktiv = tage.find((t) => t.datum === tagDatum);
  const maxKm = Math.max(...tage.map((t) => t.etappe?.km ?? 0), 1);

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 px-3 pb-3">
      <div className="mx-auto max-w-6xl rounded-xl border border-white/10 bg-slate-950/80 p-2.5 shadow-2xl backdrop-blur-md">
        <div className="mb-2 flex items-center gap-3 px-1">
          <button
            type="button"
            onClick={toggleTour}
            aria-pressed={tourLaeuft}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-100 transition hover:bg-white/15"
            title="Kamera-Tour über die Stopps des Tages (Leertaste)"
          >
            <span aria-hidden className="text-[10px]">
              {tourLaeuft ? '■' : '▶'}
            </span>
            {tourLaeuft ? 'Tour stoppen' : 'Tour'}
          </button>
          {aktiv && (
            <div className="min-w-0 flex-1 truncate text-xs text-slate-300">
              <span className="font-medium text-slate-100">
                {aktiv.wochentag}, {datumKurz(aktiv.datum)}
              </span>
              <span className="mx-1.5 text-slate-600">·</span>
              {aktiv.titel}
              {aktiv.etappe?.km ? (
                <>
                  <span className="mx-1.5 text-slate-600">·</span>
                  {aktiv.etappe.km} km
                </>
              ) : null}
              {aktiv.unterkunft && (
                <>
                  <span className="mx-1.5 text-slate-600">·</span>
                  {unterkunftNach(aktiv.unterkunft)?.name}
                </>
              )}
            </div>
          )}
          {aktiv?.lang && (
            <span className="shrink-0 rounded border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
              langer Tag
            </span>
          )}
        </div>

        <ol className="flex items-stretch gap-1" role="tablist" aria-label="Reisetage">
          {tage.map((t) => {
            const istAktiv = t.datum === tagDatum;
            const gewicht = 1 + ((t.etappe?.km ?? 0) / maxKm) * 1.6;
            return (
              <li key={t.datum} style={{ flexGrow: gewicht, flexBasis: 0 }} className="min-w-0">
                <button
                  type="button"
                  role="tab"
                  aria-selected={istAktiv}
                  data-testid={`tag-${t.datum}`}
                  onClick={() => setTag(t.datum)}
                  title={`${t.titel} — ${TAG_LABEL[t.typ]}`}
                  className={`group relative block w-full rounded-md px-1 pb-1.5 pt-1 text-left transition ${
                    istAktiv ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <span
                    className="block h-1.5 w-full rounded-full transition-all"
                    style={{
                      backgroundColor: TAG_FARBE[t.typ],
                      opacity: istAktiv ? 1 : 0.45,
                      height: istAktiv ? 6 : 4,
                    }}
                  />
                  <span
                    className={`mt-1 block truncate text-[10px] leading-tight ${
                      istAktiv ? 'text-slate-100' : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  >
                    {datumKurz(t.datum)}
                  </span>
                  <span className="block truncate text-[9px] leading-tight text-slate-600">
                    {t.highlights.length} Stopps
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[10px] text-slate-500">
          {(Object.keys(TAG_LABEL) as Array<keyof typeof TAG_LABEL>).map((typ) => (
            <span key={typ} className="flex items-center gap-1">
              <span
                className="inline-block h-1.5 w-3 rounded-full"
                style={{ backgroundColor: TAG_FARBE[typ] }}
              />
              {TAG_LABEL[typ]}
            </span>
          ))}
          <span className="ml-auto hidden sm:inline">←/→ Tag · Leertaste Tour · Esc schließt</span>
        </div>

        {/*
          Zeichenerklärung für die Kartensymbole. Ohne sie wäre der offene Ring
          nur ein anderer Punkt — er bedeutet aber „Position nur als Bereich
          belegt", und genau das soll sichtbar sein.
        */}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full border border-slate-900 bg-slate-100" />
            punktgenau
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full border border-dashed border-slate-100" />
            nur Bereich
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rotate-45 border border-slate-900 bg-amber-400" />
            vorab buchen
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 bg-emerald-400" />
            Unterkunft
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-px w-4 border-t border-dashed border-slate-400" />
            Etappe schematisch, keine Route
          </span>
        </div>
      </div>
    </div>
  );
}
