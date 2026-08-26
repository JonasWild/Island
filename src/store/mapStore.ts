'use client';

import { create } from 'zustand';
import type { Pos } from '@/lib/schema';
import { tage } from '@/lib/reise';

export type Theme = 'hell' | 'dunkel';

export type Auswahl =
  | { art: 'keine' }
  | { art: 'stopp'; id: string }
  | { art: 'unterkunft'; id: string }
  | { art: 'ort'; pos: Pos };

type State = {
  tagDatum: string;
  auswahl: Auswahl;
  /**
   * Zwei Stufen zu einem Ziel: die Vorschau-Blase am Symbol (`false`) und das
   * volle Kontextblatt (`true`). Ein Klick auf die Karte soll die Karte nicht
   * verdecken — deshalb ist die Blase der Standard und das Blatt eine bewusste
   * zweite Handlung.
   *
   * Für `art: 'ort'` („Was ist hier?") gibt es nichts vorzuschauen: dort führt
   * der Klick sofort ins Blatt.
   */
  detailsOffen: boolean;
  theme: Theme;
};

type Actions = {
  setTag: (datum: string) => void;
  tagVor: () => void;
  tagZurueck: () => void;
  waehle: (a: Auswahl) => void;
  /** Ziel wählen und gleich das Kontextblatt öffnen — für Deep Links. */
  waehleMitDetails: (a: Auswahl) => void;
  oeffneDetails: () => void;
  /** Nur das Kontextblatt schließen, die Blase bleibt. */
  schliesseDetails: () => void;
  schliesse: () => void;
  toggleTheme: () => void;
};

export const useMapStore = create<State & Actions>((set, get) => ({
  tagDatum: tage[0]!.datum,
  auswahl: { art: 'keine' },
  detailsOffen: false,
  theme: 'hell',

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

  waehle: (auswahl) => set({ auswahl, detailsOffen: auswahl.art === 'ort' }),
  waehleMitDetails: (auswahl) => set({ auswahl, detailsOffen: true }),
  oeffneDetails: () => set({ detailsOffen: true }),
  schliesseDetails: () => set({ detailsOffen: false }),
  schliesse: () => set({ auswahl: { art: 'keine' }, detailsOffen: false }),
  toggleTheme: () => set({ theme: get().theme === 'dunkel' ? 'hell' : 'dunkel' }),
}));
