'use client';

import { useEffect } from 'react';
import { useMapStore } from '@/store/mapStore';

/** ←/→ blättert durch die Tage, Esc schließt Detailleiste bzw. Infobox. */
export function useTastatur() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && (/^(INPUT|TEXTAREA|SELECT)$/.test(ziel.tagName) || ziel.isContentEditable)) return;

      const s = useMapStore.getState();
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        s.tagVor();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        s.tagZurueck();
      } else if (e.key === 'Escape' && (s.auswahl || s.fokus)) {
        // Erst die Detailleiste, dann die Infobox.
        e.preventDefault();
        s.schliesse();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
