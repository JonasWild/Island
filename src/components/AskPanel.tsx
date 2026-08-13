'use client';

import { useEffect } from 'react';
import { useAsk } from '@/hooks/useAsk';
import type { Frage } from '@/lib/llm/types';

/** Minimales Markdown: nur Listenpunkte und **fett** — mehr liefert der Prompt nicht. */
function Zeile({ text }: { text: string }) {
  const teile = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {teile.map((t, i) =>
        t.startsWith('**') && t.endsWith('**') ? (
          <strong key={i} className="font-semibold text-slate-100">
            {t.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{t}</span>
        ),
      )}
    </>
  );
}

export function AskPanel({ frage, titel }: { frage: Frage; titel: string }) {
  const { zustand, fragen, stoppen } = useAsk();

  // Die Frage wird gestellt, sobald sich der Fragegegenstand ändert.
  const schluessel = JSON.stringify(frage);
  useEffect(() => {
    void fragen(JSON.parse(schluessel) as Frage);
  }, [schluessel, fragen]);

  const zeilen = zustand.text.split('\n').filter((z) => z.trim().length > 0);

  return (
    <section className="mt-4 border-t border-white/10 pt-3" aria-live="polite">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded border border-violet-400/40 bg-violet-400/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-300">
          LLM-Ausgabe
        </span>
        <span className="truncate text-[11px] text-slate-500">{titel}</span>
        {zustand.laeuft && (
          <button
            type="button"
            onClick={stoppen}
            className="ml-auto shrink-0 rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-white/10"
          >
            stoppen
          </button>
        )}
      </div>

      {zustand.fehler && (
        <p className="rounded border border-rose-400/30 bg-rose-400/10 px-2 py-1.5 text-xs text-rose-200">
          {zustand.fehler}
        </p>
      )}

      <div className="space-y-1.5 text-[13px] leading-relaxed text-slate-300">
        {zeilen.map((z, i) => (
          <p key={i} className={z.startsWith('-') ? 'pl-3 -indent-3' : ''}>
            <Zeile text={z.replace(/^-\s*/, '· ')} />
          </p>
        ))}
        {zustand.laeuft && zeilen.length === 0 && (
          <p className="text-slate-500">
            <span className="inline-block animate-pulse">fragt …</span>
          </p>
        )}
        {zustand.laeuft && zeilen.length > 0 && (
          <span className="inline-block h-3 w-1.5 animate-pulse bg-slate-400 align-middle" />
        )}
      </div>

      {zustand.quellen.length > 0 && (
        <ul className="mt-2.5 space-y-0.5 text-[11px] text-slate-500">
          {zustand.quellen.map((q) => (
            <li key={q.url} className="truncate">
              <a
                href={q.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-slate-700 underline-offset-2 hover:text-slate-300"
              >
                {q.titel}
              </a>
            </li>
          ))}
        </ul>
      )}

      {!zustand.laeuft && zustand.modus && (
        <p className="mt-2 text-[10px] text-slate-600">
          {zustand.modus === 'mock'
            ? 'Mock-Antwort aus Fixtures — keine Live-Recherche.'
            : `Erzeugt von ${zustand.modell}. Angaben ohne Gewähr.`}
        </p>
      )}
    </section>
  );
}
