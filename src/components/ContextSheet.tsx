'use client';

import { useMapStore } from '@/store/mapStore';
import { ansicht } from '@/lib/ziel';
import { AskPanel } from './AskPanel';

/** Zweite Stufe: die ausführliche Leiste, aufgerufen aus der Infobox. */
export function ContextSheet() {
  const auswahl = useMapStore((s) => s.auswahl);
  const schliesse = useMapStore((s) => s.schliesse);
  const tagDatum = useMapStore((s) => s.tagDatum);

  if (!auswahl) return null;
  const a = ansicht(auswahl, tagDatum);
  if (!a) return null;

  return (
    <aside
      data-testid="kontextblatt"
      className="pointer-events-auto absolute right-0 top-0 z-30 flex h-full w-full min-w-[320px] max-w-[33.333%] flex-col overflow-y-auto bg-white/95 pb-28 shadow-xl ring-1 ring-black/10 backdrop-blur sm:w-1/3"
    >
      {a.bild && (
        <figure className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- externe Commons-URL, kein Loader */}
          <img src={a.bild.url} alt={a.bild.titel} className="h-52 w-full object-cover" />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-1.5 pt-6 text-[10px] text-white/80">
            <a href={a.bild.seite} target="_blank" rel="noopener noreferrer" className="underline">
              {a.bild.titel}
            </a>
            {a.bild.autor && ` · ${a.bild.autor}`}
            {a.bild.lizenz && ` · ${a.bild.lizenz}`}
          </figcaption>
        </figure>
      )}

      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-500">{a.unter}</p>
            <h2 className="mt-0.5 text-lg font-semibold leading-tight text-slate-900">{a.titel}</h2>
          </div>
          <button
            type="button"
            onClick={schliesse}
            aria-label="Schließen"
            className="-mr-1 -mt-1 shrink-0 rounded p-1.5 text-slate-400 transition hover:bg-black/5 hover:text-slate-700"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor">
              <path d="M3 3l10 10M13 3L3 13" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {a.fakten.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {a.fakten.map((f) => (
              <li
                key={f}
                className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
              >
                {f}
              </li>
            ))}
          </ul>
        )}

        {a.text && (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{a.text}</p>
        )}

        {a.website && (
          <a
            href={a.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-[11px] text-sky-700 underline underline-offset-2"
          >
            Anbieterseite
          </a>
        )}

        {a.frage && <AskPanel frage={a.frage} />}
      </div>
    </aside>
  );
}
