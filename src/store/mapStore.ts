'use client';

import { create } from 'zustand';
import type { Pos } from '@/lib/schema';
import { tage } from '@/lib/reise';
import type { Gruppe } from '@/lib/gruppe';

export type Theme = 'hell' | 'dunkel';

export type Auswahl =
  | { art: 'keine' }
  | { art: 'stopp'; id: string }
  | { art: 'unterkunft'; id: string }
  | { art: 'ort'; pos: Pos };

type State = {
  tagDatum: string;
  auswahl: Auswahl;
  theme: Theme;
  /** Schummerung. Aus, solange niemand danach fragt — dann lädt auch kein DEM. */
  relief: boolean;
  /**
   * Sichtbare Zielgruppen. **Leer heißt alle** — nicht keine. So braucht der
   * Normalfall keinen Zustand, und „alles anzeigen" ist immer nur ein Tippen
   * entfernt.
   */
  gruppen: Gruppe[];
  /** Nur die Ziele des gewählten Tages zeigen. Die stärkste Entlastung der Karte. */
  nurTag: boolean;
};

type Actions = {
  setTag: (datum: string) => void;
  tagVor: () => void;
  tagZurueck: () => void;
  waehle: (a: Auswahl) => void;
  schliesse: () => void;
  toggleTheme: () => void;
  toggleRelief: () => void;
  toggleGruppe: (g: Gruppe) => void;
  alleGruppen: () => void;
  toggleNurTag: () => void;
};

export const useMapStore = create<State & Actions>((set, get) => ({
  tagDatum: tage[0]!.datum,
  auswahl: { art: 'keine' },
  theme: 'hell',
  relief: false,
  gruppen: [],
  nurTag: false,

  setTag: (datum) => {
    if (!tage.some((t) => t.datum === datum)) return;
    set({ tagDatum: datum, auswahl: { art: 'keine' } });
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
  toggleTheme: () => set({ theme: get().theme === 'dunkel' ? 'hell' : 'dunkel' }),
  toggleRelief: () => set({ relief: !get().relief }),

  toggleGruppe: (g) => {
    const jetzt = get().gruppen;
    set({ gruppen: jetzt.includes(g) ? jetzt.filter((x) => x !== g) : [...jetzt, g] });
  },
  alleGruppen: () => set({ gruppen: [] }),
  toggleNurTag: () => set({ nurTag: !get().nurTag }),
}));
