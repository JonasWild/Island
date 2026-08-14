'use client';

import { create } from 'zustand';
import type { Pos } from '@/lib/schema';
import { tage } from '@/lib/reise';

export type Theme = 'hell' | 'dunkel';

/** Worauf sich Infobox und Detailleiste beziehen. */
export type Ziel =
  | { art: 'stopp'; id: string }
  | { art: 'unterkunft'; id: string }
  | { art: 'ort'; pos: Pos };

type State = {
  tagDatum: string;
  /** Kleine Infobox direkt am Marker — die erste Stufe. */
  fokus: Ziel | null;
  /** Ausführliche Leiste am rechten Rand — die zweite Stufe. */
  auswahl: Ziel | null;
  theme: Theme;
};

type Actions = {
  setTag: (datum: string) => void;
  tagVor: () => void;
  tagZurueck: () => void;
  setFokus: (z: Ziel | null) => void;
  oeffneDetails: (z?: Ziel) => void;
  schliesse: () => void;
  toggleTheme: () => void;
};

export const useMapStore = create<State & Actions>((set, get) => ({
  tagDatum: tage[0]!.datum,
  fokus: null,
  auswahl: null,
  theme: 'hell',

  setTag: (datum) => {
    if (!tage.some((t) => t.datum === datum)) return;
    set({ tagDatum: datum, fokus: null, auswahl: null });
  },
  tagVor: () => {
    const i = tage.findIndex((t) => t.datum === get().tagDatum);
    const next = tage[Math.min(i + 1, tage.length - 1)];
    if (next) get().setTag(next.datum);
  },
  tagZurueck: () => {
    const i = tage.findIndex((t) => t.datum === get().tagDatum);
    const prev = tage[Math.max(i - 1, 0)];
    if (prev) get().setTag(prev.datum);
  },

  setFokus: (fokus) => set({ fokus }),
  /** Ohne Argument die Infobox aufklappen, mit Argument direkt öffnen. */
  oeffneDetails: (z) => {
    const ziel = z ?? get().fokus;
    if (ziel) set({ auswahl: ziel, fokus: ziel });
  },
  schliesse: () => {
    // Erst die Detailleiste, dann die Infobox — Esc arbeitet sich zurück.
    if (get().auswahl) set({ auswahl: null });
    else set({ fokus: null });
  },
  toggleTheme: () => set({ theme: get().theme === 'dunkel' ? 'hell' : 'dunkel' }),
}));
