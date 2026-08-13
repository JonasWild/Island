'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Frage, SseEreignis } from '@/lib/llm/types';

export type AskZustand = {
  laeuft: boolean;
  text: string;
  quellen: Array<{ titel: string; url: string }>;
  fehler: string | null;
  modus: 'mock' | 'live' | null;
  modell: string | null;
};

const LEER: AskZustand = {
  laeuft: false,
  text: '',
  quellen: [],
  fehler: null,
  modus: null,
  modell: null,
};

/**
 * SSE-Client für /api/ask. Läuft über fetch statt EventSource, weil die Frage
 * per POST geht und die Antwort abbrechbar sein muss.
 */
export function useAsk() {
  const [zustand, setZustand] = useState<AskZustand>(LEER);
  const abbruch = useRef<AbortController | null>(null);

  const stoppen = useCallback(() => {
    abbruch.current?.abort();
    abbruch.current = null;
    setZustand((z) => ({ ...z, laeuft: false }));
  }, []);

  const zuruecksetzen = useCallback(() => {
    abbruch.current?.abort();
    abbruch.current = null;
    setZustand(LEER);
  }, []);

  const fragen = useCallback(async (frage: Frage) => {
    abbruch.current?.abort();
    const ctrl = new AbortController();
    abbruch.current = ctrl;
    setZustand({ ...LEER, laeuft: true });

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(frage),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const fehler = await res.json().catch(() => ({ fehler: `HTTP ${res.status}` }));
        setZustand({ ...LEER, fehler: fehler.fehler ?? `HTTP ${res.status}` });
        return;
      }

      const leser = res.body.getReader();
      const decoder = new TextDecoder();
      let puffer = '';

      for (;;) {
        const { done, value } = await leser.read();
        if (done) break;
        puffer += decoder.decode(value, { stream: true });
        const bloecke = puffer.split('\n\n');
        puffer = bloecke.pop() ?? '';
        for (const block of bloecke) {
          const zeile = block.split('\n').find((l) => l.startsWith('data: '));
          if (!zeile) continue;
          let e: SseEreignis;
          try {
            e = JSON.parse(zeile.slice(6)) as SseEreignis;
          } catch {
            continue;
          }
          setZustand((z) => {
            switch (e.typ) {
              case 'start':
                return { ...z, modus: e.modus, modell: e.modell };
              case 'delta':
                return { ...z, text: z.text + e.text };
              case 'quelle':
                return z.quellen.some((q) => q.url === e.url)
                  ? z
                  : { ...z, quellen: [...z.quellen, { titel: e.titel, url: e.url }] };
              case 'fehler':
                return { ...z, fehler: e.text, laeuft: false };
              case 'ende':
                return { ...z, laeuft: false };
              default:
                return z;
            }
          });
        }
      }
      setZustand((z) => ({ ...z, laeuft: false }));
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setZustand({ ...LEER, fehler: (err as Error).message });
    }
  }, []);

  useEffect(() => () => abbruch.current?.abort(), []);

  return { zustand, fragen, stoppen, zuruecksetzen };
}
