'use client';

import { useEffect } from 'react';
import { useMapStore } from '@/store/mapStore';

/** ←/→ blättert durch die Tage, Esc schließt das Kontextblatt. */
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
      } else if (e.key === 'Escape' && s.auswahl.art !== 'keine') {
        e.preventDefault();
        s.schliesse();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
