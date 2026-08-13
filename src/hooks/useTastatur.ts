'use client';

import { useEffect } from 'react';
import { useMapStore } from '@/store/mapStore';

/** ←/→ Tag, Esc schließt, Leertaste startet und stoppt die Tour. */
export function useTastatur() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && /^(INPUT|TEXTAREA|SELECT)$/.test(ziel.tagName)) return;
      if (ziel?.isContentEditable) return;

      const s = useMapStore.getState();
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          s.tagVor();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          s.tagZurueck();
          break;
        case 'Escape':
          if (s.auswahl.art !== 'keine') {
            e.preventDefault();
            s.schliesse();
          } else if (s.tourLaeuft) {
            e.preventDefault();
            s.tourStop();
          }
          break;
        case ' ':
        case 'Spacebar':
          // Buttons dürfen ihre eigene Leertaste behalten.
          if (ziel?.tagName === 'BUTTON') return;
          e.preventDefault();
          s.toggleTour();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
