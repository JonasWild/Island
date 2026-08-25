'use client';

import { useMapStore } from '@/store/mapStore';
import { alleStopps, datumKurz, unterkunftNach } from '@/lib/reise';
import { KATEGORIE_LABEL, kategorieVon } from '@/lib/kategorie';
import { formatKoordinate } from '@/lib/geo';
import type { Wissen } from '@/lib/schema';

export function ContextSheet() {
  const auswahl = useMapStore((s) => s.auswahl);
  const schliesse = useMapStore((s) => s.schliesse);

  if (auswahl.art === 'keine') return null;

  let titel = '';
  let unter = '';
  let text = '';
  let wissen: Wissen | null = null;

  if (auswahl.art === 'stopp') {
    const ref = alleStopps.find((s) => s.id === auswahl.id);
    if (!ref) return null;
    titel = ref.stopp.name;
    unter = `${datumKurz(ref.datum)} · ${KATEGORIE_LABEL[kategorieVon(ref.stopp)]}`;
    text = ref.stopp.text;
    wissen = ref.stopp.wissen ?? null;
  }

  if (auswahl.art === 'unterkunft') {
    const u = unterkunftNach(auswahl.id);
    if (!u) return null;
    titel = u.name;
    unter = `Unterkunft · ${datumKurz(u.von)}–${datumKurz(u.bis)} · ${u.naechte} Nächte`;
    text = u.beschreibung;
  }

  if (auswahl.art === 'ort') {
    titel = 'Was ist hier?';
    unter = formatKoordinate(auswahl.pos);
  }

  // Auf dem Handy ein Bottom-Sheet über die volle Breite: eine Drittel-Spalte
  // neben dem Marker gibt es dort nicht, und der Daumen erreicht den unteren
  // Rand. Ab `sm:` wieder die Spalte rechts. z-40 liegt über dem Tagesstreifen
  // — auf dem Handy überdeckt das Blatt ihn, statt mit ihm zu ringen.
  return (
    <aside
      data-testid="kontextblatt"
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-40 flex max-h-[75dvh] flex-col overflow-y-auto rounded-t-2xl bg-white/95 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2 shadow-xl ring-1 ring-black/10 backdrop-blur sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-1/3 sm:min-w-[320px] sm:max-w-[33.333%] sm:rounded-none sm:p-5 sm:pb-28"
    >
      {/* Ziehgriff: macht auf dem Handy sichtbar, dass hier ein Blatt liegt. */}
      <div
        aria-hidden
        className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-slate-300 sm:hidden"
      />

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-slate-500">{unter}</p>
          <h2 className="mt-0.5 text-lg font-semibold leading-tight text-slate-900">{titel}</h2>
        </div>
        {/* 44 px Trefferfläche — der Rahmen ist unsichtbar, das Kreuz bleibt klein. */}
        <button
          type="button"
          onClick={schliesse}
          aria-label="Schließen"
          data-testid="kontextblatt-schliessen"
          className="-mr-2.5 -mt-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-black/5 hover:text-slate-700"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor">
            <path d="M3 3l10 10M13 3L3 13" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {text && <p className="mt-3 text-sm leading-relaxed text-slate-700">{text}</p>}

      {/*
        Hintergrund aus der Wikipedia. Quelle und Link stehen sichtbar dabei —
        wer den Text nicht glaubt, kommt in einem Klick zum Artikel. Fehlt der
        Block, hat die Pipeline keinen eindeutigen Artikel gefunden; dann steht
        hier nichts, statt etwas Geratenem.
      */}
      {wissen && (
        <section className="mt-5 border-t border-slate-200 pt-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Hintergrund
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{wissen.text}</p>
          <p className="mt-2 text-[11px] text-slate-500">
            {wissen.quelle} ·{' '}
            <a
              href={wissen.url}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-slate-400 underline-offset-2 hover:text-slate-800"
            >
              Artikel öffnen
            </a>{' '}
            · geprüft am {wissen.geprueftAm}
          </p>
        </section>
      )}
    </aside>
  );
}
