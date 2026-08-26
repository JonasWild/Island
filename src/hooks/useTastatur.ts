'use client';

import { useEffect } from 'react';
import { useMapStore } from '@/store/mapStore';

/**
 * ←/→ blättert durch die Tage, Esc räumt auf.
 *
 * Die Esc-Kette geht immer genau eine Stufe zurück, in der Reihenfolge, in der
 * die Schichten aufgegangen sind:
 *
 *   Tagesablauf → Kontextblatt → Vorschau-Blase → nichts
 *
 * „Was ist hier?" hat keine Blase darunter und fällt in einem Schritt zu.
 */
export function useTastatur() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && (/^(INPUT|TEXTAREA|SELECT)$/.test(ziel.tagName) || ziel.isContentEditable)) return;

      const s = useMapStore.getState();
      if (e.key === 'Escape' && s.tagesablaufOffen) {
        e.preventDefault();
        s.schliesseTagesablauf();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        s.tagVor();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        s.tagZurueck();
      } else if (e.key === 'Escape' && s.auswahl.art !== 'keine') {
        e.preventDefault();
        if (s.detailsOffen && s.auswahl.art !== 'ort') s.schliesseDetails();
        else s.schliesse();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
