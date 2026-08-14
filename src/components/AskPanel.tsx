'use client';

import { useEffect } from 'react';
import { useAsk } from '@/hooks/useAsk';
import type { Frage } from '@/lib/llm/types';

/** Minimales Markdown: nur **fett** — mehr liefert der Prompt nicht. */
function Zeile({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((t, i) =>
        t.startsWith('**') && t.endsWith('**') ? (
          <strong key={i} className="font-semibold text-slate-900">
            {t.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{t}</span>
        ),
      )}
    </>
  );
}

export function AskPanel({ frage }: { frage: Frage }) {
  const { zustand, fragen } = useAsk();

  const schluessel = JSON.stringify(frage);
  useEffect(() => {
    void fragen(JSON.parse(schluessel) as Frage);
  }, [schluessel, fragen]);

  const zeilen = zustand.text.split('\n').filter((z) => z.trim().length > 0);

  return (
    <section className="mt-5 border-t border-slate-200 pt-4" aria-live="polite">
      {zustand.modus === 'mock' && (
        <p className="mb-3 rounded border border-amber-400 bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-900">
          ⚠ Kein OPENAI_API_KEY gesetzt — das hier ist ein fester Beispieltext, keine Recherche.
        </p>
      )}
      {zustand.modus === 'live' && (
        <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-400">
          Antwort eines Sprachmodells
        </p>
      )}

      {zustand.fehler && (
        <p className="rounded border border-rose-300 bg-rose-50 px-2.5 py-2 text-xs text-rose-800">
          {zustand.fehler}
        </p>
      )}

      <div className="space-y-2 text-sm leading-relaxed text-slate-600">
        {zeilen.map((z, i) => (
          <p key={i} className={z.startsWith('-') ? '-indent-3 pl-3' : ''}>
            <Zeile text={z.replace(/^-\s*/, '· ')} />
          </p>
        ))}
        {zustand.laeuft && zeilen.length === 0 && <p className="text-slate-400">…</p>}
      </div>

      {zustand.quellen.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-[11px] text-slate-400">
          {zustand.quellen.map((q) => (
            <li key={q.url} className="truncate">
              <a
                href={q.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-slate-700"
              >
                {q.titel}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
