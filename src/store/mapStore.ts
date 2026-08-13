'use client';

import { create } from 'zustand';
import type { Pos } from '@/lib/schema';
import { tage } from '@/lib/reise';

export type Theme = 'hell' | 'dunkel';

/** Was gerade im Kontextblatt steht. */
export type Auswahl =
  | { art: 'keine' }
  | { art: 'stopp'; id: string }
  | { art: 'unterkunft'; id: string }
  | { art: 'ort'; pos: Pos }
  | {
      art: 'flaeche';
      featureId: string;
      /** [west, süd, ost, nord] */
      bbox: [number, number, number, number];
      flaecheKm2: number;
    };

type State = {
  tagDatum: string;
  auswahl: Auswahl;
  hoverStoppId: string | null;
  tourLaeuft: boolean;
  tourIndex: number;
  theme: Theme;
  zeichenModus: boolean;
  /** Wird von MapCanvas gesetzt, sobald Style + Terrain stehen. */
  kartenBereit: boolean;
};

type Actions = {
  setTag: (datum: string) => void;
  tagVor: () => void;
  tagZurueck: () => void;
  waehle: (a: Auswahl) => void;
  schliesse: () => void;
  setHover: (id: string | null) => void;
  tourStart: () => void;
  tourStop: () => void;
  setTourIndex: (i: number) => void;
  toggleTour: () => void;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setZeichenModus: (an: boolean) => void;
  setKartenBereit: (bereit: boolean) => void;
};

const ERSTER_TAG = tage[0]!.datum;

export const useMapStore = create<State & Actions>((set, get) => ({
  tagDatum: ERSTER_TAG,
  auswahl: { art: 'keine' },
  hoverStoppId: null,
  tourLaeuft: false,
  tourIndex: 0,
  theme: 'dunkel',
  zeichenModus: false,
  kartenBereit: false,

  setTag: (datum) => {
    if (!tage.some((t) => t.datum === datum)) return;
    set({ tagDatum: datum, auswahl: { art: 'keine' }, tourLaeuft: false, tourIndex: 0 });
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

  waehle: (auswahl) => set({ auswahl }),
  schliesse: () => set({ auswahl: { art: 'keine' } }),
  setHover: (hoverStoppId) => set({ hoverStoppId }),

  tourStart: () => set({ tourLaeuft: true, tourIndex: 0 }),
  tourStop: () => set({ tourLaeuft: false }),
  setTourIndex: (tourIndex) => set({ tourIndex }),
  toggleTour: () => (get().tourLaeuft ? get().tourStop() : get().tourStart()),

  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set({ theme: get().theme === 'dunkel' ? 'hell' : 'dunkel' }),
  setZeichenModus: (zeichenModus) => set({ zeichenModus }),
  setKartenBereit: (kartenBereit) => set({ kartenBereit }),
}));
