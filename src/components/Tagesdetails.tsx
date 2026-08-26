'use client';

import { useMapStore } from '@/store/mapStore';
import { datumKurz, stoppId, TAG_FARBE, TAG_LABEL, tagNach, unterkunftNach } from '@/lib/reise';
import { KATEGORIE_LABEL, kategorieVon } from '@/lib/kategorie';
import { etappeVon, nachtNummer } from '@/lib/etappe';
import { TagTypSymbol } from './TagTypSymbol';

/**
 * Der Tagesablauf als Vollbild.
 *
 * Hier steht alles, was der Streifen bewusst nicht trägt: die Stopps in
 * Fahrreihenfolge, ihre Art, Gehzeiten, Hinweise, das Quartier des Abends. Der
 * Streifen bleibt dadurch lesbar, und diese Angaben verschwinden trotzdem
 * nicht.
 *
 * Ein Tipp auf einen Stopp schließt den Ablauf und wählt ihn auf der Karte —
 * so führt die Liste zurück zur Karte statt von ihr weg.
 */
export function Tagesdetails() {
  const offen = useMapStore((s) => s.tagesablaufOffen);
  const tagDatum = useMapStore((s) => s.tagDatum);
  const schliessen = useMapStore((s) => s.schliesseTagesablauf);
  const waehle = useMapStore((s) => s.waehle);

  const tag = tagNach(tagDatum);
  if (!offen || !tag) return null;

  const etappe = etappeVon(tag.datum);
  const nacht = nachtNummer(tag.datum);
  const haus = unterkunftNach(tag.unterkunft);
  const farbe = TAG_FARBE[tag.typ];

  return (
    <div
      data-testid="tagesablauf"
      role="dialog"
      aria-modal="true"
      aria-label={`Tagesablauf ${tag.wochentag}, ${datumKurz(tag.datum)}`}
      className="absolute inset-0 z-40 overflow-y-auto bg-white/97 backdrop-blur"
    >
      <div className="mx-auto w-full max-w-2xl p-4 pb-10">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
            style={{ backgroundColor: farbe }}
          >
            <TagTypSymbol typ={tag.typ} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {tag.wochentag}, {datumKurz(tag.datum)} · {TAG_LABEL[tag.typ]}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold leading-tight text-slate-900">
              {tag.titel}
            </h2>
          </div>
          <button
            type="button"
            onClick={schliessen}
            aria-label="Tagesablauf schließen"
            className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-black/5 hover:text-slate-700"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor">
              <path d="M3 3l10 10M13 3L3 13" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {tag.etappe && (
          <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
            {tag.etappe.von} → {tag.etappe.nach}
            {tag.etappe.km !== null && ` · ${tag.etappe.km} km`}
            {tag.etappe.fahrzeit !== null && ` · ${tag.etappe.fahrzeit}`}
            {tag.etappe.hinweis && (
              <span className="mt-1 block text-slate-500">{tag.etappe.hinweis}</span>
            )}
          </p>
        )}

        {tag.lang && (
          <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Langer Tag{tag.langHinweis ? ` — ${tag.langHinweis}` : ''}
          </p>
        )}

        <ol className="mt-4 space-y-1">
          {tag.highlights.map((stopp, i) => (
            <li key={`${tag.datum}#${i}`}>
              <button
                type="button"
                data-testid={`ablauf-stopp-${i}`}
                onClick={() => {
                  waehle({ art: 'stopp', id: stoppId(tag.datum, i) });
                  schliessen();
                }}
                className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-black/5"
              >
                <span
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white"
                  style={{ backgroundColor: farbe }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug text-slate-900">
                    {stopp.name}
                    {stopp.pos === null && (
                      <span className="ml-1 text-[10px] font-normal text-slate-400">
                        (ohne belegte Position)
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {[
                      KATEGORIE_LABEL[kategorieVon(stopp)],
                      stopp.wanderung?.gehzeit ? `Gehzeit ${stopp.wanderung.gehzeit}` : null,
                      stopp.wanderung?.distanz,
                      stopp.wanderung?.hoehenmeter,
                      stopp.buchen ? 'buchen' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                    {stopp.text}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>

        {haus && (
          <button
            type="button"
            onClick={() => {
              waehle({ art: 'unterkunft', id: haus.id });
              schliessen();
            }}
            className="mt-4 flex w-full items-start gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left transition hover:bg-black/5"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] uppercase tracking-wide text-slate-500">
                Übernachtung
                {nacht !== null &&
                  etappe?.naechte != null &&
                  ` · Nacht ${nacht} von ${etappe.naechte}`}
              </span>
              <span className="mt-0.5 block text-sm font-medium text-slate-900">{haus.name}</span>
              <span className="block text-[11px] text-slate-500">
                {haus.ort} · {haus.verpflegung}
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
