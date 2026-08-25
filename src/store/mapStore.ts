'use client';

import { create } from 'zustand';
import type { Pos } from '@/lib/schema';
import { tage } from '@/lib/reise';
import { GRUPPE_ARTEN, type Gruppe } from '@/lib/gruppe';
import type { Kategorie } from '@/lib/kategorie';

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
  /**
   * Sichtbare Zielarten. **Leer heißt alle** — nicht keine. So braucht der
   * Normalfall keinen Zustand, und „alles anzeigen" ist immer nur ein Tippen
   * entfernt.
   */
  kategorien: Kategorie[];
  /** Nur die Ziele des gewählten Tages zeigen. Die stärkste Entlastung der Karte. */
  nurTag: boolean;
  /** Der Tagesablauf als Vollbild. */
  detailsOffen: boolean;
};

type Actions = {
  setTag: (datum: string) => void;
  tagVor: () => void;
  tagZurueck: () => void;
  waehle: (a: Auswahl) => void;
  schliesse: () => void;
  toggleTheme: () => void;
  toggleKategorie: (k: Kategorie) => void;
  /** Eine ganze Gruppe an- oder abwählen. */
  toggleGruppe: (g: Gruppe) => void;
  alleGruppen: () => void;
  toggleNurTag: () => void;
  zeigeDetails: () => void;
  schliesseDetails: () => void;
};

export const useMapStore = create<State & Actions>((set, get) => ({
  tagDatum: tage[0]!.datum,
  auswahl: { art: 'keine' },
  theme: 'hell',
  kategorien: [],
  nurTag: false,
  detailsOffen: false,

  setTag: (datum) => {
    if (!tage.some((t) => t.datum === datum)) return;
    set({ tagDatum: datum, auswahl: { art: 'keine' }, detailsOffen: false });
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
  toggleKategorie: (k) => {
    const jetzt = get().kategorien;
    set({ kategorien: jetzt.includes(k) ? jetzt.filter((x) => x !== k) : [...jetzt, k] });
  },
  /*
    Eine Gruppe schaltet alle ihre Zielarten. Ist schon eine davon gewählt,
    nimmt der Griff sie heraus — sonst kommen alle dazu. Das ist die Regel,
    die man von einem Kästchen mit gemischtem Inhalt erwartet.
  */
  toggleGruppe: (g) => {
    const arten = GRUPPE_ARTEN[g];
    const jetzt = get().kategorien;
    const teilweise = arten.some((k) => jetzt.includes(k));
    set({
      kategorien: teilweise
        ? jetzt.filter((k) => !arten.includes(k))
        : [...jetzt, ...arten.filter((k) => !jetzt.includes(k))],
    });
  },
  alleGruppen: () => set({ kategorien: [] }),
  toggleNurTag: () => set({ nurTag: !get().nurTag }),
  zeigeDetails: () => set({ detailsOffen: true }),
  schliesseDetails: () => set({ detailsOffen: false }),
}));
